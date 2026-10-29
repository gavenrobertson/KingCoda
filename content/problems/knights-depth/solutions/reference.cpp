class Solution {
public:
    int commandDepth(TreeNode* root) {
        if (!root) return 0;
        return 1 + max(commandDepth(root->left), commandDepth(root->right));
    }
};
