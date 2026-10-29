def solve(titles, prefixes):
    return [sum(1 for t in titles if t.startswith(p)) for p in prefixes]
