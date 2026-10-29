The royal genealogist stores the bloodline as a **binary search tree** of birth-order numbers: every member in a node's left subtree has a smaller number than the node, and every member in its right subtree a larger one.

Given the `root` and the numbers `a` and `b` of two members, return the number of their **nearest common ancestor**: the deepest member who has both `a` and `b` in their subtree. A member is considered part of their own subtree.
