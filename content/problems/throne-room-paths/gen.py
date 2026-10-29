def edge_cases():
    return [
        {"category": "single square", "args": {"hall": ["."], "courage": 0}},
        {"category": "single trap square", "args": {"hall": ["T"], "courage": 0}},
        {"category": "blocked doors", "args": {"hall": ["#.", ".."], "courage": 3}},
        {"category": "blocked throne", "args": {"hall": ["..", ".#"], "courage": 3}},
        {"category": "one row", "args": {"hall": [".T.T."], "courage": 2}},
        {"category": "all traps", "args": {"hall": ["TTT", "TTT"], "courage": 4}},
    ]


def random_case(rng, size):
    rows = {"small": rng.randint(1, 6), "medium": rng.randint(1, 60), "max": 200}[size]
    cols = {"small": rng.randint(1, 6), "medium": rng.randint(1, 60), "max": 200}[size]
    pillar, trap = rng.choice([(0.0, 0.1), (0.1, 0.2), (0.2, 0.3)])
    hall = []
    for _ in range(rows):
        row = []
        for _ in range(cols):
            x = rng.random()
            row.append("#" if x < pillar else "T" if x < pillar + trap else ".")
        hall.append("".join(row))
    courage = rng.randint(0, 6) if size == "small" else rng.randint(0, 20)
    return {"hall": hall, "courage": courage}
