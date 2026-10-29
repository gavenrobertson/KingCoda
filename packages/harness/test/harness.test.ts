import { describe, expect, it } from 'vitest';
import type { Language, Signature } from '@kingcoda/problem-schema';
import { buildProgram, encodeInput, parseOutput, starterCode } from '../src/index.ts';
import { haveToolchains, runLocal } from './run-local.ts';

interface Case {
  name: string;
  sig: Signature;
  solutions: Record<Language, string>;
  cases: Array<{ args: unknown[]; expected: unknown }>;
}

const CASES: Case[] = [
  {
    name: 'int[] → long (sum, beyond 32 bits)',
    sig: { function: 'totalTreasure', params: [{ name: 'coins', type: 'int[]' }], returns: 'long' },
    solutions: {
      python:
        'class Solution:\n    def total_treasure(self, coins: list[int]) -> int:\n        return sum(coins)\n',
      javascript:
        'function totalTreasure(coins) {\n  return coins.reduce((a, b) => a + b, 0);\n}\n',
      cpp: 'class Solution {\npublic:\n    long long totalTreasure(vector<int>& coins) {\n        long long s = 0; for (int c : coins) s += c; return s;\n    }\n};\n',
    },
    cases: [
      { args: [[1, 2, 3]], expected: 6 },
      { args: [[]], expected: 0 },
      { args: [[2147483647, 2147483647, 2147483647]], expected: 6442450941 },
      { args: [[-5, 5, -2147483648]], expected: -2147483648 },
    ],
  },
  {
    name: 'ListNode → ListNode (reverse)',
    sig: {
      function: 'reverseProcession',
      params: [{ name: 'head', type: 'ListNode' }],
      returns: 'ListNode',
    },
    solutions: {
      python:
        'class Solution:\n    def reverse_procession(self, head: Optional[ListNode]) -> Optional[ListNode]:\n        prev = None\n        while head:\n            head.next, prev, head = prev, head, head.next\n        return prev\n',
      javascript:
        'function reverseProcession(head) {\n  let prev = null;\n  while (head) { const n = head.next; head.next = prev; prev = head; head = n; }\n  return prev;\n}\n',
      cpp: 'class Solution {\npublic:\n    ListNode* reverseProcession(ListNode* head) {\n        ListNode* prev = nullptr;\n        while (head) { auto n = head->next; head->next = prev; prev = head; head = n; }\n        return prev;\n    }\n};\n',
    },
    cases: [
      { args: [[1, 2, 3]], expected: [3, 2, 1] },
      { args: [[]], expected: [] },
      { args: [[7]], expected: [7] },
    ],
  },
  {
    name: 'TreeNode → TreeNode (mirror, level-order with nulls)',
    sig: {
      function: 'mirrorCourt',
      params: [{ name: 'root', type: 'TreeNode' }],
      returns: 'TreeNode',
    },
    solutions: {
      python:
        'class Solution:\n    def mirror_court(self, root: Optional[TreeNode]) -> Optional[TreeNode]:\n        if root:\n            root.left, root.right = self.mirror_court(root.right), self.mirror_court(root.left)\n        return root\n',
      javascript:
        'function mirrorCourt(root) {\n  if (root) { const l = root.left; root.left = mirrorCourt(root.right); root.right = mirrorCourt(l); }\n  return root;\n}\n',
      cpp: 'class Solution {\npublic:\n    TreeNode* mirrorCourt(TreeNode* root) {\n        if (root) { auto l = root->left; root->left = mirrorCourt(root->right); root->right = mirrorCourt(l); }\n        return root;\n    }\n};\n',
    },
    cases: [
      { args: [[4, 2, 7, 1, 3, 6, 9]], expected: [4, 7, 2, 9, 6, 3, 1] },
      { args: [[1, null, 2]], expected: [1, 2] },
      { args: [[]], expected: [] },
      { args: [[1, 2, null, 3]], expected: [1, null, 2, null, 3] },
    ],
  },
  {
    name: 'string[] + string → string (escapes and unicode)',
    sig: {
      function: 'herald',
      params: [
        { name: 'words', type: 'string[]' },
        { name: 'sep', type: 'string' },
      ],
      returns: 'string',
    },
    solutions: {
      python:
        'class Solution:\n    def herald(self, words: list[str], sep: str) -> str:\n        return sep.join(words)\n',
      javascript: 'function herald(words, sep) {\n  return words.join(sep);\n}\n',
      cpp: 'class Solution {\npublic:\n    string herald(vector<string>& words, string& sep) {\n        string o; for (size_t i = 0; i < words.size(); i++) { if (i) o += sep; o += words[i]; } return o;\n    }\n};\n',
    },
    cases: [
      { args: [['long', 'live', 'the', 'king'], ' '], expected: 'long live the king' },
      { args: [['say "hi"', 'back\\slash'], '\n\t'], expected: 'say "hi"\n\tback\\slash' },
      { args: [['café', 'crème'], '·'], expected: 'café·crème' },
      { args: [[], ','], expected: '' },
    ],
  },
  {
    name: 'int[][] → int[][] (transpose)',
    sig: {
      function: 'turnTheMap',
      params: [{ name: 'grid', type: 'int[][]' }],
      returns: 'int[][]',
    },
    solutions: {
      python:
        'class Solution:\n    def turn_the_map(self, grid: list[list[int]]) -> list[list[int]]:\n        return [list(r) for r in zip(*grid)]\n',
      javascript:
        'function turnTheMap(grid) {\n  return grid.length ? grid[0].map((_, c) => grid.map((r) => r[c])) : [];\n}\n',
      cpp: 'class Solution {\npublic:\n    vector<vector<int>> turnTheMap(vector<vector<int>>& g) {\n        if (g.empty()) return {};\n        vector<vector<int>> t(g[0].size(), vector<int>(g.size()));\n        for (size_t r = 0; r < g.size(); r++) for (size_t c = 0; c < g[0].size(); c++) t[c][r] = g[r][c];\n        return t;\n    }\n};\n',
    },
    cases: [
      {
        args: [
          [
            [1, 2, 3],
            [4, 5, 6],
          ],
        ],
        expected: [
          [1, 4],
          [2, 5],
          [3, 6],
        ],
      },
      { args: [[]], expected: [] },
    ],
  },
  {
    name: 'bool[] + double → double',
    sig: {
      function: 'shareOfYes',
      params: [
        { name: 'votes', type: 'bool[]' },
        { name: 'weight', type: 'double' },
      ],
      returns: 'double',
    },
    solutions: {
      python:
        'class Solution:\n    def share_of_yes(self, votes: list[bool], weight: float) -> float:\n        return weight * sum(votes) / len(votes)\n',
      javascript:
        'function shareOfYes(votes, weight) {\n  return (weight * votes.filter(Boolean).length) / votes.length;\n}\n',
      cpp: 'class Solution {\npublic:\n    double shareOfYes(vector<bool>& votes, double weight) {\n        int y = 0; for (bool v : votes) y += v; return weight * y / votes.size();\n    }\n};\n',
    },
    cases: [
      { args: [[true, false, true, true], 2], expected: 1.5 },
      { args: [[false], 0.5], expected: 0 },
    ],
  },
];

const LANGS: Language[] = ['python', 'javascript', 'cpp'];
const run = haveToolchains() ? describe : describe.skip;

run('drivers produce identical results in every language', () => {
  for (const c of CASES) {
    for (const lang of LANGS) {
      it(`${c.name} [${lang}]`, () => {
        const r = runLocal(
          lang,
          buildProgram(c.sig, lang, c.solutions[lang]),
          encodeInput(c.cases),
        );
        expect(r.compileError, r.compileError).toBeUndefined();
        expect(r.status, r.stderr).toBe(0);
        const out = parseOutput(r.stdout);
        expect(out.malformed).toBe(false);
        expect(out.results).toEqual(c.cases.map((x) => x.expected));
      });
    }
  }
});

run('failures and user output', () => {
  const sig: Signature = {
    function: 'risky',
    params: [{ name: 'n', type: 'int' }],
    returns: 'int',
  };
  const crash: Record<Language, string> = {
    python:
      'class Solution:\n    def risky(self, n: int) -> int:\n        print("checking", n)\n        return 10 // n\n',
    javascript:
      'function risky(n) {\n  console.log("checking", n);\n  if (n === 0) throw new Error("no zero");\n  return Math.floor(10 / n);\n}\n',
    cpp: 'class Solution {\npublic:\n    int risky(int n) {\n        cout << "checking " << n << endl;\n        if (n == 0) throw runtime_error("no zero");\n        return 10 / n;\n    }\n};\n',
  };
  for (const lang of LANGS) {
    it(`stops at the failing case, keeps prints apart and points at the user's line [${lang}]`, () => {
      const r = runLocal(
        lang,
        buildProgram(sig, lang, crash[lang]),
        encodeInput([{ args: [5] }, { args: [2] }, { args: [0] }, { args: [1] }]),
      );
      expect(r.status).not.toBe(0);
      const out = parseOutput(r.stdout);
      expect(out.results).toEqual([2, 5]);
      expect(out.printed[0]?.trim()).toBe('checking 5');
      expect(out.printed[1]?.trim()).toBe('checking 2');
      expect(out.printed[2]?.trim()).toBe('checking 0');
      if (lang === 'python')
        expect(r.stderr).toMatch(/solution\.py", line 4[\s\S]*ZeroDivisionError/);
      if (lang === 'javascript') expect(r.stderr).toMatch(/Error: no zero[\s\S]*main\.js:3:/);
      if (lang === 'cpp') expect(r.stderr).toContain('Runtime Error: no zero');
      // Driver frames never leak into what the user sees.
      expect(r.stderr).not.toMatch(/driver\.py|kc_driver/);
    });
  }

  it('C++ compile errors point at the user file and line', () => {
    const r = runLocal(
      'cpp',
      buildProgram(
        sig,
        'cpp',
        'class Solution {\npublic:\n    int risky(int n) {\n        return m;\n    }\n};\n',
      ),
      '[1]\n',
    );
    expect(r.compileError).toMatch(/solution\.cpp:4:/);
  });

  it('a missing function is explained', () => {
    const r = runLocal(
      'python',
      buildProgram(sig, 'python', 'class Solution:\n    pass\n'),
      '[1]\n',
    );
    expect(r.stderr).toContain('Define class Solution with a method named risky');
    const j = runLocal(
      'javascript',
      buildProgram(sig, 'javascript', 'function other() {}\n'),
      '[1]\n',
    );
    expect(j.stderr).toContain('Define a function named risky');
  });
});

describe('starter code', () => {
  const sig: Signature = {
    function: 'longestCalm',
    params: [
      { name: 'speeds', type: 'int[]' },
      { name: 'k', type: 'int' },
    ],
    returns: 'int',
  };
  it('uses each language’s conventions', () => {
    expect(starterCode(sig, 'python')).toContain(
      'def longest_calm(self, speeds: list[int], k: int) -> int:',
    );
    expect(starterCode(sig, 'javascript')).toContain('function longestCalm(speeds, k) {');
    expect(starterCode(sig, 'cpp')).toContain('int longestCalm(vector<int>& speeds, int k) {');
  });

  it('compiles as-is in every language (so an untouched starter is WA, not CE)', () => {
    if (!haveToolchains()) return;
    for (const lang of LANGS) {
      const r = runLocal(lang, buildProgram(sig, lang, starterCode(sig, lang)), '[[1,2],1]\n');
      expect(r.compileError, `${lang}: ${r.compileError}`).toBeUndefined();
    }
  });

  it('documents ListNode and TreeNode when used', () => {
    const t: Signature = {
      function: 'f',
      params: [{ name: 'root', type: 'TreeNode' }],
      returns: 'ListNode',
    };
    for (const lang of LANGS) {
      const s = starterCode(t, lang);
      expect(s).toContain('TreeNode');
      expect(s).toContain('ListNode');
    }
  });
});

describe('parseOutput', () => {
  it('splits records from user printing even without trailing newlines', () => {
    const out = parseOutput('debug\x1e1\nmore\x1e[2,3]\n\x1e"x"\n');
    expect(out.results).toEqual([1, [2, 3], 'x']);
    expect(out.printed).toEqual(['debug', 'more', '', '']);
  });
  it('flags a corrupted record', () => {
    expect(parseOutput('\x1e{oops\n').malformed).toBe(true);
  });
});
