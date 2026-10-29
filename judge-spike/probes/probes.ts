/**
 * Hostile-code probe suite for a judge box. Shared by the local runner (run.ts → Docker) and the
 * spike Worker (→ a deployed Cloudflare Container), so both environments face identical attacks.
 */

export type Status = 'ok' | 'tle' | 'mle' | 'ole' | 're' | 'ce' | 'sandbox_fail';

export interface StepResult {
  status: Status;
  stdout: string;
  stderr: string;
  exitCode: number;
  signal?: string;
  cpuMs: number;
  wallMs: number;
  maxRssKb: number;
}

export interface RunResult {
  id: string;
  compile?: StepResult;
  tests: StepResult[];
  strays: number;
}

export interface Job {
  id: string;
  lang: 'python' | 'javascript' | 'cpp';
  source: string;
  inputs: string[];
  timeMs: number;
  memoryMb: number;
  outputLimit?: number;
  stopOnFailure?: boolean;
}

export interface Probe {
  name: string;
  group: 'correctness' | 'limits' | 'isolation' | 'hygiene';
  job: Omit<Job, 'id'>;
  /** Returns null on pass, or a reason on failure. */
  check: (r: RunResult) => string | null;
}

const base = { timeMs: 1000, memoryMb: 256 } as const;
const first = (r: RunResult) => r.tests[0];
const expectStatus =
  (want: Status, extra?: (t: StepResult, r: RunResult) => string | null) =>
  (r: RunResult): string | null => {
    const t = first(r);
    if (!t)
      return `no test ran (compile: ${r.compile?.status ?? 'none'} ${r.compile?.stderr.slice(0, 200) ?? ''})`;
    if (t.status !== want)
      return `expected ${want}, got ${t.status} (exit ${t.exitCode} ${t.signal ?? ''}) ${t.stderr.slice(0, 300)}`;
    return extra ? extra(t, r) : null;
  };
const stdoutIs = (want: string) =>
  expectStatus('ok', (t) =>
    t.stdout.trim() === want
      ? null
      : `stdout ${JSON.stringify(t.stdout.slice(0, 200))}, want ${JSON.stringify(want)}`,
  );

export const probes: Probe[] = [
  // ── correctness ──────────────────────────────────────────────────────────
  {
    name: 'python: sums stdin',
    group: 'correctness',
    job: {
      ...base,
      lang: 'python',
      source: 'import sys\nprint(sum(map(int, sys.stdin.read().split())))\n',
      inputs: ['1 2 3 4'],
    },
    check: stdoutIs('10'),
  },
  {
    name: 'javascript: sums stdin',
    group: 'correctness',
    job: {
      ...base,
      lang: 'javascript',
      source:
        "const s=require('fs').readFileSync(0,'utf8').trim().split(/\\s+/).map(Number);console.log(s.reduce((a,b)=>a+b,0));\n",
      inputs: ['1 2 3 4'],
    },
    check: stdoutIs('10'),
  },
  {
    name: 'cpp: compiles and sums stdin',
    group: 'correctness',
    job: {
      ...base,
      lang: 'cpp',
      source:
        '#include <bits/stdc++.h>\nint main(){long long s=0,x;while(std::cin>>x)s+=x;std::cout<<s<<"\\n";}\n',
      inputs: ['1 2 3 4', '-5 5'],
    },
    check: (r) =>
      r.tests.map((t) => t.stdout.trim()).join(',') === '10,0'
        ? null
        : `got ${r.tests.map((t) => `${t.status}:${t.stdout.trim()}`).join(',')}`,
  },
  {
    name: 'cpp: compile error is CE with a log',
    group: 'correctness',
    job: { ...base, lang: 'cpp', source: 'int main(){ return x; }\n', inputs: [''] },
    check: (r) =>
      r.compile?.status === 'ce' && r.compile.stderr.includes('x') && r.tests.length === 0
        ? null
        : `compile=${r.compile?.status} tests=${r.tests.length}`,
  },
  {
    name: 'python: exception is RE with trace',
    group: 'correctness',
    job: { ...base, lang: 'python', source: 'raise ValueError("boom")\n', inputs: [''] },
    check: expectStatus('re', (t) =>
      t.stderr.includes('ValueError: boom') ? null : 'trace missing',
    ),
  },
  {
    name: 'stop-on-failure halts after the first failing test',
    group: 'correctness',
    job: {
      ...base,
      lang: 'python',
      source: 'import sys\nx=int(input())\nsys.exit(0 if x>0 else 3)\n',
      inputs: ['1', '-1', '2'],
      stopOnFailure: true,
    },
    check: (r) =>
      r.tests.length === 2 && r.tests[1]!.status === 're' ? null : `ran ${r.tests.length} tests`,
  },

  // ── limits ───────────────────────────────────────────────────────────────
  {
    name: 'infinite loop → TLE (python)',
    group: 'limits',
    job: { ...base, lang: 'python', source: 'while True: pass\n', inputs: [''] },
    check: expectStatus('tle', (t) => (t.wallMs < 4000 ? null : `took ${t.wallMs}ms wall`)),
  },
  {
    name: 'infinite loop → TLE (cpp)',
    group: 'limits',
    job: {
      ...base,
      lang: 'cpp',
      source: 'int main(){ volatile unsigned long x=0; for(;;) x++; }\n',
      inputs: [''],
    },
    check: expectStatus('tle'),
  },
  {
    name: 'sleeping forever → wall-clock TLE',
    group: 'limits',
    job: { ...base, lang: 'python', source: 'import time\ntime.sleep(600)\n', inputs: [''] },
    check: expectStatus('tle', (t) => (t.wallMs < 5000 ? null : `took ${t.wallMs}ms wall`)),
  },
  {
    name: 'memory bomb → MLE (python)',
    group: 'limits',
    job: {
      ...base,
      lang: 'python',
      source: 'a=[]\nwhile True: a.append(bytearray(8<<20))\n',
      inputs: [''],
    },
    check: expectStatus('mle'),
  },
  {
    name: 'memory bomb → MLE (cpp, touched pages)',
    group: 'limits',
    job: {
      ...base,
      lang: 'cpp',
      source:
        '#include <cstdlib>\n#include <cstring>\nint main(){ for(;;){ char* p=(char*)malloc(16<<20); if(!p) return 7; memset(p,1,16<<20);} }\n',
      inputs: [''],
    },
    check: expectStatus('mle'),
  },
  {
    name: 'memory bomb → MLE (javascript)',
    group: 'limits',
    job: {
      ...base,
      lang: 'javascript',
      source: 'const a=[];for(;;)a.push(Buffer.alloc(8<<20,1));\n',
      inputs: [''],
    },
    check: (r) => {
      const s = first(r)?.status;
      return s === 'mle' || s === 're' ? null : `got ${s}`; // V8 may abort on its heap limit first
    },
  },
  {
    name: 'output flood → OLE, capped',
    group: 'limits',
    job: {
      ...base,
      lang: 'python',
      source: 'import sys\nwhile True: sys.stdout.write("x"*65536)\n',
      inputs: [''],
      outputLimit: 65536,
    },
    check: expectStatus('ole', (t) =>
      t.stdout.length <= 65536 ? null : `stdout grew to ${t.stdout.length}`,
    ),
  },
  {
    name: 'fork bomb is contained (python)',
    group: 'limits',
    job: {
      ...base,
      lang: 'python',
      source: 'import os\nwhile True:\n    try: os.fork()\n    except OSError: pass\n',
      inputs: [''],
    },
    check: (r) => (first(r) && first(r)!.status !== 'ok' ? null : 'fork bomb exited ok?'),
  },
  {
    name: 'fork bomb is contained (cpp)',
    group: 'limits',
    job: {
      ...base,
      lang: 'cpp',
      source: '#include <unistd.h>\nint main(){ for(;;) fork(); }\n',
      inputs: [''],
    },
    check: (r) => (first(r) && first(r)!.status !== 'ok' ? null : 'fork bomb exited ok?'),
  },
  {
    name: 'deep recursion → RE, not a box crash',
    group: 'limits',
    job: {
      ...base,
      lang: 'cpp',
      source:
        'int f(int n){ volatile char b[4096]; b[0]=n; return f(n+1)+b[0]; }\nint main(){ return f(0); }\n',
      inputs: [''],
    },
    check: (r) =>
      ['re', 'mle'].includes(first(r)?.status ?? '') ? null : `got ${first(r)?.status}`,
  },
  {
    name: 'huge file write is stopped (RLIMIT_FSIZE)',
    group: 'limits',
    job: {
      ...base,
      lang: 'python',
      source: 'f=open("big","wb")\nwhile True: f.write(b"x"*(1<<20))\n',
      inputs: [''],
    },
    // Python ignores SIGXFSZ and raises EFBIG ("File too large"); C programs die of SIGXFSZ.
    check: expectStatus('re', (t) =>
      /File too large|file size limit/i.test(t.stderr + (t.signal ?? ''))
        ? null
        : `stderr: ${t.stderr.slice(0, 200)} signal ${t.signal}`,
    ),
  },

  // ── isolation ────────────────────────────────────────────────────────────
  {
    name: 'no network: AF_INET socket denied',
    group: 'isolation',
    job: {
      ...base,
      lang: 'python',
      source:
        'import socket\ntry:\n    s=socket.socket(socket.AF_INET, socket.SOCK_STREAM)\n    s.settimeout(2)\n    s.connect(("1.1.1.1",80))\n    print("CONNECTED")\nexcept OSError as e:\n    print("blocked", e.errno)\n',
      inputs: [''],
    },
    check: stdoutIs('blocked 1'),
  },
  {
    name: 'no network: AF_INET6 and raw sockets denied (cpp)',
    group: 'isolation',
    job: {
      ...base,
      lang: 'cpp',
      source:
        '#include <sys/socket.h>\n#include <netinet/in.h>\n#include <cstdio>\nint main(){ int a=socket(AF_INET6,SOCK_STREAM,0); int b=socket(AF_INET,SOCK_RAW,IPPROTO_ICMP); int c=socket(AF_NETLINK,SOCK_RAW,0); int d=socket(AF_PACKET,SOCK_RAW,0); printf("%d %d %d %d\\n",a,b,c,d); }\n',
      inputs: [''],
    },
    check: stdoutIs('-1 -1 -1 -1'),
  },
  {
    name: 'cannot write system or judge files',
    group: 'isolation',
    job: {
      ...base,
      lang: 'python',
      source:
        'res=[]\nfor p in ["/etc/passwd","/usr/bin/python3","/usr/x","/opt/kc/kc-run","/root/x","/x"]:\n    try:\n        open(p,"ab").close(); res.append("W:"+p)\n    except OSError: res.append("ok")\nprint(" ".join(res))\n',
      inputs: [''],
    },
    check: stdoutIs('ok ok ok ok ok ok'),
  },
  {
    name: 'only the sandbox’s own processes are visible',
    group: 'isolation',
    job: {
      ...base,
      lang: 'python',
      source:
        'import os\npids=[p for p in os.listdir("/proc") if p.isdigit()]\nnames=[open("/proc/%s/cmdline"%p,"rb").read().split(b"\\0")[0].decode() for p in pids]\nprint(len(pids), any("kc-run" in n or "tini" in n for n in names))\n',
      inputs: [''],
    },
    check: stdoutIs('1 False'),
  },
  {
    name: 'filesystem is a minimal jail',
    group: 'isolation',
    job: {
      ...base,
      lang: 'python',
      source: 'import os\nprint(",".join(sorted(os.listdir("/"))))\nprint(os.listdir("/work"))\n',
      inputs: [''],
    },
    check: expectStatus('ok', (t) => {
      const [root = '', work = ''] = t.stdout.trim().split('\n');
      const entries = root.split(',');
      const forbidden = entries.filter((e) =>
        ['opt', 'root', 'home', 'sys', 'var', 'srv', 'boot', 'run', 'mnt'].includes(e),
      );
      if (forbidden.length) return `visible: ${forbidden.join(', ')}`;
      if (!['usr', 'etc', 'tmp', 'work', 'dev', 'proc'].every((e) => entries.includes(e)))
        return `missing basics in ${root}`;
      return work.includes('main.py') ? null : `job dir not mounted at /work: ${work}`;
    }),
  },
  {
    name: 'cannot regain root (setuid/setresuid/capset)',
    group: 'isolation',
    job: {
      ...base,
      lang: 'cpp',
      source:
        '#include <unistd.h>\n#include <cstdio>\nint main(){ int a=setuid(0); int b=setresuid(0,0,0); int c=setgid(0); printf("%d %d %d %d\\n",a,b,c,(int)geteuid()); }\n',
      inputs: [''],
    },
    check: stdoutIs('-1 -1 -1 2000'),
  },
  {
    name: 'cannot create namespaces, mount or ptrace',
    group: 'isolation',
    job: {
      ...base,
      lang: 'cpp',
      source:
        '#define _GNU_SOURCE\n#include <sched.h>\n#include <sys/mount.h>\n#include <sys/ptrace.h>\n#include <unistd.h>\n#include <cstdio>\nint main(){ int a=unshare(CLONE_NEWUSER); int b=unshare(CLONE_NEWNS); int c=mount("none","/tmp","tmpfs",0,0); long d=ptrace(PTRACE_ATTACH,1,0,0); int e=chroot("/tmp"); printf("%d %d %d %ld %d\\n",a,b,c,d,e); }\n',
      inputs: [''],
    },
    check: stdoutIs('-1 -1 -1 -1 -1'),
  },
  {
    name: 'seccomp and no-new-privs are active',
    group: 'isolation',
    job: {
      ...base,
      lang: 'python',
      source:
        'for l in open("/proc/self/status"):\n    if l.startswith(("CapEff","CapBnd","NoNewPrivs","Seccomp:")):\n        print(l.split()[0], l.split()[1])\n',
      inputs: [''],
    },
    // Capabilities are reported, not required to be zero: Cloudflare's durable_object policy keeps
    // them whatever we do, which is why the jail and filter don't depend on them.
    check: expectStatus('ok', (t) => {
      const kv = Object.fromEntries(
        t.stdout
          .trim()
          .split('\n')
          .map((l) => l.split(' ') as [string, string]),
      );
      return kv['NoNewPrivs:'] === '1' && kv['Seccomp:'] === '2'
        ? null
        : `got ${t.stdout.trim().replace(/\n/g, ', ')}`;
    }),
  },
  {
    name: 'cannot raise its own limits, make devices or use real-time scheduling',
    group: 'isolation',
    job: {
      ...base,
      lang: 'cpp',
      source:
        '#include <sys/resource.h>\n#include <sys/stat.h>\n#include <sys/sysmacros.h>\n#include <sched.h>\n#include <cstdio>\nint main(){ struct rlimit r; getrlimit(RLIMIT_CPU,&r); int g = r.rlim_cur > 0 ? 0 : -1; r.rlim_cur = r.rlim_max = RLIM_INFINITY; int a=setrlimit(RLIMIT_CPU,&r); int b=setrlimit(RLIMIT_NPROC,&r); int c=mknod("/tmp/disk", S_IFBLK|0600, makedev(8,0)); struct sched_param sp; sp.sched_priority=50; int d=sched_setscheduler(0,SCHED_FIFO,&sp); printf("%d %d %d %d %d\\n",g,a,b,c,d); }\n',
      inputs: [''],
    },
    check: stdoutIs('0 -1 -1 -1 -1'),
  },
  {
    name: 'kill(-1) cannot take down the supervisor',
    group: 'isolation',
    job: {
      ...base,
      lang: 'python',
      source:
        'import os, signal\ntry: os.kill(-1, signal.SIGKILL)\nexcept OSError: pass\nprint("survived")\n',
      inputs: [''],
    },
    // kill(-1) also kills the caller (same uid), so any status is fine. The box must still answer the NEXT probe.
    check: (r) => (first(r) ? null : 'no result'),
  },
  {
    name: 'io_uring is unavailable',
    group: 'isolation',
    job: {
      ...base,
      lang: 'cpp',
      source:
        '#include <sys/syscall.h>\n#include <unistd.h>\n#include <cstdio>\n#include <cstring>\nint main(){ char p[120]; memset(p,0,120); long r=syscall(425, 8, p); printf("%ld\\n", r); }\n',
      inputs: [''],
    },
    check: stdoutIs('-1'),
  },

  // ── hygiene between jobs ─────────────────────────────────────────────────
  {
    name: 'background daemons die with the program',
    group: 'hygiene',
    job: {
      ...base,
      lang: 'python',
      source:
        'import os, time\nif os.fork()==0:\n    os.setsid()\n    if os.fork()==0:\n        time.sleep(300)\n    os._exit(0)\nprint("parent done")\n',
      inputs: [''],
    },
    check: (r) =>
      r.tests[0]?.status === 'ok' &&
      r.tests[0].stdout.trim() === 'parent done' &&
      r.tests[0].wallMs < 1000
        ? null
        : `status ${r.tests[0]?.status} stdout ${r.tests[0]?.stdout.trim()} wall ${r.tests[0]?.wallMs}ms`,
  },
  {
    name: 'no sandbox process survives into the next job',
    group: 'hygiene',
    job: {
      ...base,
      lang: 'python',
      source:
        'import os\nme=os.getpid()\nn=0\nfor p in os.listdir("/proc"):\n    if p.isdigit() and int(p)!=me:\n        try:\n            if os.stat("/proc/"+p).st_uid==2000: n+=1\n        except OSError: pass\nprint(n)\n',
      inputs: [''],
    },
    check: stdoutIs('0'),
  },
  {
    name: 'files left in /tmp are gone next job (1/2: plant)',
    group: 'hygiene',
    job: {
      ...base,
      lang: 'python',
      source:
        'open("/tmp/kc-leak","w").write("secret")\ntry:\n    open("/dev/shm/kc-leak","w").write("secret")\nexcept OSError:\n    pass\nprint("planted")\n',
      inputs: [''],
    },
    check: stdoutIs('planted'),
  },
  {
    name: 'files left in /tmp are gone next job (2/2: look)',
    group: 'hygiene',
    job: {
      ...base,
      lang: 'python',
      source:
        'import os\nprint(os.path.exists("/tmp/kc-leak") or os.path.exists("/dev/shm/kc-leak"))\n',
      inputs: [''],
    },
    check: stdoutIs('False'),
  },
];

/** CPU-time stability: the same CPU-bound program, many runs. Percentiles need low variance. */
export const timingProbe: Omit<Job, 'id'> = {
  lang: 'cpp',
  source:
    '#include <cstdio>\nint main(){ volatile unsigned long long x=0; for(unsigned long long i=0;i<300000000ULL;i++) x+=i; printf("%llu\\n",(unsigned long long)x); }\n',
  inputs: Array.from({ length: 30 }, () => ''),
  timeMs: 5000,
  memoryMb: 64,
};

export interface ProbeReport {
  name: string;
  group: string;
  pass: boolean;
  reason: string | null;
  ms: number;
}

export async function runProbes(
  send: (job: Job) => Promise<RunResult>,
  healthy: () => Promise<boolean>,
): Promise<{
  probes: ProbeReport[];
  timing: { runs: number; meanMs: number; cv: number; min: number; max: number };
}> {
  const reports: ProbeReport[] = [];
  for (const [i, p] of probes.entries()) {
    const t0 = Date.now();
    let reason: string | null;
    try {
      const r = await send({ ...p.job, id: `probe-${i}` });
      reason = p.check(r);
      if (!reason && !(await healthy())) reason = 'box unhealthy after this probe';
    } catch (e) {
      reason = `request failed: ${(e as Error).message}`;
    }
    reports.push({
      name: p.name,
      group: p.group,
      pass: reason === null,
      reason,
      ms: Date.now() - t0,
    });
  }
  const r = await send({ ...timingProbe, id: 'timing' });
  const cpu = r.tests.map((t) => t.cpuMs);
  const mean = cpu.reduce((a, b) => a + b, 0) / Math.max(1, cpu.length);
  const sd = Math.sqrt(cpu.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, cpu.length));
  return {
    probes: reports,
    timing: {
      runs: cpu.length,
      meanMs: Math.round(mean),
      cv: Math.round((sd / mean) * 1000) / 1000,
      min: Math.min(...cpu),
      max: Math.max(...cpu),
    },
  };
}
