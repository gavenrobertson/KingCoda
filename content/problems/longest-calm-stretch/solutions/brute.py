def solve(speeds, k):
    best = 0
    for i in range(len(speeds)):
        hi = lo = speeds[i]
        for j in range(i, len(speeds)):
            hi, lo = max(hi, speeds[j]), min(lo, speeds[j])
            if hi - lo > k:
                break
            best = max(best, j - i + 1)
    return best
