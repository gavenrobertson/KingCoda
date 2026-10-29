import { pythonName, type Language, type Signature } from '@kingcoda/problem-schema';
import { cppParam, cppType, jsType, pyType, usesList, usesTree } from './types.ts';

function allTypes(sig: Signature) {
  return [...sig.params.map((p) => p.type), sig.returns];
}

const PY_LIST = `# The judge provides ListNode:
# class ListNode:
#     def __init__(self, val=0, next=None):
#         self.val = val
#         self.next = next
`;
const PY_TREE = `# The judge provides TreeNode:
# class TreeNode:
#     def __init__(self, val=0, left=None, right=None):
#         self.val = val
#         self.left = left
#         self.right = right
`;
const JS_LIST = `// The judge provides ListNode:
// class ListNode { constructor(val = 0, next = null) { this.val = val; this.next = next; } }
`;
const JS_TREE = `// The judge provides TreeNode:
// class TreeNode { constructor(val = 0, left = null, right = null) { this.val = val; this.left = left; this.right = right; } }
`;
const CPP_LIST = `// The judge provides ListNode:
// struct ListNode {
//     int val;
//     ListNode *next;
//     ListNode(int x = 0, ListNode *next = nullptr);
// };
`;
const CPP_TREE = `// The judge provides TreeNode:
// struct TreeNode {
//     int val;
//     TreeNode *left, *right;
//     TreeNode(int x = 0, TreeNode *left = nullptr, TreeNode *right = nullptr);
// };
`;

/** Starter code shown in the editor for a new attempt. */
export function starterCode(sig: Signature, lang: Language): string {
  const types = allTypes(sig);
  const list = usesList(types);
  const tree = usesTree(types);
  switch (lang) {
    case 'python': {
      const params = sig.params.map((p) => `${pythonName(p.name)}: ${pyType[p.type]}`).join(', ');
      return `${list ? PY_LIST + '\n' : ''}${tree ? PY_TREE + '\n' : ''}class Solution:
    def ${pythonName(sig.function)}(self, ${params}) -> ${pyType[sig.returns]}:
        pass
`;
    }
    case 'javascript': {
      const doc = sig.params.map((p) => ` * @param {${jsType[p.type]}} ${p.name}`).join('\n');
      return `${list ? JS_LIST + '\n' : ''}${tree ? JS_TREE + '\n' : ''}/**
${doc}
 * @return {${jsType[sig.returns]}}
 */
function ${sig.function}(${sig.params.map((p) => p.name).join(', ')}) {

}
`;
    }
    case 'cpp': {
      const params = sig.params.map((p) => `${cppParam(p.type)} ${p.name}`).join(', ');
      return `${list ? CPP_LIST + '\n' : ''}${tree ? CPP_TREE + '\n' : ''}class Solution {
public:
    ${cppType[sig.returns]} ${sig.function}(${params}) {

    }
};
`;
    }
  }
}
