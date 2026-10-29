import sys


def solve(hall, courage):
    sys.setrecursionlimit(10000)
    rows, cols = len(hall), len(hall[0])

    def walk(r, c, traps):
        if r >= rows or c >= cols or hall[r][c] == "#":
            return 0
        traps += hall[r][c] == "T"
        if traps > courage:
            return 0
        if r == rows - 1 and c == cols - 1:
            return 1
        return walk(r + 1, c, traps) + walk(r, c + 1, traps)

    return walk(0, 0, 0) % 1_000_000_007
