import Stripe from 'npm:stripe@18.5.0';
import { json } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/supabase.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);

function statusForStripe(status: Stripe.Subscription.Status) {
  if (status === 'active') return 'active';
  if (status === 'trialing') return 'trial';
  if (status === 'past_due' || status === 'unpaid') return 'past_due';
  if (status === 'canceled') return 'canceled';
  return 'pending';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const signature = req.headers.get('stripe-signature');
  if (!signature) return json({ error: 'Missing Stripe signature' }, 400);

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    );

    if (event.type.startsWith('customer.subscription.')) {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata.supabase_user_id;
      if (userId) {
        const admin = createAdminClient();
        const status = statusForStripe(subscription.status);
        const item = subscription.items.data[0];
        const periodEnd = item?.current_period_end
          ? new Date(item.current_period_end * 1000).toISOString()
          : null;
        await admin.from('subscriptions').upsert({
          user_id: userId,
          product_type: subscription.metadata.product_type ?? 'member_premium',
          plan: subscription.metadata.plan ?? 'monthly',
          status,
          stripe_customer_id: String(subscription.customer),
          stripe_subscription_id: subscription.id,
          current_period_end: periodEnd,
          cancel_at_period_end: subscription.cancel_at_period_end,
        }, { onConflict: 'user_id,product_type' });
        await admin.from('profiles').update({
          is_premium: status === 'active' || status === 'trial',
          subscription_status: status,
          subscription_plan: subscription.metadata.plan ?? 'monthly',
          subscription_end_date: periodEnd,
          stripe_customer_id: String(subscription.customer),
          stripe_subscription_id: subscription.id,
        }).eq('id', userId);
      }
    }

    return json({ received: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Webhook processing failed.' }, 400);
  }
});
