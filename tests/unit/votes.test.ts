import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { issueResults } from '../../src/lib/votes';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. CI always sets this; for local runs export ' +
      'DATABASE_URL=postgres://postgres@localhost:54329/bv_test (see task brief).',
  );
}

const client = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

// High, task-specific id (task-20 brief) so this suite never collides with
// another test file's ward fixtures in the shared test DB.
const WARD_ID = 94001;

const WARD = {
  id: WARD_ID,
  nameEn: 'Issue Votes Test Ward',
  nameKn: 'ವಿಷಯ ಮತ ಪರೀಕ್ಷಾ ವಾರ್ಡ್',
  corporation: 'south' as const,
  zone: 'Zone V',
  boundaryRef: 'issue-votes-test-ward',
};

async function resetFixtures(): Promise<void> {
  // Order matters for FKs: selections -> sets -> issues (cascades stances) -> users.
  await db.execute(
    `delete from issue_vote_selections using issue_vote_sets where issue_vote_selections.set_id = issue_vote_sets.id and issue_vote_sets.ward_id = ${WARD_ID}`,
  );
  await db.delete(schema.issueVoteSets).where(eq(schema.issueVoteSets.wardId, WARD_ID));
  await db.delete(schema.wardIssues).where(eq(schema.wardIssues.wardId, WARD_ID));
  await db.delete(schema.users).where(eq(schema.users.email, 'votes-fixture-a@example.com'));
  await db.delete(schema.users).where(eq(schema.users.email, 'votes-fixture-b@example.com'));
  await db.delete(schema.users).where(eq(schema.users.email, 'votes-fixture-c@example.com'));
}

async function makeUser(email: string): Promise<number> {
  const [user] = await db
    .insert(schema.users)
    .values({ email, homeWardId: WARD_ID })
    .onConflictDoUpdate({ target: schema.users.email, set: { homeWardId: WARD_ID } })
    .returning({ id: schema.users.id });
  return user!.id;
}

async function makeIssue(titleEn: string, position: number): Promise<number> {
  const [issue] = await db
    .insert(schema.wardIssues)
    .values({ wardId: WARD_ID, titleEn, titleKn: `${titleEn} (kn)`, position })
    .returning({ id: schema.wardIssues.id });
  return issue!.id;
}

async function makeVoteSet(userId: number, issueIds: number[], active: boolean): Promise<number> {
  const [set] = await db
    .insert(schema.issueVoteSets)
    .values({ userId, wardId: WARD_ID, active })
    .returning({ id: schema.issueVoteSets.id });
  for (const wardIssueId of issueIds) {
    await db.insert(schema.issueVoteSelections).values({ setId: set!.id, wardIssueId });
  }
  return set!.id;
}

describe('issueResults (src/lib/votes.ts) — PRD §5.5', () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: './drizzle' });
    await db.insert(schema.wards).values(WARD).onConflictDoUpdate({ target: schema.wards.id, set: WARD });
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await resetFixtures();
  });

  it('returns [] when the ward has no issues defined', async () => {
    expect(await issueResults(WARD_ID)).toEqual([]);
  });

  it('zero total selections: every share is 0, ranked by curator position', async () => {
    const issueA = await makeIssue('Roads', 0);
    const issueB = await makeIssue('Water', 1);
    const issueC = await makeIssue('Waste', 2);

    const results = await issueResults(WARD_ID);
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.sharePct === 0)).toBe(true);
    expect(results.map((r) => r.issueId)).toEqual([issueA, issueB, issueC]);
    expect(results.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('ranks by descending selection count and percentages sum to ~100 (active sets only)', async () => {
    const issueA = await makeIssue('Roads', 0); // most-selected
    const issueB = await makeIssue('Water', 1);
    const issueC = await makeIssue('Waste', 2); // zero selections

    const userA = await makeUser('votes-fixture-a@example.com');
    const userB = await makeUser('votes-fixture-b@example.com');
    const userC = await makeUser('votes-fixture-c@example.com');

    // Roads gets 3 selections (A, B, C), Water gets 1 (A), Waste gets 0.
    await makeVoteSet(userA, [issueA, issueB], true);
    await makeVoteSet(userB, [issueA], true);
    await makeVoteSet(userC, [issueA], true);

    const results = await issueResults(WARD_ID);
    expect(results).toHaveLength(3);

    const byId = new Map(results.map((r) => [r.issueId, r]));
    expect(byId.get(issueA)!.rank).toBe(1);
    expect(byId.get(issueB)!.rank).toBe(2);
    expect(byId.get(issueC)!.rank).toBe(3); // zero selections, still present, ranked last

    expect(byId.get(issueC)!.sharePct).toBe(0);
    expect(byId.get(issueA)!.titleEn).toBe('Roads');
    expect(byId.get(issueA)!.titleKn).toBe('Roads (kn)');

    const totalShare = results.reduce((sum, r) => sum + r.sharePct, 0);
    expect(totalShare).toBeGreaterThan(99);
    expect(totalShare).toBeLessThanOrEqual(100.1);
  });

  it('excludes a RETIRED (active=false) vote-set from the aggregate entirely', async () => {
    const issueA = await makeIssue('Roads', 0);
    const issueB = await makeIssue('Water', 1);

    const userA = await makeUser('votes-fixture-a@example.com');

    // Retired set voted for Water only — must not count.
    await makeVoteSet(userA, [issueB], false);
    // Active set (different user) voted for Roads only.
    const userB = await makeUser('votes-fixture-b@example.com');
    await makeVoteSet(userB, [issueA], true);

    const results = await issueResults(WARD_ID);
    const byId = new Map(results.map((r) => [r.issueId, r]));

    expect(byId.get(issueA)!.sharePct).toBe(100);
    expect(byId.get(issueB)!.sharePct).toBe(0);
    expect(byId.get(issueA)!.rank).toBe(1);
  });

  it('never exposes a raw count field on any returned result', async () => {
    const issueA = await makeIssue('Roads', 0);
    const userA = await makeUser('votes-fixture-a@example.com');
    await makeVoteSet(userA, [issueA], true);

    const results = await issueResults(WARD_ID);
    for (const r of results) {
      expect(Object.keys(r).sort()).toEqual(['issueId', 'rank', 'sharePct', 'titleEn', 'titleKn'].sort());
      expect('count' in r).toBe(false);
    }
  });

  it('deleting an issue: results are computed against the remaining issues only', async () => {
    const issueA = await makeIssue('Roads', 0);
    const issueB = await makeIssue('Water', 1);

    const userA = await makeUser('votes-fixture-a@example.com');
    await makeVoteSet(userA, [issueA, issueB], true);

    // Delete issueB's ward_issue row — its selections cascade-delete too.
    await db.delete(schema.wardIssues).where(eq(schema.wardIssues.id, issueB));

    const results = await issueResults(WARD_ID);
    expect(results.map((r) => r.issueId)).toEqual([issueA]);
    expect(results[0]!.sharePct).toBe(100);
    expect(results[0]!.rank).toBe(1);
  });
});
