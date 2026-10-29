A herald must walk from the great doors in the **top-left** square of the throne room `hall` to the throne in the **bottom-right** square, moving only **right** or **down** one square at a time.

Each square is `'.'` (open), `'#'` (a pillar, which can't be entered) or `'T'` (a trap door, which can be crossed but is frightening). The herald has the `courage` to step on at most `courage` trap squares in total, counting the start and the throne if they are traps.

Return the number of different routes the herald can take, modulo `10⁹ + 7`.
