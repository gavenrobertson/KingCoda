OPEN, CLOSE = "([{", ")]}"


def edge_cases():
    return [
        {"category": "empty plan", "args": {"plan": ""}},
        {"category": "single opening gate", "args": {"plan": "("}},
        {"category": "single closing gate", "args": {"plan": "]"}},
        {"category": "deep nesting", "args": {"plan": "(" * 5000 + ")" * 5000}},
        {"category": "wrong kind at the end", "args": {"plan": "{[()]]"}},
    ]


def balanced(rng, n):
    out, stack = [], []
    while len(out) < n:
        if stack and (rng.random() < 0.5 or len(out) + len(stack) >= n):
            out.append(CLOSE[OPEN.index(stack.pop())])
        else:
            c = rng.choice(OPEN)
            stack.append(c)
            out.append(c)
    return "".join(out + [CLOSE[OPEN.index(c)] for c in reversed(stack)])


def random_case(rng, size):
    n = {"small": rng.randint(0, 10), "medium": rng.randint(0, 2000), "max": 100000}[size]
    plan = list(balanced(rng, n // 2 * 2))[:n] if n else []
    # Corrupt some plans so every answer type shows up.
    roll = rng.random()
    if plan and roll < 0.3:
        plan[rng.randrange(len(plan))] = rng.choice(OPEN + CLOSE)
    elif plan and roll < 0.45:
        plan.pop()
    return {"plan": "".join(plan)}
