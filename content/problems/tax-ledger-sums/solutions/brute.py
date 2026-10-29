def solve(taxes, queries):
    return [sum(taxes[l : r + 1]) for l, r in queries]
