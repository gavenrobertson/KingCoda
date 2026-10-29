def solve(heights):
    best = [1] * len(heights)
    for i in range(len(heights)):
        for j in range(i):
            if heights[j] < heights[i]:
                best[i] = max(best[i], best[j] + 1)
    return max(best)
