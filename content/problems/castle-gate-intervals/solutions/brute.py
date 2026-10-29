def solve(openings):
    # Repeatedly merge any two overlapping or touching intervals until none remain.
    items = [list(o) for o in openings]
    merged = True
    while merged:
        merged = False
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                a, b = items[i], items[j]
                if a[0] <= b[1] and b[0] <= a[1]:
                    items[i] = [min(a[0], b[0]), max(a[1], b[1])]
                    del items[j]
                    merged = True
                    break
            if merged:
                break
    return sorted(items)
