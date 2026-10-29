The treasury's vault numbers were stored in increasing order, then the whole row was **rotated**: some prefix moved to the end. So `[10, 20, 30, 40, 50, 60]` might now read `[40, 50, 60, 10, 20, 30]`.

Given the rotated `vaults` (all distinct) and a `target` vault number, return its index, or `-1` if it isn't there.

Your solution should run in `O(log n)` time.
