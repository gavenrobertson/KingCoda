def edge_cases():
    return [
        {"category": "two coins that match", "args": {"weights": [3, 4], "target": 7}},
        {"category": "two coins that don't", "args": {"weights": [3, 4], "target": 8}},
        {"category": "duplicates", "args": {"weights": [2, 2, 2, 2], "target": 4}},
        {"category": "negatives", "args": {"weights": [-3, 8, -5, 1], "target": -4}},
        {"category": "extreme values", "args": {"weights": [10**9, 10**9, -10**9], "target": 2 * 10**9}},
        {"category": "extreme values", "args": {"weights": [-10**9, -10**9], "target": -2 * 10**9}},
        {"category": "tie on the second coin", "args": {"weights": [1, 6, 6, 1], "target": 7}},
    ]


def random_case(rng, size):
    n = {"small": rng.randint(2, 10), "medium": rng.randint(2, 3000), "max": 100000}[size]
    span = {"small": 6, "medium": 10**4, "max": 10**9}[size]
    weights = [rng.randint(-span, span) for _ in range(n)]
    if rng.random() < 0.7:
        i, j = rng.sample(range(n), 2)
        target = weights[i] + weights[j]
    else:
        target = rng.randint(-2 * span, 2 * span)
    target = max(-2 * 10**9, min(2 * 10**9, target))
    return {"weights": weights, "target": target}
