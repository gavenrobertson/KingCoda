def edge_cases():
    return [
        {"category": "single sale", "args": {"prices": [-7]}},
        {"category": "all equal", "args": {"prices": [4, 4, 4, 4]}},
        {"category": "increasing", "args": {"prices": [1, 2, 3, 4, 5]}},
        {"category": "decreasing", "args": {"prices": [5, 4, 3, 2, 1]}},
        {"category": "extreme values", "args": {"prices": [10**6, -10**6, 10**6, -10**6]}},
    ]


def random_case(rng, size):
    n = {"small": rng.randint(1, 12), "medium": rng.randint(1, 3000), "max": 100000}[size]
    span = 10 if size == "small" else 10**6
    if size == "max" and rng.random() < 0.3:
        return {"prices": sorted(rng.randint(-span, span) for _ in range(n))}
    return {"prices": [rng.randint(-span, span) for _ in range(n)]}
