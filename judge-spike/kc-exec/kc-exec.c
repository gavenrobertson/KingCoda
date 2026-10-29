/*
 * kc-exec: the last trusted step before user code runs.
 *
 *   kc-exec <cpu_ms> <stack_mb> <fsize_mb> <nproc> <uid> <gid> <workdir> -- <argv...>
 *
 * Runs as root (forked by kc-run), then in order:
 *   1. new session + process group (so the supervisor can kill the whole tree),
 *   2. resource limits (CPU, stack, file size, processes, open files, no core dumps),
 *   3. clears supplementary groups and drops to <uid>:<gid> (no capabilities remain),
 *   4. PR_SET_NO_NEW_PRIVS, then a seccomp filter that denies network sockets,
 *      privilege changes, namespaces, mounts, tracing and kernel-facing syscalls,
 *   5. execve with an empty, fixed environment.
 * Any failure exits 120-127 so kc-run can report "Judge Error" rather than blame the user.
 *
 *   kc-exec --kill-uid <uid> <gid>
 *
 * Drops to <uid> and sends SIGKILL to every process of that uid in one kill(-1) call. The kernel
 * walks the task list under a lock that fork() also needs, so a fork bomb can't respawn mid-sweep
 * the way it can when processes are killed one by one.
 */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <grp.h>
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/seccomp.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <sys/socket.h>
#include <signal.h>
#include <sys/syscall.h>
#include <unistd.h>

#if !defined(__x86_64__)
#error "kc-exec's seccomp filter is written for x86_64"
#endif

static void die(int code, const char *what) {
  dprintf(2, "kc-exec: %s: %s\n", what, strerror(errno));
  _exit(code);
}

static void set_limit(int resource, rlim_t soft, rlim_t hard, const char *name) {
  struct rlimit rl = {soft, hard};
  if (setrlimit(resource, &rl) != 0) die(121, name);
}

#define ALLOW BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ALLOW)
#define DENY_EPERM BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | (EPERM & SECCOMP_RET_DATA))
#define DENY_ENOSYS BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_ERRNO | (ENOSYS & SECCOMP_RET_DATA))
/* if (nr == N) return EPERM; */
#define BLOCK(nr) BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, (nr), 0, 1), DENY_EPERM

static void install_seccomp(void) {
  struct sock_filter filter[] = {
      /* Kill anything that isn't the native x86_64 ABI (blocks i386 and x32 tricks). */
      BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, arch)),
      BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, AUDIT_ARCH_X86_64, 1, 0),
      BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_KILL_PROCESS),
      BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),
      BPF_JUMP(BPF_JMP | BPF_JGE | BPF_K, 0x40000000, 0, 1), /* x32 syscall bit */
      BPF_STMT(BPF_RET | BPF_K, SECCOMP_RET_KILL_PROCESS),

      /* socket(): only AF_UNIX (language runtimes use socketpair/unix sockets internally). */
      BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_socket, 0, 4),
      BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, args[0])),
      BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, AF_UNIX, 0, 1),
      ALLOW,
      DENY_EPERM,
      BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),

      /* clone3 can't be inspected by BPF; ENOSYS makes libc fall back to clone(). */
      BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_clone3, 0, 1),
      DENY_ENOSYS,

      /* clone() with any namespace flag is denied; threads and fork are fine. */
      BPF_JUMP(BPF_JMP | BPF_JEQ | BPF_K, __NR_clone, 0, 4),
      BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, args[0])),
      BPF_JUMP(BPF_JMP | BPF_JSET | BPF_K,
               0x10000000 /*NEWUSER*/ | 0x20000000 /*NEWPID*/ | 0x40000000 /*NEWNET*/ | 0x00020000 /*NEWNS*/ |
                   0x04000000 /*NEWUTS*/ | 0x08000000 /*NEWIPC*/ | 0x02000000 /*NEWCGROUP*/,
               0, 1),
      DENY_EPERM,
      BPF_STMT(BPF_LD | BPF_W | BPF_ABS, offsetof(struct seccomp_data, nr)),

      BLOCK(__NR_ptrace), BLOCK(__NR_process_vm_readv), BLOCK(__NR_process_vm_writev), BLOCK(__NR_kcmp),
      BLOCK(__NR_mount), BLOCK(__NR_umount2), BLOCK(__NR_pivot_root), BLOCK(__NR_chroot),
      BLOCK(__NR_unshare), BLOCK(__NR_setns), BLOCK(__NR_open_by_handle_at), BLOCK(__NR_name_to_handle_at),
      BLOCK(__NR_setuid), BLOCK(__NR_setgid), BLOCK(__NR_setreuid), BLOCK(__NR_setregid),
      BLOCK(__NR_setresuid), BLOCK(__NR_setresgid), BLOCK(__NR_setgroups), BLOCK(__NR_setfsuid),
      BLOCK(__NR_setfsgid), BLOCK(__NR_capset),
      BLOCK(__NR_keyctl), BLOCK(__NR_add_key), BLOCK(__NR_request_key), BLOCK(__NR_bpf),
      BLOCK(__NR_perf_event_open), BLOCK(__NR_userfaultfd), BLOCK(__NR_io_uring_setup),
      BLOCK(__NR_io_uring_enter), BLOCK(__NR_io_uring_register),
      BLOCK(__NR_kexec_load), BLOCK(__NR_kexec_file_load), BLOCK(__NR_init_module), BLOCK(__NR_finit_module),
      BLOCK(__NR_delete_module), BLOCK(__NR_reboot), BLOCK(__NR_swapon), BLOCK(__NR_swapoff),
      BLOCK(__NR_acct), BLOCK(__NR_settimeofday), BLOCK(__NR_clock_settime), BLOCK(__NR_clock_adjtime),
      BLOCK(__NR_adjtimex), BLOCK(__NR_iopl), BLOCK(__NR_ioperm), BLOCK(__NR_quotactl),
      BLOCK(__NR_sethostname), BLOCK(__NR_setdomainname), BLOCK(__NR_vhangup), BLOCK(__NR_syslog),
      BLOCK(__NR_fanotify_init), BLOCK(__NR_lookup_dcookie), BLOCK(__NR_move_mount), BLOCK(__NR_open_tree),
      BLOCK(__NR_fsopen), BLOCK(__NR_fsmount), BLOCK(__NR_fsconfig), BLOCK(__NR_fspick),
      ALLOW,
  };
  struct sock_fprog prog = {(unsigned short)(sizeof(filter) / sizeof(filter[0])), filter};
  if (prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0) die(124, "no_new_privs");
  if (syscall(SYS_seccomp, SECCOMP_SET_MODE_FILTER, 0, &prog) != 0) die(125, "seccomp");
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

static int kill_uid(uid_t uid, gid_t gid) {
  if (uid == 0) return 120;
  if (setgroups(0, NULL) != 0) die(123, "setgroups");
  if (setresgid(gid, gid, gid) != 0) die(123, "setresgid");
  if (setresuid(uid, uid, uid) != 0) die(123, "setresuid");
  /* kill(-1) as a non-root user reaches exactly that user's processes, never this one. */
  if (kill(-1, SIGKILL) != 0 && errno != ESRCH) die(127, "kill");
  return 0;
}

int main(int argc, char **argv) {
  if (argc == 4 && strcmp(argv[1], "--kill-uid") == 0) {
    return kill_uid((uid_t)arg_num(argv[2], "uid"), (gid_t)arg_num(argv[3], "gid"));
  }
  if (argc < 10 || strcmp(argv[8], "--") != 0) {
    dprintf(2, "usage: kc-exec <cpu_ms> <stack_mb> <fsize_mb> <nproc> <uid> <gid> <workdir> -- <argv...>\n");
    return 120;
  }
  long cpu_ms = arg_num(argv[1], "cpu_ms");
  long stack_mb = arg_num(argv[2], "stack_mb");
  long fsize_mb = arg_num(argv[3], "fsize_mb");
  long nproc = arg_num(argv[4], "nproc");
  uid_t uid = (uid_t)arg_num(argv[5], "uid");
  gid_t gid = (gid_t)arg_num(argv[6], "gid");
  const char *workdir = argv[7];
  if (uid == 0 || gid == 0) {
    dprintf(2, "kc-exec: refusing to run user code as root\n");
    return 120;
  }

  if (setsid() < 0) die(121, "setsid");

  /* CPU seconds round up; kc-run enforces the precise millisecond limit from rusage. */
  rlim_t cpu_s = (rlim_t)((cpu_ms + 999) / 1000);
  set_limit(RLIMIT_CPU, cpu_s, cpu_s + 1, "RLIMIT_CPU");
  set_limit(RLIMIT_STACK, (rlim_t)stack_mb << 20, (rlim_t)stack_mb << 20, "RLIMIT_STACK");
  set_limit(RLIMIT_FSIZE, (rlim_t)fsize_mb << 20, (rlim_t)fsize_mb << 20, "RLIMIT_FSIZE");
  set_limit(RLIMIT_NPROC, (rlim_t)nproc, (rlim_t)nproc, "RLIMIT_NPROC");
  set_limit(RLIMIT_NOFILE, 64, 64, "RLIMIT_NOFILE");
  set_limit(RLIMIT_CORE, 0, 0, "RLIMIT_CORE");
  set_limit(RLIMIT_MEMLOCK, 0, 0, "RLIMIT_MEMLOCK");
  set_limit(RLIMIT_MSGQUEUE, 0, 0, "RLIMIT_MSGQUEUE");

  if (chdir(workdir) != 0) die(122, "chdir");
  if (setgroups(0, NULL) != 0) die(123, "setgroups");
  if (setresgid(gid, gid, gid) != 0) die(123, "setresgid");
  if (setresuid(uid, uid, uid) != 0) die(123, "setresuid");
  /* Paranoia: if root could be regained, stop here. */
  if (setuid(0) == 0 || geteuid() == 0) {
    dprintf(2, "kc-exec: privilege drop did not stick\n");
    _exit(123);
  }

  install_seccomp();

  char *envp[] = {"PATH=/usr/local/bin:/usr/bin:/bin", "HOME=/tmp", "LANG=C.UTF-8", "PYTHONDONTWRITEBYTECODE=1",
                  "PYTHONHASHSEED=0", NULL};
  execve(argv[9], &argv[9], envp);
  die(126, "execve");
}
