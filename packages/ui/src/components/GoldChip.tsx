export function CoinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="var(--kc-gold)" />
      <circle cx="12" cy="12" r="7.2" fill="none" stroke="var(--kc-gold-deep)" strokeWidth="1.4" />
      <path d="M8 14.6 7.6 9.6l2.6 2 1.8-3.2 1.8 3.2 2.6-2-.4 5z" fill="var(--kc-gold-deep)" />
    </svg>
  );
}

export function GoldAmount({ gold }: { gold: number }) {
  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-kc-md bg-gold-tint px-3 font-mono font-bold text-gold-text">
      <CoinIcon />
      {gold.toLocaleString('en-US')}
    </span>
  );
}
