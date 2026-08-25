import Stripe from 'stripe';
import { StripeSync } from 'stripe-replit-sync';

/**
 * Fetches Stripe credentials from the Replit connection API.
 * Not cached -- tokens can rotate, so fetch fresh each time.
 */
async function getStripeCredentials(): Promise<{ secretKey: string; webhookSecret?: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      'Missing Replit environment variables. ' +
      'Ensure the Stripe integration is connected via the Integrations tab.'
    );
  }

  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (!resp.ok) {
    throw new Error(`Failed to fetch Stripe credentials: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json() as {
    items?: Array<{ settings?: { secret_key?: string; webhook_secret?: string } }>;
  };
  const settings = data.items?.[0]?.settings;

  if (!settings?.secret_key) {
    throw new Error(
      'Stripe integration not connected or missing secret key. ' +
      'Connect Stripe via the Integrations tab first.'
    );
  }

  return {
    secretKey: settings.secret_key,
    webhookSecret: settings.webhook_secret,
  };
}

/**
 * Returns a fresh authenticated Stripe client.
 * Not cached -- fetches credentials on every call so rotated keys are picked up.
 */
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

/**
 * Returns whether the configured Stripe account is in test mode.
 * Derived from the secret key prefix — no extra API call needed.
 */
export async function getStripeMode(): Promise<"test" | "live"> {
  const { secretKey } = await getStripeCredentials();
  return secretKey.startsWith("sk_live_") ? "live" : "test";
}

/**
 * Module-level cached mode, set at startup via resolveAndCacheStripeMode().
 * Defaults to "test" — updated to "live" only when live credentials are detected.
 * Safe to read synchronously at middleware time (before async credential fetch).
 */
let _cachedStripeMode: "test" | "live" = "test";

/** Synchronously returns the stripe mode resolved at startup. */
export function getCachedStripeMode(): "test" | "live" {
  return _cachedStripeMode;
}

/**
 * Resolves and caches the Stripe account mode at startup.
 * If Stripe is not connected (no credentials), mode stays "test".
 * If live credentials are found, mode is set to "live".
 */
export async function resolveAndCacheStripeMode(): Promise<void> {
  try {
    _cachedStripeMode = await getStripeMode();
  } catch {
    // Stripe not connected — no live credentials present, keep "test" default.
  }
}

/**
 * Returns a fresh StripeSync instance for webhook processing and data sync.
 * Not cached -- fetches credentials on every call so rotated keys are picked up.
 */
export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const { secretKey, webhookSecret } = await getStripeCredentials();
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret ?? '',
  });
}
