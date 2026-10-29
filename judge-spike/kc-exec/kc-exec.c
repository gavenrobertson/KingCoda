/*
 * kc-exec: the last trusted step before user code runs.
 *
 *   kc-exec <cpu_ms> <stack_mb> <fsize_mb> <nproc> <uid> <gid> <workdir> <cgroup|-> -- <argv...>
 *
 * Threat model: the code is hostile, and on Cloudflare's durable_object scheduling policy every
 * process keeps root's capabilities whatever its uid. So isolation can't rest on users or file
 * permissions. Instead kc-exec (running as root, forked by kc-run):
 *
 *   1. starts a new session (kc-run kills the whole process group on timeout),
 *   2. clones the user process into new PID, mount, network, IPC and UTS namespaces. It is PID 1
 *      there, so when it exits every process it left behind dies with it, and it can't see or
 *      signal kc-run,
 *   3. inside, builds a minimal root: read-only /usr and /etc, the job directory as /work, a
 *      private /tmp, four device nodes, and a /proc that shows only the sandbox's own processes,
 *      then pivot_roots into it so the real filesystem is unreachable,
 *   4. joins the step's cgroup (memory and process limits enforced by the kernel) when kc-run
 *      provides one,
 *   5. sets resource limits, drops what privileges it can (uid, groups, capabilities),
 *      sets no-new-privs, and installs a seccomp filter written for a process that may hold every
 *      capability: no namespaces, mounts, raising limits, device nodes, real-time scheduling,
 *      tracing, network sockets or kernel-facing calls,
 *   6. execve with an empty, fixed environment.
 *
 * kc-exec waits for the user process and exits the same way it did (exit code or signal), so
 * kc-run's wait4 sees the real outcome and rusage. Failures to build the sandbox exit 120-127 with
 * a "kc-exec:" message, which kc-run reports as a judge error, never as the user's fault.
 */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <grp.h>
#include <linux/audit.h>
#include <linux/capability.h>
#include <linux/filter.h>
#include <linux/sched.h>
#include <linux/seccomp.h>
#include <linux/securebits.h>
#include <sched.h>
#include <signal.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mount.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <sys/wait.h>
#include <unistd.h>

#if !defined(__x86_64__)
#error "kc-exec's seccomp filter is written for x86_64"
#endif

#define JAIL "/opt/kc/jail"

static void die(int code, const char *what) {
  dprintf(2, "kc-exec: %s: %s\n", what, strerror(errno));
  _exit(code);
}

static long arg_num(const char *s, const char *name) {
  char *end;
  errno = 0;
  long v = strtol(s, &end, 10);
  if (errno || *end || v < 0) {
    dprintf(2, "kc-exec: bad %s: %s\n", name, s);
    _exit(120);
  }
  return v;
}

/* ── jail ─────────────────────────────────────────────────────────────── */

static void xmount(const char *src, const char *dst, const char *type, unsigned long flags, const char *data) {
  if (mount(src, dst, type, flags, data) != 0) {
    dprintf(2, "kc-exec: mount %s on %s: %s\n", src ? src : "(none)", dst, strerror(errno));
    _exit(122);
  }
}

static void xmkdir(const char *path, mode_t mode) {
  if (mkdir(path, mode) != 0 && errno != EEXIST) die(122, path);
}

/* Bind src at JAIL/dst; read-only unless writable. Always nosuid and nodev. */
static void jail_bind(const char *src, const char *dst, int writable) {
  char path[512];
  snprintf(path, sizeof path, JAIL "%s", dst);
  xmount(src, path, NULL, MS_BIND | MS_REC, NULL);
  unsigned long flags = MS_BIND | MS_REMOUNT | MS_NOSUID | MS_NODEV | (writable ? 0 : MS_RDONLY);
  xmount(NULL, path, NULL, flags, NULL);
}

/* /bin, /lib, ... are symlinks into /usr on Debian; mirror whatever the image has. */
static void mirror_top(const char *name) {
  char host[64], jail[128], target[256];
  snprintf(host, sizeof host, "/%s", name);
  snprintf(jail, sizeof jail, JAIL "/%s", name);
  struct stat st;
  if (lstat(host, &st) != 0) return;
  if (S_ISLNK(st.st_mode)) {
    ssize_t n = readlink(host, target, sizeof target - 1);
    if (n < 0) die(122, "readlink");
    target[n] = 0;
    if (symlink(target, jail) != 0) die(122, "symlink");
  } else if (S_ISDIR(st.st_mode)) {
    xmkdir(jail, 0755);
    jail_bind(host, host, 0);
  }
}

static void device(const char *name) {
  char host[64], jail[128];
  snprintf(host, sizeof host, "/dev/%s", name);
  snprintf(jail, sizeof jail, JAIL "/dev/%s", name);
  int fd = open(jail, O_CREAT | O_WRONLY | O_CLOEXEC, 0666);
  if (fd < 0) die(122, jail);
  close(fd);
  xmount(host, jail, NULL, MS_BIND, NULL);
  xmount(NULL, jail, NULL, MS_BIND | MS_REMOUNT | MS_NOSUID | MS_NOEXEC, NULL);
}

static void build_jail(const char *workdir) {
  xmount(NULL, "/", NULL, MS_REC | MS_PRIVATE, NULL);
  xmount("tmpfs", JAIL, "tmpfs", MS_NOSUID | MS_NODEV, "size=1m,mode=0755");

  xmkdir(JAIL "/usr", 0755);
  jail_bind("/usr", "/usr", 0);
  xmkdir(JAIL "/etc", 0755);
  jail_bind("/etc", "/etc", 0);
  mirror_top("bin");
  mirror_top("sbin");
  mirror_top("lib");
  mirror_top("lib64");

  xmkdir(JAIL "/work", 0755);
  char work_src[512];
  snprintf(work_src, sizeof work_src, "%s", workdir);
  xmount(work_src, JAIL "/work", NULL, MS_BIND, NULL);
  xmount(NULL, JAIL "/work", NULL, MS_BIND | MS_REMOUNT | MS_NOSUID | MS_NODEV, NULL);

  xmkdir(JAIL "/tmp", 01777);
  xmount("tmpfs", JAIL "/tmp", "tmpfs", MS_NOSUID | MS_NODEV, "size=64m,mode=1777");

  xmkdir(JAIL "/dev", 0755);
  xmount("tmpfs", JAIL "/dev", "tmpfs", MS_NOSUID | MS_NOEXEC, "size=64k,mode=0755");
  device("null");
  device("zero");
  device("random");
  device("urandom");
  if (symlink("/proc/self/fd", JAIL "/dev/fd") != 0) die(122, "symlink fd");
  if (symlink("/proc/self/fd/0", JAIL "/dev/stdin") != 0) die(122, "symlink stdin");
  if (symlink("/proc/self/fd/1", JAIL "/dev/stdout") != 0) die(122, "symlink stdout");
  if (symlink("/proc/self/fd/2", JAIL "/dev/stderr") != 0) die(122, "symlink stderr");

  /* Only this PID namespace's processes, and none of /proc/sys, /proc/sysrq-trigger, /proc/kmsg. */
  xmkdir(JAIL "/proc", 0555);
  xmount("proc", JAIL "/proc", "proc", MS_NOSUID | MS_NODEV | MS_NOEXEC, "subset=pid,hidepid=invisible");

  /* Freeze the skeleton itself, then make it the root. */
  xmount(NULL, JAIL, NULL, MS_REMOUNT | MS_RDONLY | MS_NOSUID | MS_NODEV, "size=1m,mode=0755");
  if (chdir(JAIL) != 0) die(122, "chdir jail");
  if (syscall(SYS_pivot_root, ".", ".") != 0) die(122, "pivot_root");
  if (umount2(".", MNT_DETACH) != 0) die(122, "umount old root");
  if (chdir("/work") != 0) die(122, "chdir /work");
  if (sethostname("kingcoda", 8) != 0) die(122, "sethostname");
}

static void join_cgroup(const char *cgroup) {
  if (strcmp(cgroup, "-") == 0) return;
  char path[512];
  snprintf(path, sizeof path, "%s/cgroup.procs", cgroup);
  int fd = open(path, O_WRONLY | O_CLOEXEC);
  if (fd < 0) die(122, "open cgroup.procs");
  if (write(fd, "0", 1) != 1) die(122, "join cgroup");
  close(fd);
}

/* ── privileges ───────────────────────────────────────────────────────── */

static void set_limit(int resource, rlim_t soft, rlim_t hard, const char *name) {
  struct rlimit rl = {soft, hard};
  if (setrlimit(resource, &rl) != 0) die(121, name);
}

/* Drops what the kernel lets us drop. On Cloudflare's durable_object policy capabilities survive
 * this; the namespaces, the read-only jail and the seccomp filter don't rely on it. */
static void drop_privileges(uid_t uid, gid_t gid) {
  for (int cap = 0; cap <= 63; cap++) {
    if (prctl(PR_CAPBSET_DROP, cap, 0, 0, 0) != 0 && errno == EINVAL) break;
  }
  prctl(PR_CAP_AMBIENT, PR_CAP_AMBIENT_CLEAR_ALL, 0, 0, 0);
  prctl(PR_SET_SECUREBITS, SECBIT_NOROOT | SECBIT_NOROOT_LOCKED | SECBIT_NO_SETUID_FIXUP_LOCKED |
                               SECBIT_KEEP_CAPS_LOCKED | SECBIT_NO_CAP_AMBIENT_RAISE |
                               SECBIT_NO_CAP_AMBIENT_RAISE_LOCKED,
        0, 0, 0);
  if (setgroups(0, NULL) != 0) die(123, "setgroups");
  if (setresgid(gid, gid, gid) != 0) die(123, "setresgid");
  if (setresuid(uid, uid, uid) != 0) die(123, "setresuid");
}

/* ── seccomp ──────────────────────────────────────────────────────────── */

#define ALLOW BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW)
#define DENY_EPERM BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | (EPERM & SECCOMP_RET_DATA))
#define DENY_ENOSYS BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | (ENOSYS & SECCOMP_RET_DATA))
#define LOAD_NR BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr))
#define LOAD_ARG(n) BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, args[n]))
#define LOAD_ARG_HI(n) BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, args[n]) + 4)
/* if (nr == N) return EPERM; */
#define BLOCK(nr) BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, (nr), 0, 1), DENY_EPERM

#define NS_FLAGS (CLONE_NEWUSER | CLONE_NEWPID | CLONE_NEWNET | CLONE_NEWNS | CLONE_NEWUTS | CLONE_NEWIPC | CLONE_NEWCGROUP)

static void install_seccomp(void) {
  struct sock_filter filter[] = {
      /* Native x86_64 ABI only (kills i386 and x32 tricks). */
      BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, arch)),
      BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, AUDIT_ARCH_X86_64, 1, 0),
      BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_KILL_PROCESS),
      LOAD_NR,
      BPF_JUMP(BPF_JMP | BPF_JGE | BPF_K, 0x40000000, 0, 1),
      BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_KILL_PROCESS),

      /* socket(): AF_UNIX only. */
      BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_socket, 0, 4),
      LOAD_ARG(0),
      BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, AF_UNIX, 0, 1),
      ALLOW,
      DENY_EPERM,
      LOAD_NR,

      /* clone3 can't be inspected; ENOSYS makes libc fall back to clone(). */
      BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_clone3, 0, 1),
      DENY_ENOSYS,

      /* clone() with any namespace flag. */
      BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_clone, 0, 4),
      LOAD_ARG(0),
      BPF_JUMP(BPF_JMP | BPF_JSET | BPF_K, NS_FLAGS, 0, 1),
      DENY_EPERM,
      LOAD_NR,

      /* prlimit64(pid, res, new, old): reading is fine (glibc's getrlimit uses it), setting isn't.
       * With CAP_SYS_RESOURCE a process could otherwise lift its own CPU and process limits. */
      BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_prlimit64, 0, 6),
      LOAD_ARG(2),
      BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, 0, 0, 3),
      LOAD_ARG_HI(2),
      BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, 0, 0, 1),
      ALLOW,
      DENY_EPERM,

      /* prctl(PR_SET_MM, ...) rewrites memory map metadata (needs CAP_SYS_RESOURCE). */
      LOAD_NR,
      BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_prctl, 0, 4),
      LOAD_ARG(0),
      BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, PR_SET_MM, 0, 1),
      DENY_EPERM,
      LOAD_NR,

      /* Limits, scheduling, memory placement. */
      BLOCK(__NR_setrlimit), BLOCK(__NR_sched_setscheduler), BLOCK(__NR_sched_setparam), BLOCK(__NR_sched_setattr),
      BLOCK(__NR_setpriority), BLOCK(__NR_ioprio_set), BLOCK(__NR_mlock), BLOCK(__NR_mlock2), BLOCK(__NR_mlockall),
      BLOCK(__NR_move_pages), BLOCK(__NR_migrate_pages), BLOCK(__NR_process_madvise),
      /* Device nodes (with CAP_MKNOD a process could make /dev/sda in /tmp). */
      BLOCK(__NR_mknod), BLOCK(__NR_mknodat),
      /* Tracing and other processes' memory. */
      BLOCK(__NR_ptrace), BLOCK(__NR_process_vm_readv), BLOCK(__NR_process_vm_writev), BLOCK(__NR_kcmp),
      /* Filesystems and namespaces. */
      BLOCK(__NR_mount), BLOCK(__NR_umount2), BLOCK(__NR_pivot_root), BLOCK(__NR_chroot), BLOCK(__NR_unshare),
      BLOCK(__NR_setns), BLOCK(__NR_open_by_handle_at), BLOCK(__NR_name_to_handle_at), BLOCK(__NR_move_mount),
      BLOCK(__NR_open_tree), BLOCK(__NR_fsopen), BLOCK(__NR_fsmount), BLOCK(__NR_fsconfig), BLOCK(__NR_fspick),
      BLOCK(__NR_mount_setattr), BLOCK(__NR_quotactl), BLOCK(__NR_quotactl_fd), BLOCK(__NR_swapon), BLOCK(__NR_swapoff),
      /* Identity and capabilities. */
      BLOCK(__NR_setuid), BLOCK(__NR_setgid), BLOCK(__NR_setreuid), BLOCK(__NR_setregid), BLOCK(__NR_setresuid),
      BLOCK(__NR_setresgid), BLOCK(__NR_setgroups), BLOCK(__NR_setfsuid), BLOCK(__NR_setfsgid), BLOCK(__NR_capset),
      /* Kernel-facing. */
      BLOCK(__NR_keyctl), BLOCK(__NR_add_key), BLOCK(__NR_request_key), BLOCK(__NR_bpf), BLOCK(__NR_perf_event_open),
      BLOCK(__NR_userfaultfd), BLOCK(__NR_io_uring_setup), BLOCK(__NR_io_uring_enter), BLOCK(__NR_io_uring_register),
      BLOCK(__NR_kexec_load), BLOCK(__NR_kexec_file_load), BLOCK(__NR_init_module), BLOCK(__NR_finit_module),
      BLOCK(__NR_delete_module), BLOCK(__NR_reboot), BLOCK(__NR_acct), BLOCK(__NR_settimeofday),
      BLOCK(__NR_clock_settime), BLOCK(__NR_clock_adjtime), BLOCK(__NR_adjtimex), BLOCK(__NR_iopl),
      BLOCK(__NR_ioperm), BLOCK(__NR_sethostname), BLOCK(__NR_setdomainname), BLOCK(__NR_vhangup),
      BLOCK(__NR_syslog), BLOCK(__NR_fanotify_init), BLOCK(__NR_lookup_dcookie),
      ALLOW,
  };
  struct sock_fprog prog = {(unsigned short)(sizeof(filter) / sizeof(filter[0])), filter};
  if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0) die(124, "no_new_privs");
  if (syscall(SYS_seccomp, SECCOMP_SET_MODE_FILTER, 0, &prog) != 0) die(125, "seccomp");
}

/* ── user process ─────────────────────────────────────────────────────── */

struct config {
  long cpu_ms, stack_mb, fsize_mb, nproc;
  uid_t uid;
  gid_t gid;
  const char *workdir, *cgroup;
  char **argv;
};

static char child_stack[1 << 20] __attribute__((aligned(16)));

static int child_main(void *arg) {
  struct config *c = arg;
  /* If kc-exec dies (kc-run killed the group), take the whole namespace down with it. */
  if (prctl(PR_SET_PDEATHSIG, SIGKILL) != 0) die(121, "pdeathsig");

  join_cgroup(c->cgroup);
  build_jail(c->workdir);

  /* CPU seconds round up; kc-run enforces the precise millisecond limit from rusage. */
  rlim_t cpu_s = (rlim_t)((c->cpu_ms + 999) / 1000);
  set_limit(RLIMIT_CPU, cpu_s, cpu_s + 1, "RLIMIT_CPU");
  set_limit(RLIMIT_STACK, (rlim_t)c->stack_mb << 20, (rlim_t)c->stack_mb << 20, "RLIMIT_STACK");
  set_limit(RLIMIT_FSIZE, (rlim_t)c->fsize_mb << 20, (rlim_t)c->fsize_mb << 20, "RLIMIT_FSIZE");
  set_limit(RLIMIT_NPROC, (rlim_t)c->nproc, (rlim_t)c->nproc, "RLIMIT_NPROC");
  set_limit(RLIMIT_NOFILE, 64, 64, "RLIMIT_NOFILE");
  set_limit(RLIMIT_CORE, 0, 0, "RLIMIT_CORE");
  set_limit(RLIMIT_MEMLOCK, 0, 0, "RLIMIT_MEMLOCK");
  set_limit(RLIMIT_MSGQUEUE, 0, 0, "RLIMIT_MSGQUEUE");

  drop_privileges(c->uid, c->gid);
  install_seccomp();

  char *envp[] = {"PATH=/usr/local/bin:/usr/bin:/bin", "HOME=/tmp", "TMPDIR=/tmp", "LANG=C.UTF-8",
                  "PYTHONDONTWRITEBYTECODE=1", "PYTHONHASHSEED=0", NULL};
  execve(c->argv[0], c->argv, envp);
  die(126, "execve");
  return 126;
}

int main(int argc, char **argv) {
  if (argc < 11 || strcmp(argv[9], "--") != 0) {
    dprintf(2, "usage: kc-exec <cpu_ms> <stack_mb> <fsize_mb> <nproc> <uid> <gid> <workdir> <cgroup|-> -- <argv...>\n");
    return 120;
  }
  struct config c = {
      .cpu_ms = arg_num(argv[1], "cpu_ms"),
      .stack_mb = arg_num(argv[2], "stack_mb"),
      .fsize_mb = arg_num(argv[3], "fsize_mb"),
      .nproc = arg_num(argv[4], "nproc"),
      .uid = (uid_t)arg_num(argv[5], "uid"),
      .gid = (gid_t)arg_num(argv[6], "gid"),
      .workdir = argv[7],
      .cgroup = argv[8],
      .argv = &argv[10],
  };
  if (c.uid == 0 || c.gid == 0) {
    dprintf(2, "kc-exec: refusing to run user code as root\n");
    return 120;
  }
  if (setsid() < 0) die(121, "setsid");
  set_limit(RLIMIT_CORE, 0, 0, "RLIMIT_CORE");

  int flags = CLONE_NEWPID | CLONE_NEWNS | CLONE_NEWNET | CLONE_NEWIPC | CLONE_NEWUTS | SIGCHLD;
  pid_t pid = clone(child_main, child_stack + sizeof child_stack, flags, &c);
  if (pid < 0) die(121, "clone namespaces");

  int status;
  while (waitpid(pid, &status, 0) < 0) {
    if (errno != EINTR) die(127, "waitpid");
  }
  if (WIFEXITED(status)) _exit(WEXITSTATUS(status));
  /* Re-raise the same signal so kc-run sees exactly how the program died. */
  int sig = WTERMSIG(status);
  signal(sig, SIG_DFL);
  sigset_t set;
  sigemptyset(&set);
  sigaddset(&set, sig);
  sigprocmask(SIG_UNBLOCK, &set, NULL);
  raise(sig);
  _exit(128 + sig);
}
