def edge_cases():
    return [
        {"category": "zero", "args": {"n": 0}},
        {"category": "one", "args": {"n": 1}},
        {"category": "power of two", "args": {"n": 1024}},
        {"category": "one below a power of two", "args": {"n": 1023}},
    ]


def random_case(rng, size):
    return {"n": {"small": rng.randint(0, 64), "medium": rng.randint(0, 5000), "max": 100000}[size]}
