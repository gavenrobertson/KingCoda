import { NextResponse } from 'next/server';
import { apiContext } from '@/lib/api';
import { parseFilters, randomProblem } from '@/lib/problems';

/** "Pick one for me": a random problem matching the list's filters, unsolved first. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const { db, viewer } = await apiContext();
  const filters = parseFilters(Object.fromEntries(url.searchParams));
  const slug = await randomProblem(db, viewer?.user.id ?? null, filters);
  return NextResponse.redirect(new URL(slug ? `/problems/${slug}` : '/problems', url), 303);
}
