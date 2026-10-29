package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// cgroups gives each step a cgroup v2 with kernel-enforced memory and process limits, exact peak
// memory, and an atomic kill switch. On Cloudflare every process holds root's capabilities, so
// RLIMIT_NPROC can't stop a fork bomb there; pids.max can. Without cgroup v2 (e.g. local Docker on
// a cgroup v1 host) kc-run falls back to RSS polling and per-process kills.
type cgroups struct {
	root string
	seq  int
}

const cgroupRoot = "/sys/fs/cgroup"

func setupCgroups() *cgroups {
	controllers, err := os.ReadFile(filepath.Join(cgroupRoot, "cgroup.controllers"))
	if err != nil {
		log.Printf("cgroups: v2 not available (%v); using RSS polling", err)
		return nil
	}
	have := strings.Fields(string(controllers))
	if !contains(have, "memory") || !contains(have, "pids") {
		log.Printf("cgroups: memory/pids controllers missing (%v); using RSS polling", have)
		return nil
	}
	// cgroup v2 forbids processes in a cgroup that delegates controllers (outside the true root),
	// so move tini and kc-run into a leaf first.
	sup := filepath.Join(cgroupRoot, "kc-supervisor")
	if err := os.MkdirAll(sup, 0o755); err != nil {
		log.Printf("cgroups: %v; using RSS polling", err)
		return nil
	}
	procs, _ := os.ReadFile(filepath.Join(cgroupRoot, "cgroup.procs"))
	for _, pid := range strings.Fields(string(procs)) {
		_ = os.WriteFile(filepath.Join(sup, "cgroup.procs"), []byte(pid), 0o644)
	}
	if err := os.WriteFile(filepath.Join(cgroupRoot, "cgroup.subtree_control"), []byte("+memory +pids"), 0o644); err != nil {
		log.Printf("cgroups: enabling controllers: %v; using RSS polling", err)
		return nil
	}
	log.Printf("cgroups: v2 enabled (memory, pids)")
	return &cgroups{root: cgroupRoot}
}

func contains(xs []string, x string) bool {
	for _, y := range xs {
		if y == x {
			return true
		}
	}
	return false
}

type stepCgroup struct{ path string }

// newStep creates a cgroup for one step. memory.max gets a little headroom over the limit so the
// verdict comes from memory.peak (exact) rather than from where the OOM killer happened to strike.
func (c *cgroups) newStep(memoryMb, nproc int) (*stepCgroup, error) {
	c.seq++
	path := filepath.Join(c.root, fmt.Sprintf("kc-step-%d", c.seq))
	if err := os.Mkdir(path, 0o755); err != nil {
		return nil, err
	}
	write := func(file, val string) error { return os.WriteFile(filepath.Join(path, file), []byte(val), 0o644) }
	if err := write("memory.max", strconv.Itoa((memoryMb+32)<<20)); err != nil {
		return nil, err
	}
	_ = write("memory.swap.max", "0")
	if err := write("pids.max", strconv.Itoa(nproc)); err != nil {
		return nil, err
	}
	return &stepCgroup{path: path}, nil
}

func (s *stepCgroup) read(file string) string {
	b, _ := os.ReadFile(filepath.Join(s.path, file))
	return strings.TrimSpace(string(b))
}

// peakKb is the highest memory use of the whole step, including page cache it caused and tmpfs.
func (s *stepCgroup) peakKb() int64 {
	v, _ := strconv.ParseInt(s.read("memory.peak"), 10, 64)
	return v / 1024
}

func (s *stepCgroup) oomKilled() bool {
	for _, line := range strings.Split(s.read("memory.events"), "\n") {
		if f := strings.Fields(line); len(f) == 2 && f[0] == "oom_kill" && f[1] != "0" {
			return true
		}
	}
	return false
}

func (s *stepCgroup) pidsLimited() bool {
	for _, line := range strings.Split(s.read("pids.events"), "\n") {
		if f := strings.Fields(line); len(f) == 2 && f[0] == "max" && f[1] != "0" {
			return true
		}
	}
	return false
}

// kill SIGKILLs every process in the cgroup at once (cgroup.kill, Linux 5.14+).
func (s *stepCgroup) kill() {
	_ = os.WriteFile(filepath.Join(s.path, "cgroup.kill"), []byte("1"), 0o644)
}

// remove waits for the cgroup to empty, then deletes it.
func (s *stepCgroup) remove() {
	for i := 0; i < 200; i++ {
		if s.read("cgroup.procs") == "" {
			break
		}
		s.kill()
		time.Sleep(5 * time.Millisecond)
	}
	if err := syscall.Rmdir(s.path); err != nil {
		log.Printf("cgroups: rmdir %s: %v", s.path, err)
	}
}
