from itertools import combinations


def solve(jewels):
    values = sorted(jewels)
    return [list(c) for r in range(len(values) + 1) for c in combinations(values, r)]
