'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function UserMenu({
  name,
  handle,
  image,
}: {
  name: string;
  handle: string;
  image: string | null;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        className="flex size-[34px] items-center justify-center overflow-hidden rounded-full border-2 border-gold bg-violet-tint text-[13px] font-bold text-text"
      >
        {image ? (
          // A 34px OAuth avatar; next/image would route it through an image optimizer for no gain.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" width={34} height={34} className="size-full object-cover" />
        ) : (
          initials(name)
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-40 w-52 rounded-kc-lg border border-border bg-surface p-1.5 shadow-xl"
        >
          <p className="px-2.5 py-2 text-xs text-text-muted">
            Signed in as <span className="font-semibold text-text">@{handle}</span>
          </p>
          <button
            type="button"
            role="menuitem"
            className="w-full rounded-kc-md px-2.5 py-2 text-left text-text hover:bg-hover"
            onClick={async () => {
              await authClient.signOut();
              setOpen(false);
              router.refresh();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
