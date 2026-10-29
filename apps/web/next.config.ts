import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

const nextConfig: NextConfig = {
  transpilePackages: ['@kingcoda/ui', '@kingcoda/db', '@kingcoda/game'],
  typedRoutes: true,
  poweredByHeader: false,
};

export default nextConfig;

// Exposes D1/KV/R2 bindings from wrangler.jsonc to `next dev` via getCloudflareContext().
// Playwright (KC_E2E=1) uses the `e2e` wrangler environment (secrets in .dev.vars.e2e) and its own
// throwaway state. `wrangler --persist-to X` writes under X/v3, so the proxy reads that directory.
initOpenNextCloudflareForDev(
  process.env.KC_E2E === '1'
    ? { environment: 'e2e', persist: { path: '.wrangler/e2e-state/v3' } }
    : {},
);
