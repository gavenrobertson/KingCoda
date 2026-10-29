def edge_cases():
    return [
        {"category": "one province", "args": {"n": 1, "roads": [[0, 0]]}},
        {"category": "no roads", "args": {"n": 5, "roads": []}},
        {"category": "self loops and repeats", "args": {"n": 3, "roads": [[1, 1], [0, 1], [1, 0], [0, 1]]}},
        {"category": "a single chain", "args": {"n": 5, "roads": [[0, 1], [1, 2], [2, 3], [3, 4]]}},
    ]


def random_case(rng, size):
    n = {"small": rng.randint(1, 8), "medium": rng.randint(1, 3000), "max": 100000}[size]
    m = {"small": rng.randint(0, 10), "medium": rng.randint(0, 3000), "max": 100000}[size]
    if size == "max" and rng.random() < 0.5:
        # A long path built in shuffled order stresses path compression.
        order = list(range(n))
        rng.shuffle(order)
        roads = [[order[i], order[i + 1]] for i in range(min(m, n - 1))]
        rng.shuffle(roads)
    else:
        roads = [[rng.randrange(n), rng.randrange(n)] for _ in range(m)]
    return {"n": n, "roads": roads}
