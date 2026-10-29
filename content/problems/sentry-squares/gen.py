def edge_cases():
    return [
        {"category": "single sentry", "args": {"positions": [-3]}},
        {"category": "all west of the gate", "args": {"positions": [-9, -5, -2]}},
        {"category": "all east of the gate", "args": {"positions": [0, 4, 8]}},
        {"category": "mirror pairs", "args": {"positions": [-2, -2, 2, 2]}},
        {"category": "extreme values", "args": {"positions": [-10**4, 0, 10**4]}},
    ]


def random_case(rng, size):
    n = {"small": rng.randint(1, 10), "medium": rng.randint(1, 3000), "max": 100000}[size]
    span = 20 if size == "small" else 10**4
    return {"positions": sorted(rng.randint(-span, span) for _ in range(n))}
