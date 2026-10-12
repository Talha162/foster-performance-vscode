# Foster Performance — environment setup

Everything needed to get this running on Replit. The database is already
provisioned and migrated; this is about connecting the app to it.

---

## 1. Required secrets

Add both to **Tools → Secrets** (or **Secrets → Edit as .env**):

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://mqhpfdofvvjkoccaqtqa.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_MoSYQIem47vqp8vm_PxDUQ_cLZrtD57
```

Nothing else is required to start the app.

Two things about these:

- They are `EXPO_PUBLIC_*`, so Expo **inlines them when it bundles**, not at
  runtime. After adding or changing them the dev server must be **restarted** —
  a page refresh will not pick them up.
- The publishable key is Supabase's anon key. It is designed to ship inside the
  client bundle and is protected by row-level security, so it is not a
  credential to guard. The service-role key is a different thing entirely and
  must never be placed here.

If either is missing, the app no longer fails silently: it renders a screen
naming the missing variable. A blank screen means something else is wrong.

---

## 2. Install and run

This is a **pnpm workspace**. The root `preinstall` script rejects npm and yarn
outright, so `npm install` will fail by design.

```bash
pnpm install
pnpm --filter @workspace/foster-performance dev
```

The `dev` script expects Replit to provide `PORT`, `REPLIT_DEV_DOMAIN` and
`REPLIT_EXPO_DEV_DOMAIN`. These are set automatically inside a Repl. It binds
Metro to localhost and publishes it through Replit's proxy via
`EXPO_PACKAGER_PROXY_URL`.

Node 24 is declared in `.replit`.

### If the QR code does not open on a phone

The QR encodes whatever `EXPO_PACKAGER_PROXY_URL` resolves to. If
`REPLIT_EXPO_DEV_DOMAIN` is empty the QR points at `localhost`, which no phone
can reach. Check that variable is populated and that the Repl's port is public.

---

## 3. Supabase — already done, do not redo

The hosted project is `mqhpfdofvvjkoccaqtqa`. **All 20 migrations are already
applied** and the content catalogue is seeded (25 workout programs, 4 nutrition
plans, 4 rehab protocols). Running `supabase db push` against it is unnecessary
and `supabase db reset` would destroy the seeded data.

Storage buckets `avatars`, `credentials` and `message-attachments` exist with
their policies.

---

## 4. Auth configuration — one command still to run

The hosted project was never given this repo's `supabase/config.toml`. Its auth
settings were still Supabase's defaults, which broke registration and password
reset in three separate ways:

| Setting | Was | Should be | What it broke |
| --- | --- | --- | --- |
| `site_url` | `http://localhost:3000` | `foster-performance://` | Confirmation links opened a dead page in Safari |
| `additional_redirect_urls` | empty | the app's schemes | Nothing could redirect back into the app |
| `email.otp_length` | 8 | 6 | Reset and verify screens are `maxLength={6}`, so the emailed code could not be typed in at all |
| `email.enable_confirmations` | on | off, for now | No SMTP is configured, so confirmations never arrive and accounts lock permanently |

All four are now declared in `supabase/config.toml`, along with recovery and
confirmation email templates that send `{{ .Token }}` instead of a link. Apply
them with:

```bash
supabase config push    # answer y to auth, n to storage
```

**This needs a Supabase account with Owner or Administrator on the organisation.**
A member-level token gets `403` on the auth endpoint. Decline the storage prompt:
it would shrink the remote upload limit from 50MiB to 25MiB, which is unrelated.

Turn `enable_confirmations` back on at the same time SMTP is configured, not
before.

To rescue an account already stuck unconfirmed: Authentication → Users → select
the user → Confirm email.

## 5. Test accounts

Three accounts exist, one per role, all pre-confirmed so they are unaffected by
the issue above:

```
qa.member.20260924@foster-performance.test    role: member
qa.coach.20260924@foster-performance.test     role: coach
qa.admin.20260924@foster-performance.test     role: owner_admin
```

**Passwords are deliberately not in this file.** They are in
`supabase/functions/qa-bootstrap/index.ts`, which is gitignored because it also
contains a bootstrap token that can mint an `owner_admin` account. Ask whoever
set the project up.

These use the reserved `.test` domain and can never receive mail, so "forgot
password" will not work on them. Reset from the Supabase dashboard instead.

> `qa-bootstrap` is deployed with `verify_jwt = false`. Anyone holding its token
> can create an administrator on the live database. Delete it once testing is
> finished: `supabase functions delete qa-bootstrap`. The three accounts survive
> that. Do not re-run the function after changing any password, as it resets
> them to the values in its source.

---

## 6. Edge Function secrets — not yet configured

These are **Supabase secrets, not Replit secrets.** Putting them in Replit does
nothing. None are currently set, so checkout returns
`{"error":"Stripe is not configured for this environment."}`.

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_MEMBER_MONTHLY_PRICE_ID=price_... \
  STRIPE_MEMBER_ANNUAL_PRICE_ID=price_... \
  STRIPE_COACH_MONTHLY_PRICE_ID=price_... \
  STRIPE_COACH_ANNUAL_PRICE_ID=price_...
```

Deployed functions: `billing`, `billing-return`, `billing-webhook`,
`delete-account`, `export-data`, `qa-bootstrap`.

---

## 7. Known issues

**A stale "API Server" workflow fails to build.** It points at
`artifacts/api-server/`, whose source was deleted when the project moved to
Supabase. Nothing in this repository references it. Delete the workflow in
Replit's UI — it is not a sign the mobile app is broken.

**Leftover directories.** `artifacts/api-server/` and `lib/*` contain only
orphaned `node_modules` from removed packages. They are gitignored and safe to
delete.

**Not yet working, each blocked on an external account:** card payments and
refunds (Stripe), transactional email (SMTP), live video sessions (no provider
chosen), push notifications (Apple/Google credentials).

---

## 8. Verifying it worked

1. App loads without the "can't reach its backend" screen → secrets are set.
2. Sign in as the QA member → auth and the database are connected.
3. Programs tab shows 25 programs → catalogue reads work.
4. Coaches tab shows one coach → coach directory works.
5. Open that coach and book → only Monday 09:00/14:00 and Wednesday 09:00 are
   offered, because that is the availability actually stored. Other days being
   absent is correct, not a bug.
6. Checkout failing with the Stripe message is expected until section 6 is done.

If step 1 shows a blank screen rather than either the app or the configuration
screen, the bundle is stale — restart the dev server rather than refreshing.
