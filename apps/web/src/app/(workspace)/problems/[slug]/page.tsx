import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { and, asc, desc, eq, gt, lt } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { draft, getDb, problem, problemContent, userProblem, type Db } from '@kingcoda/db';
import { formatCustomInput } from '@kingcoda/judge-core';
import { levelFromXp } from '@kingcoda/game';
import type { Signature } from '@kingcoda/problem-schema';
import { Workspace, type WorkspaceProblem } from '@/components/workspace/Workspace';
import { renderMarkdown } from '@/lib/markdown';
import { getViewer } from '@/lib/session';

type Params = Promise<{ slug: string }>;

async function load(db: Db, slug: string) {
  const p = await db.query.problem.findFirst({
    where: and(eq(problem.slug, slug), eq(problem.status, 'published')),
  });
  if (!p) return null;
  const content = await db.query.problemContent.findFirst({
    where: and(eq(problemContent.problemId, p.id), eq(problemContent.version, p.version)),
  });
  return content ? { p, content } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const row = await getDb(env.DB).query.problem.findFirst({
    columns: { number: true, title: true },
    where: eq(problem.slug, slug),
  });
  return { title: row ? `${row.number}. ${row.title}` : 'Problem' };
}

const LICENSE_LABEL: Record<string, string> = {
  'CC-BY-SA-4.0': 'CC BY-SA 4.0',
  'CC-BY-4.0': 'CC BY 4.0',
  MIT: 'MIT',
  'CC0-1.0': 'CC0 1.0',
};

export default async function ProblemPage({ params }: { params: Params }) {
  const { slug } = await params;
  const viewer = await getViewer();
  if (viewer && !viewer.profile) redirect('/welcome');

  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env.DB);
  const loaded = await load(db, slug);
  if (!loaded) notFound();
  const { p, content } = loaded;
  const sig = content.signature as unknown as Signature;
  const viewerId = viewer?.user.id;

  const [progress, saved, prev, next] = await Promise.all([
    viewerId
      ? db.query.userProblem.findFirst({
          where: and(eq(userProblem.userId, viewerId), eq(userProblem.problemId, p.id)),
        })
      : undefined,
    viewerId
      ? db.query.draft.findFirst({
          where: and(eq(draft.userId, viewerId), eq(draft.problemId, p.id), eq(draft.lang, 'cpp')),
        })
      : undefined,
    db.query.problem.findFirst({
      columns: { slug: true },
      where: and(eq(problem.status, 'published'), lt(problem.number, p.number)),
      orderBy: desc(problem.number),
    }),
    db.query.problem.findFirst({
      columns: { slug: true },
      where: and(eq(problem.status, 'published'), gt(problem.number, p.number)),
      orderBy: asc(problem.number),
    }),
  ]);

  const solved = progress?.status === 'solved';
  // Before the first Accepted, every counted attempt was a wrong one.
  const wrong = solved ? Infinity : (progress?.attempts ?? 0);
  const names = sig.params.map((x) => x.name);
  const examples = content.examples.map((e) => ({
    args: names.map((n) => e.input[n]),
    output: e.output,
    explanation: e.explanation,
  }));

  const data: WorkspaceProblem = {
    slug: p.slug,
    number: p.number,
    title: p.title,
    difficulty: p.difficultyDisplay,
    tags: p.tags,
    acceptanceRate: p.acceptanceRate,
    statementHtml: await renderMarkdown(content.statementMd),
    constraints: content.constraintsMd
      .split('\n')
      .map((l) => l.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean),
    paramNames: names,
    examples,
    // Locked hints stay on the server: only their unlock thresholds are sent.
    hints: content.hints.map((h) => ({
      tier: h.tier,
      unlockAfterWrong: h.unlockAfterWrong,
      text: wrong >= h.unlockAfterWrong ? h.text : null,
    })),
    wrongCount: Number.isFinite(wrong) ? wrong : null,
    solved,
    starterCode: content.starterCode.cpp ?? '',
    initialCode: saved?.code ?? content.starterCode.cpp ?? '',
    defaultCustomInput: formatCustomInput(examples.map((e) => e.args)),
    license: LICENSE_LABEL[p.license] ?? p.license,
    source: p.source,
    prevSlug: prev?.slug ?? null,
    nextSlug: next?.slug ?? null,
  };

  const profile = viewer?.profile ?? null;
  const level = profile ? levelFromXp(profile.xp) : null;
  return (
    <Workspace
      problem={data}
      viewer={
        profile && level
          ? {
              handle: profile.handle,
              streak: profile.streakCurrent,
              xp: profile.xp,
              level: level.level,
              intoLevel: level.intoLevel,
              levelSpan: level.levelSpan,
              nextAt: level.nextAt,
            }
          : null
      }
    />
  );
}
