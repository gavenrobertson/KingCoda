def rotated(rng, n, span):
    values = sorted(rng.sample(range(-span, span + 1), n))
    k = rng.randrange(n)
    return values[k:] + values[:k]


def edge_cases():
    return [
        {"category": "single vault, found", "args": {"vaults": [5], "target": 5}},
        {"category": "single vault, missing", "args": {"vaults": [5], "target": 4}},
        {"category": "not rotated", "args": {"vaults": [1, 2, 3, 4, 5], "target": 5}},
        {"category": "rotated by one", "args": {"vaults": [5, 1, 2, 3, 4], "target": 5}},
        {"category": "two vaults", "args": {"vaults": [3, 1], "target": 1}},
        {"category": "extreme values", "args": {"vaults": [10**9, -10**9], "target": -10**9}},
    ]


def random_case(rng, size):
    n = {"small": rng.randint(1, 10), "medium": rng.randint(1, 3000), "max": 100000}[size]
    span = {"small": 15, "medium": 10**6, "max": 10**9}[size]
    vaults = rotated(rng, n, span)
    target = rng.choice(vaults) if rng.random() < 0.6 else rng.randint(-span, span)
    return {"vaults": vaults, "target": target}
