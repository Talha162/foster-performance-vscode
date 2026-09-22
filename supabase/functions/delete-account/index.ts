import { corsHeaders, json } from '../_shared/cors.ts';
import { createAdminClient, requireUser } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { user } = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    if (body.confirmation !== 'DELETE') return json({ error: 'Type DELETE to confirm account deletion.' }, 400);

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id, true);
    if (error) throw error;
    return json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Account deletion failed.';
    return json({ error: message }, message === 'Unauthorized' ? 401 : 400);
  }
});
