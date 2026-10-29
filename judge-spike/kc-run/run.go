package main

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

const (
	stderrLimit   = 8 << 10
	pollInterval  = 10 * time.Millisecond
	compileMemMb  = 1024
	fsizeMb       = 16
	stackMb       = 256
	compileOutMax = 16 << 10
)

func itoa(n int) string { return strconv.Itoa(n) }

func (r *runner) run(job *Job) (*Result, error) {
	if !r.acquire() {
		return nil, errBusy
	}
	defer r.release()

	lang := languages[job.Lang]
	dir := filepath.Join(r.cfg.WorkRoot, job.ID)
	res := &Result{ID: job.ID, Tests: []StepResult{}}
	defer func() { res.Strays += r.cleanup(dir) }()

	// A leftover from a crashed job must never leak into this one.
	r.cleanup(dir)
	if err := os.Mkdir(dir, 0o700); err != nil {
		return nil, fmt.Errorf("mkdir workdir: %w", err)
	}
	if err := os.Chown(dir, r.cfg.UID, r.cfg.GID); err != nil {
		return nil, fmt.Errorf("chown workdir: %w", err)
	}
	src := filepath.Join(dir, lang.file)
	if err := os.WriteFile(src, []byte(job.Source), 0o600); err != nil {
		return nil, fmt.Errorf("write source: %w", err)
	}
	if err := os.Chown(src, r.cfg.UID, r.cfg.GID); err != nil {
		return nil, fmt.Errorf("chown source: %w", err)
	}

	if lang.compile != nil {
		step, err := r.step(dir, lang.compile(job.MemoryMb), "", limits{
			cpuMs: lang.compileTimeMs, memoryMb: compileMemMb, nproc: 64, outputLimit: compileOutMax,
		})
		if err != nil {
			return nil, err
		}
		if step.Status != StatusOK {
			if step.Status != StatusSandboxFail {
				step.Status = StatusCE
			}
			res.Compile = step
			return res, nil
		}
		res.Compile = step
		res.Strays += r.killSandboxProcs()
	}

	for _, input := range job.Inputs {
		step, err := r.step(dir, lang.run(job.MemoryMb), input, limits{
			cpuMs: job.TimeMs, memoryMb: job.MemoryMb, nproc: lang.nproc, outputLimit: job.OutputLimit,
		})
		if err != nil {
			return nil, err
		}
		res.Tests = append(res.Tests, *step)
		// Anything the test left running (daemons, setsid escapes) dies before the next test.
		res.Strays += r.killSandboxProcs()
		if job.StopOnFailure && step.Status != StatusOK {
			break
		}
	}
	return res, nil
}

type limits struct {
	cpuMs, memoryMb, nproc, outputLimit int
}

// cappedBuffer keeps the first `limit` bytes and reports when more arrived.
type cappedBuffer struct {
	mu       sync.Mutex
	buf      bytes.Buffer
	limit    int
	overflow bool
	onFull   func()
}

func (c *cappedBuffer) Write(p []byte) (int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	room := c.limit - c.buf.Len()
	if room >= len(p) {
		c.buf.Write(p)
		return len(p), nil
	}
	if room > 0 {
		c.buf.Write(p[:room])
	}
	if !c.overflow {
		c.overflow = true
		if c.onFull != nil {
			go c.onFull()
		}
	}
	// Report success so the copier keeps draining instead of blocking the child on a full pipe.
	return len(p), nil
}

func (c *cappedBuffer) String() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.buf.String()
}

func (r *runner) step(dir string, argv []string, stdin string, lim limits) (*StepResult, error) {
	cgPath := "-"
	var cg *stepCgroup
	if r.cg != nil {
		var err error
		if cg, err = r.cg.newStep(lim.memoryMb, lim.nproc); err != nil {
			return nil, fmt.Errorf("cgroup: %w", err)
		}
		defer cg.remove()
		cgPath = cg.path
	}
	args := []string{
		itoa(lim.cpuMs), itoa(stackMb), itoa(fsizeMb), itoa(lim.nproc),
		itoa(r.cfg.UID), itoa(r.cfg.GID), dir, cgPath, "--",
	}
	cmd := exec.Command(r.cfg.KcExec, append(args, argv...)...)
	cmd.Env = []string{}
	cmd.Stdin = strings.NewReader(stdin)

	// kill may fire from the wall timer, the memory watch or the output cap. It must never outlive
	// this step: a late sweep would hit the next step's processes.
	var (
		killMu   sync.Mutex
		killed   bool
		finished bool
		reason   Status
		killWg   sync.WaitGroup
	)
	kill := func(why Status) {
		killMu.Lock()
		if killed || finished {
			killMu.Unlock()
			return
		}
		killed, reason = true, why
		killWg.Add(1)
		killMu.Unlock()
		defer killWg.Done()
		if cg != nil {
			cg.kill()
		}
		if cmd.Process != nil {
			// kc-exec calls setsid(), so its pid is the process group, which includes the sandbox's
			// PID-namespace init; when that dies the kernel kills everything left in the namespace.
			_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		}
		r.sweepOnce()
	}

	stdout := &cappedBuffer{limit: lim.outputLimit, onFull: func() { kill(StatusOLE) }}
	stderr := &cappedBuffer{limit: stderrLimit}
	cmd.Stdout = stdout
	cmd.Stderr = stderr
	// Once the program exits, don't wait for background processes still holding stdout open;
	// they're strays and the cleanup sweep kills them.
	cmd.WaitDelay = 100 * time.Millisecond

	start := time.Now()
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start kc-exec: %w", err)
	}

	// Wall clock: generous (sleeping or blocked programs burn no CPU), then kill.
	wall := time.Duration(lim.cpuMs)*2*time.Millisecond + time.Second
	wallTimer := time.AfterFunc(wall, func() { kill(StatusTLE) })

	// Memory and process watch: sums RSS over every sandbox-uid process (one job per box).
	done := make(chan struct{})
	var peakKb int64
	var peakMu sync.Mutex
	go func() {
		t := time.NewTicker(pollInterval)
		defer t.Stop()
		limitKb := int64(lim.memoryMb) << 10
		for {
			select {
			case <-done:
				return
			case <-t.C:
				rss, _ := sandboxRSSKb(r.cfg.UID)
				peakMu.Lock()
				if rss > peakKb {
					peakKb = rss
				}
				peakMu.Unlock()
				if rss > limitKb {
					kill(StatusMLE)
				}
			}
		}
	}()

	waitErr := cmd.Wait()
	elapsed := time.Since(start)
	wallTimer.Stop()
	close(done)
	killMu.Lock()
	finished = true
	killMu.Unlock()
	killWg.Wait()

	res := &StepResult{Stdout: stdout.String(), Stderr: stderr.String(), WallMs: elapsed.Milliseconds()}
	ps := cmd.ProcessState
	if ps == nil {
		return nil, fmt.Errorf("wait: %v", waitErr)
	}
	if ru, ok := ps.SysUsage().(*syscall.Rusage); ok {
		res.CPUMs = (ru.Utime.Nano() + ru.Stime.Nano()) / int64(time.Millisecond)
		res.MaxRSSKb = ru.Maxrss // kilobytes on Linux
	}
	peakMu.Lock()
	if peakKb > res.MaxRSSKb {
		res.MaxRSSKb = peakKb
	}
	peakMu.Unlock()

	ws, _ := ps.Sys().(syscall.WaitStatus)
	res.ExitCode = ps.ExitCode()
	if ws.Signaled() {
		res.Signal = ws.Signal().String()
	}

	killMu.Lock()
	killedFor := reason
	killMu.Unlock()
	if killedFor == "" && cg != nil && cg.oomKilled() {
		killedFor = StatusMLE
	}

	switch {
	case killedFor != "":
		res.Status = killedFor
	case ws.Signaled() && ws.Signal() == syscall.SIGXCPU:
		// RLIMIT_CPU fired. Rusage can read a hair under the limit, so trust the signal.
		res.Status = StatusTLE
	case ws.Signaled() && ws.Signal() == syscall.SIGKILL && res.CPUMs*100 >= int64(lim.cpuMs)*95:
		// The RLIMIT_CPU hard limit (SIGXCPU ignored by the program).
		res.Status = StatusTLE
	case res.CPUMs > int64(lim.cpuMs):
		res.Status = StatusTLE
	case res.MaxRSSKb > int64(lim.memoryMb)<<10:
		res.Status = StatusMLE
	case !ws.Signaled() && res.ExitCode >= 120 && res.ExitCode <= 127 && strings.HasPrefix(res.Stderr, "kc-exec:"):
		res.Status = StatusSandboxFail
	case res.ExitCode != 0 || ws.Signaled():
		res.Status = StatusRE
	default:
		res.Status = StatusOK
	}
	if stdout.overflow && res.Status == StatusOK {
		res.Status = StatusOLE
	}
	var exitErr *exec.ExitError
	if waitErr != nil && !errors.As(waitErr, &exitErr) && !errors.Is(waitErr, exec.ErrWaitDelay) {
		return nil, fmt.Errorf("wait: %w", waitErr)
	}
	return res, nil
}
