def edge_cases():
    return [
        {"category": "no jewels", "args": {"jewels": []}},
        {"category": "one jewel", "args": {"jewels": [-5]}},
        {"category": "already sorted", "args": {"jewels": [1, 2, 3]}},
        {"category": "negatives and zero", "args": {"jewels": [0, -100, 100]}},
    ]


def random_case(rng, size):
    n = {"small": rng.randint(0, 5), "medium": rng.randint(0, 10), "max": 12}[size]
    return {"jewels": rng.sample(range(-100, 101), n)}
