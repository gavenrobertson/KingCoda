def edge_cases():
    return [
        {"category": "one post", "args": {"posts": [42], "shifts": 10**9}},
        {"category": "no shifts", "args": {"posts": [1, 2, 3], "shifts": 0}},
        {"category": "full circle", "args": {"posts": [1, 2, 3], "shifts": 3}},
        {"category": "huge shift count", "args": {"posts": [5, 6, 7, 8], "shifts": 10**9}},
    ]


def random_case(rng, size):
    n = {"small": rng.randint(1, 8), "medium": rng.randint(1, 3000), "max": 100000}[size]
    shifts = rng.randint(0, 20) if size == "small" else rng.randint(0, 10**9)
    return {"posts": [rng.randint(-10**9, 10**9) for _ in range(n)], "shifts": shifts}
