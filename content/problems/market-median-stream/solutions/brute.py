def solve(prices):
    out, seen = [], []
    for p in prices:
        seen.append(p)
        s = sorted(seen)
        n = len(s)
        out.append(float(s[n // 2]) if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2)
    return out
