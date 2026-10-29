def solve(root, a, b):
    # Rebuild parent pointers from level order, then walk a's ancestry against b's.
    parent, values = {}, {}
    queue, i, q = [0], 1, 0
    values[0] = root[0]
    while q < len(queue) and i < len(root):
        node = queue[q]
        q += 1
        for _ in range(2):
            if i < len(root) and root[i] is not None:
                values[i] = root[i]
                parent[i] = node
                queue.append(i)
            i += 1
    index = {v: k for k, v in values.items()}

    def chain(k):
        out = [k]
        while k in parent:
            k = parent[k]
            out.append(k)
        return out

    ancestors_a = set(chain(index[a]))
    for k in chain(index[b]):
        if k in ancestors_a:
            return values[k]
