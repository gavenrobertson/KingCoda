SIZES = {"small": (1, 12, 10), "medium": (1, 2000, 1000), "max": (100000, 100000, 10**9)}


def edge_cases():
    return [
        {"category": "single reading", "args": {"speeds": [5], "k": 0}},
        {"category": "all equal", "args": {"speeds": [2, 2, 2, 2], "k": 0}},
        {"category": "k = 0 with no repeats", "args": {"speeds": [1, 2, 3, 4], "k": 0}},
        {"category": "whole array is calm", "args": {"speeds": [4, 1, 3, 2], "k": 3}},
        {"category": "extreme values", "args": {"speeds": [0, 10**9, 0, 10**9], "k": 10**9}},
        {"category": "extreme values", "args": {"speeds": [0, 10**9, 0, 10**9], "k": 10**9 - 1}},
    ]


def random_case(rng, size):
    lo_n, hi_n, hi_v = SIZES[size]
    n = rng.randint(lo_n, hi_n)
    if size == "max" and rng.random() < 0.5:
        # Slowly drifting readings: long calm runs that stress the deques.
        x, speeds = rng.randint(0, hi_v), []
        for _ in range(n):
            x = min(hi_v, max(0, x + rng.randint(-1000, 1000)))
            speeds.append(x)
    else:
        speeds = [rng.randint(0, hi_v) for _ in range(n)]
    k = rng.randint(0, hi_v // rng.choice([1, 2, 5]))
    return {"speeds": speeds, "k": k}
