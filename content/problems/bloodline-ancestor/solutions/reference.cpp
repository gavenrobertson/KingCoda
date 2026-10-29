class Solution {
public:
    int nearestCommonAncestor(TreeNode* root, int a, int b) {
        long long lo = min(a, b), hi = max(a, b);
        while (root) {
            if (hi < root->val) root = root->left;
            else if (lo > root->val) root = root->right;
            else return root->val;
        }
        return INT_MIN;  // unreachable for valid input
    }
};
