-- Full-text search over published problems (title, tags, statement). The publish tool keeps it in
-- step with `problem`: one row per problem, rowid = problem.number. Drizzle can't model FTS5
-- virtual tables, so this migration is hand-written.
CREATE VIRTUAL TABLE `problem_fts` USING fts5(
  `title`,
  `tags`,
  `body`,
  tokenize = 'porter unicode61 remove_diacritics 2'
);
