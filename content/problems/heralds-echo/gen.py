import string

ALPHABET = string.ascii_letters + string.digits + " ,.!?'-:;"


def edge_cases():
    return [
        {"category": "empty", "args": {"decree": ""}},
        {"category": "only punctuation", "args": {"decree": "?!., ;"}},
        {"category": "single character", "args": {"decree": "a"}},
        {"category": "case differs", "args": {"decree": "AbBa"}},
        {"category": "digits vs letters", "args": {"decree": "0P"}},
    ]


def random_case(rng, size):
    n = {"small": rng.randint(0, 10), "medium": rng.randint(0, 3000), "max": 200000}[size]
    pool = "ab1 ,." if size == "small" else ALPHABET
    half = [rng.choice(pool) for _ in range(n // 2)]
    if rng.random() < 0.5:
        # Mirror it, then shuffle case and sprinkle punctuation so echoes are common.
        mirrored = half + ([rng.choice(pool)] if n % 2 else []) + half[::-1]
        chars = [c.upper() if rng.random() < 0.3 else c for c in mirrored]
    else:
        chars = [rng.choice(pool) for _ in range(n)]
    return {"decree": "".join(chars)}
