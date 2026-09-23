import { corsHeaders, json } from '../_shared/cors.ts';
import { createUserClient, requireUser } from '../_shared/supabase.ts';

const exportTables = [
  'profiles', 'coach_applications', 'coach_profiles', 'user_app_state',
  'workout_enrollments', 'workout_sessions', 'progress_entries', 'health_metrics', 'health_checkins',
  'fp_score_entries', 'nutrition_profiles', 'saved_recipes', 'food_logs', 'water_logs',
  'grocery_lists', 'bookings', 'conversations', 'messages', 'subscriptions', 'streaks', 'fp_points',
  'point_transactions', 'challenge_members', 'user_achievements', 'notifications',
] as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { user } = await requireUser(req);
    const client = createUserClient(req);
    const data: Record<string, unknown> = {};
    for (const table of exportTables) {
      const query = client.from(table).select('*');
      const result = table === 'profiles'
        ? await query.eq('id', user.id)
        : table === 'bookings' || table === 'conversations'
          ? await query.or(`member_id.eq.${user.id},coach_id.eq.${user.id}`)
          : table === 'messages'
            ? await query
            : await query.eq('user_id', user.id);
      if (result.error) throw result.error;
      data[table] = result.data ?? [];
    }
    return json({ exportedAt: new Date().toISOString(), userId: user.id, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Data export failed.';
    return json({ error: message }, message === 'Unauthorized' ? 401 : 400);
  }
});
