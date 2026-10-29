def solve(walls):
    total = 0
    for i, h in enumerate(walls):
        level = min(max(walls[: i + 1]), max(walls[i:]))
        total += level - h
    return total
