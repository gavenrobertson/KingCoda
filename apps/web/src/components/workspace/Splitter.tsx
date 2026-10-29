'use client';
import { useRef } from 'react';
import { cn } from '@kingcoda/ui';

/**
 * A draggable divider between two panes. Keyboard: arrow keys move it 2%, Home/End jump to the
 * limits. `value` is the first pane's share of the container, in percent.
 */
export function Splitter({
  orientation,
  value,
  min,
  max,
  onChange,
  label,
  className,
}: {
  orientation: 'vertical' | 'horizontal';
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const vertical = orientation === 'vertical';

  const onPointerDown = (e: React.PointerEvent) => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const rect = parent.getBoundingClientRect();
    const move = (ev: PointerEvent) => {
      const pct = vertical
        ? ((ev.clientX - rect.left) / rect.width) * 100
        : ((ev.clientY - rect.top) / rect.height) * 100;
      onChange(clamp(pct));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = { ArrowLeft: -2, ArrowUp: -2, ArrowRight: 2, ArrowDown: 2 }[e.key];
    if (step !== undefined) onChange(clamp(value + step));
    else if (e.key === 'Home') onChange(min);
    else if (e.key === 'End') onChange(max);
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={ref}
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={cn(
        'group flex flex-none touch-none items-center justify-center bg-ground hover:bg-violet-tint focus-visible:bg-violet-tint',
        vertical
          ? 'w-1.5 cursor-col-resize border-x border-border-subtle'
          : 'h-1.5 cursor-row-resize border-y border-border-subtle',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'rounded-kc-pill bg-border-strong group-hover:bg-violet-light',
          vertical ? 'h-9 w-[3px]' : 'h-[3px] w-9',
        )}
      />
    </div>
  );
}
