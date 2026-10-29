from functools import lru_cache


def solve(denominations, price):
    coins = sorted(set(denominations), reverse=True)

    @lru_cache(maxsize=None)
    def go(i, rest):
        # Fewest coins paying `rest` using coins[i:]; tries every count of coins[i].
        if rest == 0:
            return 0
        if i == len(coins):
            return float("inf")
        best = float("inf")
        for k in range(rest // coins[i] + 1):
            best = min(best, k + go(i + 1, rest - k * coins[i]))
        return best

    ans = go(0, price)
    return -1 if ans == float("inf") else ans
