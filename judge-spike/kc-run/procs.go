package main

import (
	"bufio"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// sandboxPIDs lists processes whose real uid is the sandbox uid.
func sandboxPIDs(uid int) []int {
	entries, err := os.ReadDir("/proc")
	if err != nil {
		return nil
	}
	want := strconv.Itoa(uid)
	var pids []int
	for _, e := range entries {
		pid, err := strconv.Atoi(e.Name())
		if err != nil {
			continue
		}
		if procUID(pid) == want {
			pids = append(pids, pid)
		}
	}
	return pids
}

func procUID(pid int) string {
	f, err := os.Open("/proc/" + strconv.Itoa(pid) + "/status")
	if err != nil {
		return ""
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	for s.Scan() {
		if line := s.Text(); strings.HasPrefix(line, "Uid:") {
			if fields := strings.Fields(line); len(fields) > 1 {
				return fields[1]
			}
		}
	}
	return ""
}

// sandboxRSSKb sums resident memory over all sandbox processes (threads share their process's RSS).
func sandboxRSSKb(uid int) (int64, int) {
	var total int64
	pids := sandboxPIDs(uid)
	for _, pid := range pids {
		data, err := os.ReadFile("/proc/" + strconv.Itoa(pid) + "/statm")
		if err != nil {
			continue
		}
		fields := strings.Fields(string(data))
		if len(fields) < 2 {
			continue
		}
		pages, _ := strconv.ParseInt(fields[1], 10, 64)
		total += pages * int64(os.Getpagesize()) / 1024
	}
	return total, len(pids)
}

// killSandboxProcs kills every sandbox-uid process and waits until they're gone (tini reaps them).
// It returns how many were alive when it started.
func (r *runner) killSandboxProcs() int {
	found := len(livePIDs(r.cfg.UID))
	for round := 0; round < 100; round++ {
		if len(livePIDs(r.cfg.UID)) == 0 && len(sandboxPIDs(r.cfg.UID)) == 0 {
			return found
		}
		r.sweepOnce()
		time.Sleep(5 * time.Millisecond)
	}
	return found
}

// sweepOnce SIGKILLs every sandbox-uid process in one atomic pass (see kc-exec --kill-uid).
func (r *runner) sweepOnce() {
	_ = exec.Command(r.cfg.KcExec, "--kill-uid", itoa(r.cfg.UID), itoa(r.cfg.GID)).Run()
}

// livePIDs is sandboxPIDs minus zombies, which are already dead and only wait to be reaped.
func livePIDs(uid int) []int {
	var live []int
	for _, pid := range sandboxPIDs(uid) {
		data, err := os.ReadFile("/proc/" + strconv.Itoa(pid) + "/stat")
		if err != nil {
			continue
		}
		// Format: pid (comm) state ... ; comm may contain spaces or parens, so split after the last ')'.
		if i := strings.LastIndexByte(string(data), ')'); i >= 0 && i+2 < len(data) && data[i+2] == 'Z' {
			continue
		}
		live = append(live, pid)
	}
	return live
}

// cleanup kills sandbox processes and deletes everything the sandbox uid could have written.
func (r *runner) cleanup(dir string) int {
	n := r.killSandboxProcs()
	_ = os.RemoveAll(dir)
	for _, shared := range []string{"/tmp", "/var/tmp", "/dev/shm"} {
		removeOwnedBy(shared, r.cfg.UID)
	}
	return n
}

func removeOwnedBy(root string, uid int) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return
	}
	for _, e := range entries {
		p := filepath.Join(root, e.Name())
		info, err := os.Lstat(p)
		if err != nil {
			continue
		}
		if st, ok := info.Sys().(*syscall.Stat_t); ok && int(st.Uid) == uid {
			_ = os.RemoveAll(p)
		}
	}
}
