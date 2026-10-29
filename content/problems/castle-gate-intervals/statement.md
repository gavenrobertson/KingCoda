The gatekeeper's log lists every time the castle gate was opened, as `openings[i] = [start, end]` (inclusive, in minutes after dawn), in no particular order. Openings may overlap, and two openings that touch (one ends at minute `t`, the next starts at `t`) count as one stretch.

Return the stretches during which the gate was open, merged and sorted by start time.
