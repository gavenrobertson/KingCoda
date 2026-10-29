import type { ValueType } from '@kingcoda/problem-schema';

export const cppType: Record<ValueType, string> = {
  int: 'int',
  long: 'long long',
  double: 'double',
  bool: 'bool',
  string: 'string',
  'int[]': 'vector<int>',
  'long[]': 'vector<long long>',
  'double[]': 'vector<double>',
  'bool[]': 'vector<bool>',
  'string[]': 'vector<string>',
  'int[][]': 'vector<vector<int>>',
  'string[][]': 'vector<vector<string>>',
  ListNode: 'ListNode*',
  TreeNode: 'TreeNode*',
};

/** How a C++ parameter is declared: containers by reference, everything else by value. */
export function cppParam(type: ValueType): string {
  const t = cppType[type];
  return t.startsWith('vector') || t === 'string' ? `${t}&` : t;
}

export const pyType: Record<ValueType, string> = {
  int: 'int',
  long: 'int',
  double: 'float',
  bool: 'bool',
  string: 'str',
  'int[]': 'list[int]',
  'long[]': 'list[int]',
  'double[]': 'list[float]',
  'bool[]': 'list[bool]',
  'string[]': 'list[str]',
  'int[][]': 'list[list[int]]',
  'string[][]': 'list[list[str]]',
  ListNode: 'Optional[ListNode]',
  TreeNode: 'Optional[TreeNode]',
};

export const jsType: Record<ValueType, string> = {
  int: 'number',
  long: 'number',
  double: 'number',
  bool: 'boolean',
  string: 'string',
  'int[]': 'number[]',
  'long[]': 'number[]',
  'double[]': 'number[]',
  'bool[]': 'boolean[]',
  'string[]': 'string[]',
  'int[][]': 'number[][]',
  'string[][]': 'string[][]',
  ListNode: 'ListNode | null',
  TreeNode: 'TreeNode | null',
};

export const usesList = (types: ValueType[]) => types.includes('ListNode');
export const usesTree = (types: ValueType[]) => types.includes('TreeNode');
