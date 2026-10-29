import { z } from 'zod';
import { valueType } from './types.ts';

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;
export const LANGUAGES = ['python', 'javascript', 'cpp'] as const;
export type Language = (typeof LANGUAGES)[number];

const camel = /^[a-z][a-zA-Z0-9]*$/;

/** Words reserved in any language we judge now or plan to (C++, Python, JS/TS, Java, Go). */
export const RESERVED_NAMES = new Set(
  (
    'alignas alignof and asm auto bitand bitor bool break case catch char class compl concept const consteval constexpr ' +
    'constinit continue co_await co_return co_yield decltype default delete do double else enum explicit export extern ' +
    'false float for friend goto if inline int long mutable namespace new noexcept not nullptr operator or private ' +
    'protected public register reinterpret_cast requires return short signed sizeof static struct switch template this ' +
    'throw true try typedef typeid typename union unsigned using virtual void volatile while xor ' +
    'as assert async await def del elif except finally from global import in is lambda nonlocal pass raise with yield ' +
    'None True False arguments debugger eval function instanceof let of typeof var abstract boolean byte extends final ' +
    'implements interface native package strictfp super synchronized throws transient chan defer fallthrough func go ' +
    'map range select type string vector list'
  ).split(' '),
);
const notReserved = (n: string) => !RESERVED_NAMES.has(n);

export const signatureSchema = z
  .object({
    /** Canonical camelCase name; Python gets snake_case automatically. */
    function: z
      .string()
      .regex(camel, 'camelCase, starting with a lowercase letter')
      .refine(notReserved, 'reserved word in a judged language'),
    params: z
      .array(
        z.object({
          name: z
            .string()
            .regex(camel, 'camelCase parameter names')
            .refine(notReserved, 'reserved word in a judged language'),
          type: valueType,
        }),
      )
      .min(1)
      .max(6),
    returns: valueType,
  })
  .strict()
  .refine(
    (s) => new Set(s.params.map((p) => p.name)).size === s.params.length,
    'parameter names must be unique',
  );
export type Signature = z.infer<typeof signatureSchema>;

export const checkerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('exact') }).strict(),
  z.object({ kind: z.literal('float'), tolerance: z.number().positive().max(1e-1) }).strict(),
  /** Top-level array whose order doesn't matter (e.g. "return all pairs, in any order"). */
  z.object({ kind: z.literal('unordered') }).strict(),
]);
export type Checker = z.infer<typeof checkerSchema>;

export const exampleSchema = z
  .object({
    args: z.record(z.string(), z.unknown()),
    output: z.unknown(),
    explanation: z.string().optional(),
  })
  .strict();

export const hintSchema = z
  .object({
    text: z.string().min(10),
    /** Unlocks after this many wrong answers (0 = available immediately). */
    unlockAfterWrong: z.number().int().min(0).max(20),
  })
  .strict();

const LICENSES = ['CC-BY-SA-4.0', 'CC-BY-4.0', 'MIT', 'CC0-1.0'] as const;

/** problem.yaml */
export const problemSchema = z
  .object({
    number: z.number().int().positive(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().min(3).max(80),
    difficulty: z.enum(DIFFICULTIES),
    tags: z.array(z.string().min(2)).min(1).max(5),
    signature: signatureSchema,
    /** CPU time per test process in C++ (see judge-core groupCases); other languages get a multiplier. */
    limits: z
      .object({
        timeMs: z.number().int().min(200).max(10000),
        memoryMb: z.number().int().min(64).max(1024),
      })
      .strict(),
    checker: checkerSchema.default({ kind: 'exact' }),
    constraints: z.array(z.string().min(3)).min(1),
    examples: z.array(exampleSchema).min(1).max(5),
    hints: z.array(hintSchema).min(1).max(4),
    license: z.enum(LICENSES),
    source: z.string().min(3),
    /** How many generated tests of each size class the hidden suite gets. */
    tests: z
      .object({
        random: z.number().int().min(10).max(200).default(40),
        max: z.number().int().min(1).max(10).default(3),
      })
      .strict()
      .default({ random: 40, max: 3 }),
  })
  .strict()
  .superRefine((p, ctx) => {
    const names = p.signature.params.map((x) => x.name).sort();
    p.examples.forEach((ex, i) => {
      const keys = Object.keys(ex.args).sort();
      if (keys.join() !== names.join()) {
        ctx.addIssue({
          code: 'custom',
          path: ['examples', i, 'args'],
          message: `args must be exactly: ${names.join(', ')}`,
        });
      }
    });
    p.hints.forEach((h, i) => {
      if (i > 0 && h.unlockAfterWrong < p.hints[i - 1]!.unlockAfterWrong) {
        ctx.addIssue({ code: 'custom', path: ['hints', i], message: 'hints must unlock in order' });
      }
    });
  });
export type Problem = z.infer<typeof problemSchema>;

/** Language multipliers on the C++ time limit (ARCHITECTURE §5.2). */
export const TIME_MULTIPLIER: Record<Language, number> = { cpp: 1, javascript: 2.5, python: 4 };

/** A test case: positional args in signature order, plus the expected output. */
export interface TestCase {
  args: unknown[];
  expected: unknown;
  /** Edge-case label shown on hidden failures without revealing data, e.g. "all equal". */
  category?: string;
}
