def edge_cases():
    return [
        {"category": "empty", "args": {"head": []}},
        {"category": "one marcher", "args": {"head": [5]}},
        {"category": "two marchers", "args": {"head": [1, 2]}},
        {"category": "repeated banners", "args": {"head": [3, 3, 3]}},
        {"category": "extreme values", "args": {"head": [10**9, -10**9, 0]}},
    ]


def random_case(rng, size):
    n = {"small": rng.randint(0, 10), "medium": rng.randint(0, 3000), "max": 100000}[size]
    return {"head": [rng.randint(-10**9, 10**9) for _ in range(n)]}
