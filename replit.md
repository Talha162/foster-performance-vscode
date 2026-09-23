# Foster Performance

Expo/React Native fitness, nutrition, coaching, and member-management application backed by Supabase.

## Run & Operate

- `corepack pnpm --filter @workspace/foster-performance dev` — start Expo.
- `corepack pnpm --filter @workspace/foster-performance typecheck` — validate application TypeScript.
- `npx supabase db push --linked` — apply pending database migrations.
- `npx supabase functions deploy <name>` — deploy an Edge Function.
- Client env: copy `artifacts/foster-performance/.env.example` to `.env.local` and set the Supabase URL and publishable key.
- Server-only billing secrets are configured in Supabase Edge Function secrets, never in Expo public variables.

## Stack and source of truth

- Expo Router, React Native, TypeScript.
- Supabase Auth, Postgres with RLS, Storage, Realtime, and Edge Functions.
- Stripe-hosted Checkout and signed webhooks for subscriptions and coach-session payments.
- Database schema: `supabase/migrations/`.
- Edge Functions: `supabase/functions/`.
- Application: `artifacts/foster-performance/`.

The retired Express/Drizzle/OpenAPI backend packages were removed after migration. Do not reintroduce a second database or authentication source of truth.
