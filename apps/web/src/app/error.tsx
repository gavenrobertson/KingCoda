'use client';
import { Button } from '@kingcoda/ui';
import { EmptyState } from '@/components/EmptyState';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="px-4 pt-20">
      <EmptyState
        title="Something broke on our side"
        body="Your code and progress are safe. Try again in a moment."
        action={
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
