import { pythonName, type Language, type Signature } from '@kingcoda/problem-schema';
import { CPP_PRELUDE } from './cpp-prelude.ts';
import { cppType } from './types.ts';

/** Marks a result record in stdout; anything else on stdout is the user's own printing. */
export const RECORD = '\x1e';

export interface Program {
  /** Files to write into the job directory. The judge box knows each language's entry point. */
  files: Record<string, string>;
}

const PY_DRIVER = String.raw`import builtins, json, sys, traceback, typing

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

# Make ListNode, TreeNode and typing names (List, Optional, ...) visible to solution.py, like a judge prelude.
builtins.ListNode = ListNode
builtins.TreeNode = TreeNode
for _name in typing.__all__:
    if not hasattr(builtins, _name):
        setattr(builtins, _name, getattr(typing, _name))
sys.setrecursionlimit(200000)

SIG = json.loads(r"""__SIG__""")
RS = "\x1e"

def to_list(values):
    head = tail = None
    for v in values:
        node = ListNode(v)
        if head is None:
            head = tail = node
        else:
            tail.next = node
            tail = node
    return head

def from_list(node):
    out = []
    while node is not None and len(out) < 2000000:
        out.append(node.val)
        node = node.next
    return out

def to_tree(values):
    if not values or values[0] is None:
        return None
    root = TreeNode(values[0])
    queue, i = [root], 1
    q = 0
    while q < len(queue) and i < len(values):
        node = queue[q]
        q += 1
        if i < len(values) and values[i] is not None:
            node.left = TreeNode(values[i])
            queue.append(node.left)
        i += 1
        if i < len(values) and values[i] is not None:
            node.right = TreeNode(values[i])
            queue.append(node.right)
        i += 1
    return root

def from_tree(root):
    out, queue, q = [], [root], 0
    while q < len(queue) and len(out) < 4000000:
        node = queue[q]
        q += 1
        if node is None:
            out.append(None)
            continue
        out.append(node.val)
        queue.append(node.left)
        queue.append(node.right)
    while out and out[-1] is None:
        out.pop()
    return out

def decode(value, t):
    if t == "ListNode":
        return to_list(value)
    if t == "TreeNode":
        return to_tree(value)
    return value

def encode(value, t):
    if t == "ListNode":
        return from_list(value)
    if t == "TreeNode":
        return from_tree(value)
    if t == "double" and value is not None:
        return float(value)
    return value

def report(exc):
    frames = [f for f in traceback.extract_tb(exc.__traceback__) if f.filename.endswith("solution.py")]
    sys.stderr.write("Traceback (most recent call last):\n")
    sys.stderr.write("".join(traceback.format_list(frames)))
    sys.stderr.write("".join(traceback.format_exception_only(type(exc), exc)))

try:
    import solution
except BaseException as exc:
    report(exc)
    sys.exit(1)

cls = getattr(solution, "Solution", None)
method = SIG["method"]
if cls is None or not callable(getattr(cls, method, None)):
    sys.stderr.write("Define class Solution with a method named %s.\n" % method)
    sys.exit(1)

for line in sys.stdin.read().split("\n"):
    if not line.strip():
        continue
    args = json.loads(line)
    values = [decode(a, p) for a, p in zip(args, SIG["params"])]
    try:
        result = getattr(cls(), method)(*values)
    except BaseException as exc:
        sys.stdout.flush()
        report(exc)
        sys.exit(1)
    sys.stdout.write(RS + json.dumps(encode(result, SIG["returns"]), separators=(",", ":")) + "\n")
    sys.stdout.flush()
`;

function pythonProgram(sig: Signature, code: string): Program {
  const meta = {
    method: pythonName(sig.function),
    params: sig.params.map((p) => p.type),
    returns: sig.returns,
  };
  return {
    files: {
      'solution.py': code,
      'driver.py': PY_DRIVER.replace('__SIG__', JSON.stringify(meta)),
    },
  };
}

function jsProgram(sig: Signature, code: string): Program {
  const userLines = code.split('\n').length;
  const meta = {
    fn: sig.function,
    params: sig.params.map((p) => p.type),
    returns: sig.returns,
    userLines,
  };
  // The driver is appended to the user's file so stack traces keep the user's line numbers.
  const driver = String.raw`
;(function () {
  'use strict';
  const SIG = ${JSON.stringify(meta)};
  class KcListNode { constructor(val = 0, next = null) { this.val = val; this.next = next; } }
  class KcTreeNode { constructor(val = 0, left = null, right = null) { this.val = val; this.left = left; this.right = right; } }
  const LN = typeof ListNode !== 'undefined' ? ListNode : (globalThis.ListNode = KcListNode);
  const TN = typeof TreeNode !== 'undefined' ? TreeNode : (globalThis.TreeNode = KcTreeNode);
  const fn = typeof ${sig.function} === 'function' ? ${sig.function} : null;
  const report = (err) => {
    const lines = String((err && err.stack) || err).split('\n');
    const head = lines[0];
    const frames = lines.slice(1).filter((l) => {
      const m = l.match(/main\.js:(\d+):\d+/);
      return m && Number(m[1]) <= SIG.userLines;
    });
    process.stderr.write([head, ...frames].join('\n') + '\n');
  };
  if (!fn) {
    process.stderr.write('Define a function named ' + SIG.fn + '.\n');
    process.exit(1);
  }
  const toList = (vs) => { let head = null, tail = null; for (const v of vs) { const n = new LN(v); if (!head) head = tail = n; else { tail.next = n; tail = n; } } return head; };
  const fromList = (n) => { const out = []; while (n && out.length < 2000000) { out.push(n.val); n = n.next; } return out; };
  const toTree = (vs) => {
    if (!vs.length || vs[0] === null) return null;
    const root = new TN(vs[0]); const q = [root]; let qi = 0, i = 1;
    while (qi < q.length && i < vs.length) {
      const n = q[qi++];
      if (i < vs.length && vs[i] !== null) { n.left = new TN(vs[i]); q.push(n.left); } i++;
      if (i < vs.length && vs[i] !== null) { n.right = new TN(vs[i]); q.push(n.right); } i++;
    }
    return root;
  };
  const fromTree = (root) => {
    const out = []; const q = [root]; let qi = 0;
    while (qi < q.length && out.length < 4000000) { const n = q[qi++]; if (!n) { out.push(null); continue; } out.push(n.val); q.push(n.left, n.right); }
    while (out.length && out[out.length - 1] === null) out.pop();
    return out;
  };
  const decode = (v, t) => (t === 'ListNode' ? toList(v) : t === 'TreeNode' ? toTree(v) : v);
  const encode = (v, t) => (t === 'ListNode' ? fromList(v) : t === 'TreeNode' ? fromTree(v) : v === undefined ? null : v);
  const input = require('fs').readFileSync(0, 'utf8').split('\n');
  for (const line of input) {
    if (!line.trim()) continue;
    const args = JSON.parse(line).map((a, i) => decode(a, SIG.params[i]));
    let result;
    try {
      result = fn(...args);
    } catch (err) {
      report(err);
      process.exit(1);
    }
    process.stdout.write('\x1e' + JSON.stringify(encode(result, SIG.returns)) + '\n');
  }
})();
`;
  return { files: { 'main.js': code + '\n' + driver } };
}

function cppProgram(sig: Signature, code: string): Program {
  const decls = sig.params
    .map(
      (p, i) =>
        `      ${cppType[p.type]} kc_a${i} = kc::from_json<${cppType[p.type]}>(kc_args.a.at(${i}));`,
    )
    .join('\n');
  const call = `kc_sol.${sig.function}(${sig.params.map((_, i) => `kc_a${i}`).join(', ')})`;
  const main = `#include <kc_prelude.hpp>
#line 1 "solution.cpp"
${code}
#line 1 "kc_driver"
int main() {
  string kc_line;
  while (getline(cin, kc_line)) {
    if (kc_line.empty()) continue;
    try {
      kc::Json kc_args = kc::parse(kc_line);
${decls}
      Solution kc_sol;
      kc::emit<${cppType[sig.returns]}>(${call});
    } catch (const std::exception &e) {
      fflush(stdout);
      fprintf(stderr, "Runtime Error: %s\\n", e.what());
      return 1;
    }
  }
  return 0;
}
`;
  return { files: { 'main.cpp': main, 'kc_prelude.hpp': CPP_PRELUDE } };
}

/** Wraps user code in the language's driver. One process runs every test case, one JSON line each. */
export function buildProgram(sig: Signature, lang: Language, code: string): Program {
  switch (lang) {
    case 'python':
      return pythonProgram(sig, code);
    case 'javascript':
      return jsProgram(sig, code);
    case 'cpp':
      return cppProgram(sig, code);
  }
}

/** stdin for a batch: one JSON array of positional args per line. */
export function encodeInput(cases: Array<{ args: unknown[] }>): string {
  return cases.map((c) => JSON.stringify(c.args)).join('\n') + '\n';
}

export interface ParsedOutput {
  /** One decoded result per completed case, in order. */
  results: unknown[];
  /** What the user printed while each case ran (index = case). */
  printed: string[];
  /** A result record that wasn't valid JSON (the user wrote over our record separator). */
  malformed: boolean;
}

export function parseOutput(stdout: string): ParsedOutput {
  const chunks = stdout.split(RECORD);
  const printed: string[] = [chunks[0] ?? ''];
  const results: unknown[] = [];
  let malformed = false;
  for (const chunk of chunks.slice(1)) {
    const nl = chunk.indexOf('\n');
    const json = nl === -1 ? chunk : chunk.slice(0, nl);
    try {
      results.push(JSON.parse(json));
    } catch {
      malformed = true;
      break;
    }
    printed.push(nl === -1 ? '' : chunk.slice(nl + 1));
  }
  // printed[i] is what case i printed before its result; the last entry is output after the final result.
  return { results, printed, malformed };
}
