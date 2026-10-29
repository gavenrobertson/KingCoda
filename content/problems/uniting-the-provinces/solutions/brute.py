def solve(n, roads):
    # Relabel whole components on every merge: O(n) per road.
    label = list(range(n))
    out, kingdoms = [], n
    for a, b in roads:
        la, lb = label[a], label[b]
        if la != lb:
            label = [la if x == lb else x for x in label]
            kingdoms -= 1
        out.append(kingdoms)
    return out
