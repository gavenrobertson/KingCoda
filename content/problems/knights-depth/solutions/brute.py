def solve(root):
    # Level-order array: the depth is the number of levels containing a real node.
    if not root:
        return 0
    # Rebuild parent links from the LeetCode-style level order, then measure each node's level.
    level = {0: 1}
    queue, i, best = [0], 1, 1
    q = 0
    while q < len(queue) and i < len(root):
        parent = queue[q]
        q += 1
        for _ in range(2):
            if i < len(root) and root[i] is not None:
                level[i] = level[parent] + 1
                best = max(best, level[i])
                queue.append(i)
            i += 1
    return best
