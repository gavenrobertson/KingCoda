'use client';
import { useState } from 'react';
import { Button } from '@kingcoda/ui';
import { authClient } from '@/lib/auth-client';

const LABELS = { github: 'Continue with GitHub', google: 'Continue with Google' } as const;

export function SignInButtons({ providers }: { providers: Array<'github' | 'google'> }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex w-full flex-col gap-3">
      {providers.map((p) => (
        <Button
          key={p}
          variant={p === 'github' ? 'primary' : 'secondary'}
          className="w-full"
          disabled={pending !== null}
          onClick={async () => {
            setPending(p);
            setError(null);
            const res = await authClient.signIn.social({ provider: p, callbackURL: '/problems' });
            if (res.error) {
              setError(res.error.message ?? 'Sign-in failed. Try again.');
              setPending(null);
            }
          }}
        >
          {pending === p ? 'Redirecting…' : LABELS[p]}
        </Button>
      ))}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
