def edge_cases():
    return [
        {"category": "single chest", "args": {"chests": [-4], "k": 1}},
        {"category": "k is the lightest", "args": {"chests": [5, 1, 9], "k": 3}},
        {"category": "all equal", "args": {"chests": [7, 7, 7, 7], "k": 3}},
        {"category": "extreme values", "args": {"chests": [10**9, -10**9, 0], "k": 2}},
    ]


def random_case(rng, size):
    n = {"small": rng.randint(1, 10), "medium": rng.randint(1, 3000), "max": 100000}[size]
    span = {"small": 6, "medium": 10**5, "max": 10**9}[size]
    chests = [rng.randint(-span, span) for _ in range(n)]
    return {"chests": chests, "k": rng.randint(1, n)}
