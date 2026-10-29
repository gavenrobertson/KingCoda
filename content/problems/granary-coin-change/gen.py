def edge_cases():
    return [
        {"category": "price zero", "args": {"denominations": [2, 5], "price": 0}},
        {"category": "greedy fails", "args": {"denominations": [1, 3, 4], "price": 6}},
        {"category": "unreachable", "args": {"denominations": [4, 6], "price": 7}},
        {"category": "only ones", "args": {"denominations": [1], "price": 10000}},
        {"category": "repeated denominations", "args": {"denominations": [3, 3, 7], "price": 13}},
    ]


def random_case(rng, size):
    k = {"small": rng.randint(1, 3), "medium": rng.randint(1, 8), "max": 12}[size]
    hi = {"small": 9, "medium": 300, "max": 10**4}[size]
    price = {"small": rng.randint(0, 25), "medium": rng.randint(0, 2000), "max": 10**4}[size]
    denominations = [rng.randint(1, hi) for _ in range(k)]
    return {"denominations": denominations, "price": price}
