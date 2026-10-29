def solve(quests, prereqs):
    # Repeatedly finish any quest whose requirements are all done.
    done = [False] * quests
    progress = True
    while progress:
        progress = False
        for q in range(quests):
            if not done[q] and all(done[b] for a, b in prereqs if a == q):
                done[q] = True
                progress = True
    return all(done)
