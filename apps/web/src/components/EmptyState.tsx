import { CrownMark } from '@kingcoda/ui';

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-kc-xl border border-dashed border-border-strong bg-surface px-8 py-12 text-center">
      <CrownMark size={48} />
      <h2 className="font-display text-2xl font-[750] tracking-[-0.02em]">{title}</h2>
      <p className="text-text-muted">{body}</p>
      {action}
    </section>
  );
}
