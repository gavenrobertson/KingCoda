def solve(chests, k):
    return sorted(chests, reverse=True)[k - 1]
