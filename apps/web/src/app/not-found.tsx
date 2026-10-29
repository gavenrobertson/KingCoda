import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';

export default function NotFound() {
  return (
    <div className="px-4 pt-20">
      <EmptyState
        title="Nothing on this throne"
        body="That page doesn't exist, or it moved."
        action={
          <Link href="/problems" className="font-semibold">
            Back to problems
          </Link>
        }
      />
    </div>
  );
}
