def solve(plan):
    # Repeatedly delete adjacent matching pairs, tracking original indices.
    items = list(enumerate(plan))
    pairs = {")": "(", "]": "[", "}": "{"}
    changed = True
    while changed:
        changed = False
        for k in range(len(items) - 1):
            if items[k + 1][1] in pairs and pairs[items[k + 1][1]] == items[k][1]:
                del items[k : k + 2]
                changed = True
                break
    # What's left is a run of unmatched characters; the first closing one (if any) is the first bad gate,
    # unless an earlier-index violation exists. Closers left over all broke the rule at their own index.
    closers = [i for i, ch in items if ch in pairs]
    if closers:
        return min(closers)
    return -1 if not items else len(plan)
