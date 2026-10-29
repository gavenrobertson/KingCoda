def edge_cases():
    return [
        {"category": "no requirements", "args": {"quests": 4, "prereqs": []}},
        {"category": "self requirement", "args": {"quests": 2, "prereqs": [[1, 1]]}},
        {"category": "duplicate requirement", "args": {"quests": 2, "prereqs": [[1, 0], [1, 0]]}},
        {"category": "long cycle", "args": {"quests": 5, "prereqs": [[1, 0], [2, 1], [3, 2], [4, 3], [0, 4]]}},
        {"category": "diamond", "args": {"quests": 4, "prereqs": [[1, 0], [2, 0], [3, 1], [3, 2]]}},
    ]


def random_case(rng, size):
    n = {"small": rng.randint(1, 7), "medium": rng.randint(1, 3000), "max": 100000}[size]
    m = {"small": rng.randint(0, 9), "medium": rng.randint(0, 6000), "max": 200000}[size]
    order = list(range(n))
    rng.shuffle(order)
    rank = {q: i for i, q in enumerate(order)}
    requires = []
    for _ in range(m):
        a, b = rng.randrange(n), rng.randrange(n)
        if a != b and rank[a] < rank[b]:
            a, b = b, a  # point "earlier" requirements forward so the graph is acyclic...
        requires.append([a, b])
    if requires and rng.random() < 0.4:
        # ...then sometimes add one backward edge to create a cycle.
        a, b = requires[rng.randrange(len(requires))]
        requires.append([b, a])
    return {"quests": n, "prereqs": requires}
