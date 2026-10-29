def level_order(keys):
    """Insert keys into a BST in the given order, then serialise level by level with nulls."""
    left, right, root = {}, {}, None
    for k in keys:
        if root is None:
            root = k
            continue
        cur = root
        while True:
            side = left if k < cur else right
            if cur in side:
                cur = side[cur]
            else:
                side[cur] = k
                break
    out, queue, q = [], [root], 0
    while q < len(queue):
        n = queue[q]
        q += 1
        if n is None:
            out.append(None)
            continue
        out.append(n)
        queue.append(left.get(n))
        queue.append(right.get(n))
    while out and out[-1] is None:
        out.pop()
    return out


def edge_cases():
    return [
        {"category": "single member", "args": {"root": [5], "a": 5, "b": 5}},
        {"category": "same member twice", "args": {"root": [5, 3, 8], "a": 3, "b": 3}},
        {"category": "ancestor of the other", "args": {"root": [5, 3, 8, 1], "a": 1, "b": 3}},
        {"category": "left chain", "args": {"root": level_order([5, 4, 3, 2, 1]), "a": 1, "b": 4}},
        {"category": "extreme values", "args": {"root": level_order([0, -10**9, 10**9]), "a": -10**9, "b": 10**9}},
    ]


def random_case(rng, size):
    n = {"small": rng.randint(1, 10), "medium": rng.randint(1, 2000), "max": 100000}[size]
    span = {"small": 30, "medium": 10**6, "max": 10**9}[size]
    keys = rng.sample(range(-span, span + 1), n)
    if size == "max" and rng.random() < 0.3:
        # Mostly sorted insertion → a deep, skinny tree (still within the stack for an iterative walk).
        keys.sort()
        cut = rng.randint(0, n)
        keys = keys[cut:] + keys[:cut]
        keys = keys[:3000] + rng.sample(keys[3000:], len(keys) - 3000) if n > 3000 else keys
    a, b = rng.choice(keys), rng.choice(keys)
    return {"root": level_order(keys), "a": a, "b": b}
