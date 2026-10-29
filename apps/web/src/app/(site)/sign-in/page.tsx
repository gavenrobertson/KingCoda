import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { CrownMark } from '@kingcoda/ui';
import { enabledProviders } from '@/lib/auth';
import { getViewer } from '@/lib/session';
import { SignInButtons } from './SignInButtons';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage() {
  if (await getViewer()) redirect('/problems');
  const { env } = await getCloudflareContext({ async: true });
  const providers = enabledProviders(env);

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-6 px-4 pb-16 pt-20 text-center">
      <CrownMark size={64} />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[34px] font-[750] leading-tight tracking-[-0.03em]">
          Claim your crown
        </h1>
        <p className="text-text-muted">
          Sign in to save your code, keep your streak and climb the board.
        </p>
      </div>
      {providers.length > 0 ? (
        <SignInButtons providers={providers} />
      ) : (
        <p
          role="status"
          className="rounded-kc-lg border border-border bg-surface p-4 text-left text-text-muted"
        >
          No sign-in provider is configured yet. Add{' '}
          <code className="font-mono text-text">GITHUB_CLIENT_ID</code> and{' '}
          <code className="font-mono text-text">GITHUB_CLIENT_SECRET</code> to{' '}
          <code className="font-mono text-text">.dev.vars</code> (or as Worker secrets) and reload.
        </p>
      )}
    </div>
  );
}
