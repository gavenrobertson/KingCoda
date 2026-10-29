def solve(n):
    return [bin(i).count("1") for i in range(n + 1)]
