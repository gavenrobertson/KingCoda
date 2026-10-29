package main

import (
	"os"
	"os/exec"
	"runtime"
	"strings"
)

// introspect reports facts the spike needs to settle D3: what the box's root actually holds,
// and what a sandboxed process ends up with.
func introspect(cfg config) map[string]any {
	read := func(p string) string {
		b, err := os.ReadFile(p)
		if err != nil {
			return "error: " + err.Error()
		}
		return strings.TrimSpace(string(b))
	}
	statusField := func(field string) string {
		for _, line := range strings.Split(read("/proc/self/status"), "\n") {
			if strings.HasPrefix(line, field+":") {
				return strings.TrimSpace(strings.TrimPrefix(line, field+":"))
			}
		}
		return ""
	}
	sandboxed := ""
	out, err := exec.Command(cfg.KcExec, "1000", "64", "1", "8", itoa(cfg.UID), itoa(cfg.GID), "/", "--",
		"/bin/sh", "-c", "id; grep -E '^(Cap|NoNewPrivs|Seccomp)' /proc/self/status").CombinedOutput()
	sandboxed = string(out)
	if err != nil {
		sandboxed += "\nerror: " + err.Error()
	}
	return map[string]any{
		"kernel":            read("/proc/sys/kernel/osrelease"),
		"cpus":              runtime.NumCPU(),
		"memTotal":          strings.Fields(read("/proc/meminfo") + " ? ?")[1],
		"rootUid":           os.Getuid(),
		"rootCapEff":        statusField("CapEff"),
		"rootCapBnd":        statusField("CapBnd"),
		"rootSeccomp":       statusField("Seccomp"),
		"userNsMax":         read("/proc/sys/user/max_user_namespaces"),
		"unprivUserNsClone": read("/proc/sys/kernel/unprivileged_userns_clone"),
		"cgroupControllers": read("/sys/fs/cgroup/cgroup.controllers"),
		"sandboxedProcess":  sandboxed,
	}
}
