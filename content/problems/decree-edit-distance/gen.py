def word(rng, n, alphabet):
    return "".join(rng.choice(alphabet) for _ in range(n))


def edge_cases():
    return [
        {"category": "both empty", "args": {"draft": "", "approved": ""}},
        {"category": "draft empty", "args": {"draft": "", "approved": "royal"}},
        {"category": "final empty", "args": {"draft": "royal", "approved": ""}},
        {"category": "identical", "args": {"draft": "decree", "approved": "decree"}},
        {"category": "nothing in common", "args": {"draft": "aaaa", "approved": "bbb"}},
    ]


def random_case(rng, size):
    n = {"small": rng.randint(0, 7), "medium": rng.randint(0, 300), "max": 2000}[size]
    m = {"small": rng.randint(0, 7), "medium": rng.randint(0, 300), "max": 2000}[size]
    alphabet = rng.choice(["ab", "abc", "abcdefghijklmnopqrstuvwxyz"])
    draft = word(rng, n, alphabet)
    if rng.random() < 0.5 and draft:
        # A near-copy with a few edits, so answers aren't always huge.
        final = list(draft)
        for _ in range(rng.randint(0, 5)):
            op, k = rng.randrange(3), rng.randrange(len(final) + 1)
            if op == 0:
                final.insert(k, rng.choice(alphabet))
            elif final and k < len(final):
                if op == 1:
                    del final[k]
                else:
                    final[k] = rng.choice(alphabet)
        final = "".join(final)[:2000]
    else:
        final = word(rng, m, alphabet)
    return {"draft": draft, "approved": final}
