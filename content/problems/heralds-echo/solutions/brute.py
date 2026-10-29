def solve(decree):
    kept = [c.lower() for c in decree if c.isascii() and c.isalnum()]
    return kept == kept[::-1]
