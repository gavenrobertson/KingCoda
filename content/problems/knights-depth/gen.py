def to_level_order(nodes):
    """nodes: dict id -> (val, left_id, right_id); returns LeetCode-style level order with nulls."""
    if not nodes:
        return []
    out, queue, q = [], [0], 0
    while q < len(queue):
        n = queue[q]
        q += 1
        if n is None:
            out.append(None)
            continue
        val, l, r = nodes[n]
        out.append(val)
        queue.append(l)
        queue.append(r)
    while out and out[-1] is None:
        out.pop()
    return out


def random_tree(rng, n, shape):
    nodes = {}
    for i in range(n):
        nodes[i] = [rng.randint(-10**5, 10**5), None, None]
        if i == 0:
            continue
        if shape == "chain":
            parent, side = i - 1, rng.choice([1, 2])
        else:
            while True:
                parent, side = rng.randrange(i), rng.choice([1, 2])
                if nodes[parent][side] is None:
                    break
        nodes[parent][side] = i
    return to_level_order({k: tuple(v) for k, v in nodes.items()})


def edge_cases():
    return [
        {"category": "empty", "args": {"root": []}},
        {"category": "single knight", "args": {"root": [7]}},
        {"category": "left chain", "args": {"root": [1, 2, None, 3, None, 4]}},
        {"category": "right chain", "args": {"root": [1, None, 2, None, 3]}},
    ]


def random_case(rng, size):
    n = {"small": rng.randint(0, 12), "medium": rng.randint(0, 2000), "max": 10000}[size]
    shape = "chain" if size == "max" and rng.random() < 0.5 else "random"
    return {"root": random_tree(rng, n, shape)}
