def word(rng, alphabet, lo, hi):
    return "".join(rng.choice(alphabet) for _ in range(rng.randint(lo, hi)))


def edge_cases():
    return [
        {"category": "prefix equals title", "args": {"titles": ["moat"], "prefixes": ["moat"]}},
        {"category": "prefix longer than every title", "args": {"titles": ["a", "ab"], "prefixes": ["abc"]}},
        {"category": "duplicate titles", "args": {"titles": ["oak"] * 5, "prefixes": ["o", "oak", "oaks"]}},
        {"category": "no shared letters", "args": {"titles": ["zzz"], "prefixes": ["a"]}},
    ]


def random_case(rng, size):
    if size == "small":
        n, m, alphabet, hi = rng.randint(1, 8), rng.randint(1, 6), "ab", 4
    elif size == "medium":
        n, m, alphabet, hi = rng.randint(1, 2000), rng.randint(1, 2000), "abcd", 12
    else:
        n, m, alphabet, hi = 20000, 20000, "abcdefghijklmnopqrstuvwxyz"[: rng.choice([2, 5, 26])], 50
    titles = [word(rng, alphabet, 1, hi) for _ in range(n)]
    prefixes = []
    for _ in range(m):
        if rng.random() < 0.7:
            t = rng.choice(titles)
            prefixes.append(t[: rng.randint(1, len(t))])
        else:
            prefixes.append(word(rng, alphabet, 1, hi))
    return {"titles": titles, "prefixes": prefixes}
