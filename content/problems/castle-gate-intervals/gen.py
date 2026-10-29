def edge_cases():
    return [
        {"category": "single opening", "args": {"openings": [[3, 3]]}},
        {"category": "touching ends", "args": {"openings": [[1, 2], [2, 3], [3, 4]]}},
        {"category": "nested", "args": {"openings": [[1, 10], [2, 3], [4, 5]]}},
        {"category": "duplicates", "args": {"openings": [[5, 6], [5, 6], [5, 6]]}},
        {"category": "extreme values", "args": {"openings": [[0, 10**9], [10**9, 10**9]]}},
        {"category": "disjoint, reverse order", "args": {"openings": [[9, 9], [5, 6], [1, 2]]}},
    ]


def random_case(rng, size):
    n = {"small": rng.randint(1, 8), "medium": rng.randint(1, 3000), "max": 100000}[size]
    span = {"small": 20, "medium": 10**5, "max": 10**9}[size]
    width = max(1, span // max(1, n // 4)) if size != "small" else 5
    out = []
    for _ in range(n):
        s = rng.randint(0, span)
        out.append([s, min(span, s + rng.randint(0, width))])
    return {"openings": out}
