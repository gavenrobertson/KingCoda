import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { suggestHandle } from '@/lib/handle';
import { getViewer } from '@/lib/session';
import { WelcomeForm } from './WelcomeForm';

export const metadata: Metadata = { title: 'Welcome' };

export default async function WelcomePage() {
  const viewer = await getViewer();
  if (!viewer) redirect('/sign-in');
  if (viewer.profile) redirect('/problems');

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-16 pt-16">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[34px] font-[750] leading-tight tracking-[-0.03em]">
          Pick your handle
        </h1>
        <p className="text-text-muted">
          This is how you appear on leaderboards and your profile. You can change it later.
        </p>
      </div>
      <WelcomeForm suggested={suggestHandle(viewer.user.name || viewer.user.email)} />
    </div>
  );
}
