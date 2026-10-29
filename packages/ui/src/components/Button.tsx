import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../cn.ts';

type Variant = 'primary' | 'secondary' | 'gold' | 'ghost';
type Size = 'sm' | 'md';

const variants: Record<Variant, string> = {
  primary: 'bg-violet text-on-violet hover:bg-violet-hover',
  secondary: 'bg-raised text-text border border-border hover:bg-hover hover:border-border-strong',
  gold: 'bg-gold text-gold-ink font-bold hover:brightness-105',
  ghost: 'bg-transparent text-text-muted hover:text-text hover:bg-hover',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px]',
  md: 'h-10 px-[18px] text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-kc-md font-semibold',
        'transition-[background-color,border-color,transform] duration-[120ms] ease-out active:scale-[0.98]',
        'disabled:pointer-events-none disabled:opacity-50',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-light',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
}
