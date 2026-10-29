'use client';
import { useActionState, useSyncExternalStore } from 'react';
import { Button } from '@kingcoda/ui';
import { createProfile, type WelcomeState } from './actions';

const noSubscribe = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function WelcomeForm({ suggested }: { suggested: string }) {
  const [state, action, pending] = useActionState<WelcomeState, FormData>(createProfile, {});
  // The browser's zone, with UTC on the server so hydration matches.
  const tz = useSyncExternalStore(noSubscribe, browserTimeZone, () => 'UTC');

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-text-muted">
          Handle
        </span>
        <span className="flex h-11 items-center rounded-kc-md border border-border bg-raised px-3 focus-within:border-violet-light">
          <span className="font-mono text-text-muted" aria-hidden="true">
            @
          </span>
          <input
            name="handle"
            defaultValue={suggested}
            required
            minLength={3}
            maxLength={20}
            autoComplete="username"
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? 'handle-error' : 'handle-help'}
            className="h-full flex-1 bg-transparent pl-1 font-mono text-text outline-none"
          />
        </span>
        <span id="handle-help" className="text-xs text-text-muted">
          3–20 characters: letters, numbers, - and _.
        </span>
      </label>
      <input type="hidden" name="tz" value={tz} />
      <p className="text-xs text-text-muted">
        Streaks follow your local day: <span className="font-mono text-text">{tz}</span>
      </p>
      {state.error && (
        <p id="handle-error" role="alert" className="text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? 'Saving…' : 'Start solving'}
      </Button>
    </form>
  );
}
