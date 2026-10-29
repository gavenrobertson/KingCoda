def solve(weights, target):
    for j in range(len(weights)):
        for i in range(j):
            if weights[i] + weights[j] == target:
                return [i, j]
    return [-1, -1]
