import { z } from 'zod';

/**
 * Language-agnostic value types. Test data is JSON; each harness converts JSON to native values:
 * - `ListNode` ↔ array of values in list order, e.g. [1,2,3]
 * - `TreeNode` ↔ level-order array with nulls for missing children, e.g. [1,null,2]
 * `long` values must stay within ±2^53 so JavaScript reads them exactly (the validator checks this).
 */
export const SCALAR_TYPES = ['int', 'long', 'double', 'bool', 'string'] as const;
export const VALUE_TYPES = [
  ...SCALAR_TYPES,
  'int[]',
  'long[]',
  'double[]',
  'bool[]',
  'string[]',
  'int[][]',
  'string[][]',
  'ListNode',
  'TreeNode',
] as const;
export type ValueType = (typeof VALUE_TYPES)[number];
export const valueType = z.enum(VALUE_TYPES);

export const INT_MIN = -(2 ** 31);
export const INT_MAX = 2 ** 31 - 1;

const isInt = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** Whether a JSON value is a valid encoding of `type`. Used to validate examples and generated tests. */
export function conforms(value: unknown, type: ValueType): boolean {
  switch (type) {
    case 'int':
      return isInt(value, INT_MIN, INT_MAX);
    case 'long':
      return isInt(value, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    case 'double':
      return typeof value === 'number' && Number.isFinite(value);
    case 'bool':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string';
    case 'ListNode':
      return Array.isArray(value) && value.every((v) => isInt(v, INT_MIN, INT_MAX));
    case 'TreeNode':
      return (
        Array.isArray(value) &&
        (value.length === 0 || value[0] !== null) &&
        value.every((v) => v === null || isInt(v, INT_MIN, INT_MAX))
      );
    default: {
      if (type.endsWith('[][]')) {
        const inner = type.slice(0, -2) as ValueType;
        return Array.isArray(value) && value.every((row) => conforms(row, inner));
      }
      const inner = type.slice(0, -2) as ValueType;
      return Array.isArray(value) && value.every((v) => conforms(v, inner));
    }
  }
}
