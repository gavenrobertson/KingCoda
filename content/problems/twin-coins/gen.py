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


def worst_case(rng):
    # A quadratic scan must look at every pair: either no pair exists (even weights, odd target)
    # or the only pair ends at the last coin.
    n = 100000
    if rng.random() < 0.5:
        weights = [2 * rng.randint(-(10**8), 10**8) for _ in range(n)]
        return {"weights": weights, "target": 2 * rng.randint(-(10**8), 10**8) + 1}
    weights = rng.sample(range(1, 10**9), n)
    target = weights[rng.randrange(n - 1)] + weights[-1]
    # Keep the pair unique: drop any other coin that would complete one.
    seen, unique = set(), []
    for w in weights[:-1]:
        if target - w in seen and target - w != w:
            continue
        seen.add(w)
        unique.append(w)
    i = rng.randrange(len(unique))
    unique[i] = target - weights[-1]
    return {"weights": unique + [weights[-1]], "target": target}


def random_case(rng, size):
    if size == "max" and rng.random() < 0.67:
        return worst_case(rng)
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
