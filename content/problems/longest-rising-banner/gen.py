def edge_cases():
    return [
        {"category": "single pole", "args": {"heights": [3]}},
        {"category": "all equal", "args": {"heights": [5, 5, 5, 5]}},
        {"category": "strictly increasing", "args": {"heights": [1, 2, 3, 4, 5, 6]}},
        {"category": "strictly decreasing", "args": {"heights": [6, 5, 4, 3, 2, 1]}},
        {"category": "extreme values", "args": {"heights": [-10**9, 10**9, -10**9, 10**9]}},
    ]


def random_case(rng, size):
    n = {"small": rng.randint(1, 12), "medium": rng.randint(1, 1500), "max": 100000}[size]
    span = {"small": 8, "medium": 10**5, "max": 10**9}[size]
    if size == "max" and rng.random() < 0.4:
        # Mostly increasing with noise → long answers.
        return {"heights": [i * 10 + rng.randint(-15, 15) for i in range(n)]}
    return {"heights": [rng.randint(-span, span) for _ in range(n)]}
