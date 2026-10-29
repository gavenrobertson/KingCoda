from functools import lru_cache


def solve(draft, approved):
    @lru_cache(maxsize=None)
    def go(i, j):
        if i == len(draft):
            return len(approved) - j
        if j == len(approved):
            return len(draft) - i
        if draft[i] == approved[j]:
            return go(i + 1, j + 1)
        return 1 + min(go(i + 1, j), go(i, j + 1), go(i + 1, j + 1))

    return go(0, 0)
