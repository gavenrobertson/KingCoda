import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../src/schema.ts';
import { newId } from '../src/ids.ts';

const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));

function freshDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  for (const file of readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    // drizzle-kit separates statements with this marker; wrangler runs the file as-is.
    for (const stmt of readFileSync(`${migrationsDir}/${file}`, 'utf8').split(
      '--> statement-breakpoint',
    )) {
      if (stmt.trim()) sqlite.exec(stmt);
    }
  }
  return drizzle(sqlite, { schema });
}

let db: ReturnType<typeof freshDb>;
beforeEach(() => {
  db = freshDb();
});

async function seedUser(id = newId()) {
  await db.insert(schema.user).values({ id, name: 'Mara Quinn', email: `${id}@example.com` });
  return id;
}

describe('schema migrations', () => {
  it('applies cleanly and fills profile defaults', async () => {
    const userId = await seedUser();
    await db.insert(schema.profile).values({ userId, handle: 'mquinn', displayName: 'Mara Quinn' });
    const [p] = await db.select().from(schema.profile).where(eq(schema.profile.userId, userId));
    expect(p).toMatchObject({
      level: 1,
      xp: 0,
      gold: 0,
      rating: 1500,
      streakCurrent: 0,
      soundOn: false,
      theme: 'dark',
      equipped: {
        theme: 'midnight',
        frame: null,
        banner: null,
        fx: null,
        flame: null,
        title: null,
      },
    });
    expect(p!.createdAt).toBeInstanceOf(Date);
  });

  it('enforces unique handles', async () => {
    const a = await seedUser();
    const b = await seedUser();
    await db.insert(schema.profile).values({ userId: a, handle: 'king', displayName: 'A' });
    await expect(
      db.insert(schema.profile).values({ userId: b, handle: 'king', displayName: 'B' }),
    ).rejects.toThrow();
  });

  it('cascades user deletion to their data', async () => {
    const userId = await seedUser();
    await db.insert(schema.profile).values({ userId, handle: 'gone', displayName: 'Gone' });
    await db.delete(schema.user).where(eq(schema.user.id, userId));
    expect(await db.select().from(schema.profile)).toHaveLength(0);
  });

  it('allows only one solve reward per user per problem (anti-farming)', async () => {
    const userId = await seedUser();
    const entry = {
      userId,
      kind: 'solve' as const,
      xp: 25,
      points: 25,
      gold: 25,
      ref: 'problem-1',
      weekKey: '2026-W44',
      monthKey: '2026-10',
    };
    await db.insert(schema.ledger).values({ id: newId(), ...entry });
    await expect(db.insert(schema.ledger).values({ id: newId(), ...entry })).rejects.toThrow();
    // Different kinds and refs are fine.
    await db.insert(schema.ledger).values({ id: newId(), ...entry, kind: 'first_try' });
    await db.insert(schema.ledger).values({ id: newId(), ...entry, ref: 'problem-2' });
  });

  it('stores problems with JSON tags', async () => {
    const id = newId();
    await db.insert(schema.problem).values({
      id,
      number: 1,
      slug: 'twin-coins',
      title: 'Twin Coins',
      difficulty: 'Easy',
      difficultyDisplay: 'Easy',
      tags: ['Hashing', 'Arrays'],
      license: 'CC-BY-SA-4.0',
    });
    const [row] = await db.select().from(schema.problem).where(eq(schema.problem.id, id));
    expect(row!.tags).toEqual(['Hashing', 'Arrays']);
    expect(row!.status).toBe('draft');
  });
});

describe('newId', () => {
  it('is sortable in creation order', () => {
    const ids = Array.from({ length: 50 }, () => newId());
    expect([...ids].sort()).toEqual(ids);
  });
});
