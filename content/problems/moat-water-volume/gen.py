def edge_cases():
    return [
        {"category": "single column", "args": {"walls": [5]}},
        {"category": "two columns", "args": {"walls": [3, 9]}},
        {"category": "flat", "args": {"walls": [2, 2, 2]}},
        {"category": "a single deep well", "args": {"walls": [10**9, 0, 10**9]}},
        {"category": "valley", "args": {"walls": [5, 4, 3, 2, 1, 2, 3, 4, 5]}},
        {"category": "mountain", "args": {"walls": [1, 2, 3, 2, 1]}},
    ]


def random_case(rng, size):
    n = {"small": rng.randint(1, 12), "medium": rng.randint(1, 3000), "max": 100000}[size]
    span = {"small": 6, "medium": 10**5, "max": 10**9}[size]
    return {"walls": [rng.randint(0, span) for _ in range(n)]}
