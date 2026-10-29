import { monotonicFactory } from 'ulidx';

const ulid = monotonicFactory();

/** Sortable, URL-safe IDs for every primary key we generate. */
export function newId(): string {
  return ulid();
}
