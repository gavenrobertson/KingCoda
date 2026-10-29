def solve(posts, shifts):
    out = list(posts)
    for _ in range(shifts % len(posts)):
        out = [out[-1]] + out[:-1]
    return out
