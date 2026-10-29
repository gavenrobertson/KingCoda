def place(grid, rng):
    rows, cols = len(grid), len(grid[0])
    cells = rng.sample(range(rows * cols), 2)
    for ch, cell in zip("SE", cells):
        grid[cell // cols][cell % cols] = ch
    return ["".join(row) for row in grid]


def edge_cases():
    return [
        {"category": "adjacent", "args": {"realm": ["SE"]}},
        {"category": "single column", "args": {"realm": ["S", ".", ".", "E"]}},
        {"category": "walled in", "args": {"realm": ["S#.", "##.", "..E"]}},
        {"category": "winding corridor", "args": {"realm": ["S....", "####.", ".....", ".####", "....E"]}},
    ]


def random_case(rng, size):
    rows = {"small": rng.randint(1, 6), "medium": rng.randint(1, 120), "max": 1000}[size]
    cols = {"small": rng.randint(1, 6), "medium": rng.randint(1, 120), "max": 1000}[size]
    if rows * cols < 2:
        cols = 2
    wall = rng.choice([0.0, 0.2, 0.3, 0.4])
    grid = [["#" if rng.random() < wall else "." for _ in range(cols)] for _ in range(rows)]
    return {"realm": place(grid, rng)}
