import { createClient } from 'jsr:@supabase/supabase-js@2';

export function createUserClient(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
}

export function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function requireUser(req: Request) {
  const client = createUserClient(req);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('Unauthorized');
  return { client, user: data.user };
}
