import type { Difficulty } from '../tokens.ts';
import { cn } from '../cn.ts';

const styles: Record<Difficulty, string> = {
  Easy: 'text-easy bg-easy-chip',
  Medium: 'text-medium bg-medium-chip',
  Hard: 'text-hard bg-hard-chip',
};

export function DifficultyChip({
  difficulty,
  className,
}: {
  difficulty: Difficulty;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex rounded-kc-pill px-2.5 py-0.5 text-[13px] font-semibold',
        styles[difficulty],
        className,
      )}
    >
      {difficulty}
    </span>
  );
}
