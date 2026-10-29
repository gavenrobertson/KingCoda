def edge_cases():
    return [
        {"category": "single day", "args": {"taxes": [7], "queries": [[0, 0]]}},
        {"category": "all refunds", "args": {"taxes": [-5, -5, -5], "queries": [[0, 2], [1, 1]]}},
        {"category": "overflows 32 bits", "args": {"taxes": [10**9] * 5, "queries": [[0, 4]]}},
        {"category": "overflows 32 bits", "args": {"taxes": [-10**9] * 5, "queries": [[0, 4], [2, 3]]}},
        {"category": "whole ledger repeatedly", "args": {"taxes": [1, 2, 3], "queries": [[0, 2]] * 4}},
    ]


def random_case(rng, size):
    n = {"small": rng.randint(1, 8), "medium": rng.randint(1, 2000), "max": 100000}[size]
    m = {"small": rng.randint(1, 6), "medium": rng.randint(1, 2000), "max": 100000}[size]
    taxes = [rng.randint(-10**9, 10**9) for _ in range(n)]
    queries = []
    for _ in range(m):
        l = rng.randrange(n)
        r = rng.randrange(l, n) if rng.random() < 0.7 else n - 1
        queries.append([l, r])
    return {"taxes": taxes, "queries": queries}
