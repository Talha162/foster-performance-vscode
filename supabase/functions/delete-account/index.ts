import Stripe from 'npm:stripe@18.5.0';
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
    const { data: subscriptions, error: subscriptionError } = await admin.from('subscriptions')
      .select('stripe_subscription_id, status').eq('user_id', user.id)
      .in('status', ['trial', 'active', 'pending', 'past_due']);
    if (subscriptionError) throw subscriptionError;
    if (subscriptions?.some((item) => item.stripe_subscription_id)) {
      const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
      if (!stripeSecret) throw new Error('Billing is not configured; cancel paid subscriptions before deleting this account.');
      const stripe = new Stripe(stripeSecret);
      for (const subscription of subscriptions) {
        if (subscription.stripe_subscription_id) {
          await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        }
      }
    }
    const { error } = await admin.auth.admin.deleteUser(user.id, true);
    if (error) throw error;
    return json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Account deletion failed.';
    return json({ error: message }, message === 'Unauthorized' ? 401 : 400);
  }
});
