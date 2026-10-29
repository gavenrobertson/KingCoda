import 'server-only';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getDb, schema } from '@kingcoda/db';

type Env = CloudflareEnv;

function socialProviders(env: Env) {
  const providers: Parameters<typeof betterAuth>[0]['socialProviders'] = {};
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    providers.github = { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET };
  }
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
  }
  return providers;
}

/** Which OAuth providers are configured, so the sign-in page only offers working buttons. */
export function enabledProviders(env: Env): Array<'github' | 'google'> {
  return Object.keys(socialProviders(env)) as Array<'github' | 'google'>;
}

function createAuth(env: Env) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(env.DB), {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    socialProviders: socialProviders(env),
    // Test-only: lets Playwright create sessions without OAuth. Never enabled outside local dev.
    emailAndPassword: { enabled: env.APP_ENV === 'local' && env.E2E_PASSWORD_AUTH === '1' },
    user: {
      additionalFields: {
        role: { type: 'string', required: false, defaultValue: 'user', input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    advanced: {
      useSecureCookies: env.APP_ENV !== 'local',
      // Cloudflare sets this on every request; Better Auth's rate limiter keys on it.
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
  });
}

let cached: { env: Env; auth: ReturnType<typeof createAuth> } | undefined;

/** Bindings arrive per request on Workers, so the auth instance is built lazily and reused per env. */
export async function getAuth() {
  const { env } = await getCloudflareContext({ async: true });
  if (!cached || cached.env !== env) cached = { env, auth: createAuth(env) };
  return cached.auth;
}

export type Auth = ReturnType<typeof createAuth>;
