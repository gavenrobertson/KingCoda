def solve(realm):
    # Bellman-Ford style relaxation until nothing changes: slow but obviously correct.
    rows, cols = len(realm), len(realm[0])
    INF = float("inf")
    dist = [[INF] * cols for _ in range(rows)]
    for r in range(rows):
        for c in range(cols):
            if realm[r][c] == "S":
                dist[r][c] = 0
    changed = True
    while changed:
        changed = False
        for r in range(rows):
            for c in range(cols):
                if realm[r][c] == "#" or dist[r][c] == INF:
                    continue
                for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                    if 0 <= nr < rows and 0 <= nc < cols and realm[nr][nc] != "#" and dist[nr][nc] > dist[r][c] + 1:
                        dist[nr][nc] = dist[r][c] + 1
                        changed = True
    for r in range(rows):
        for c in range(cols):
            if realm[r][c] == "E":
                return -1 if dist[r][c] == INF else dist[r][c]
