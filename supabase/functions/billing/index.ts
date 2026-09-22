import Stripe from 'npm:stripe@18.5.0';
import { corsHeaders, json } from '../_shared/cors.ts';
import { createAdminClient, requireUser } from '../_shared/supabase.ts';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    if (!stripe) throw new Error('Stripe is not configured for this environment.');
    const { user } = await requireUser(req);
    const admin = createAdminClient();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? '');

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('email, full_name, stripe_customer_id, stripe_subscription_id')
      .eq('id', user.id)
      .single();
    if (profileError) throw profileError;

    let customerId = profile.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        name: profile.full_name,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      const { error } = await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
      if (error) throw error;
    }

    if (action === 'create-member-checkout') {
      const plan = body.plan === 'annual' ? 'annual' : 'monthly';
      const priceId = plan === 'annual'
        ? Deno.env.get('STRIPE_MEMBER_ANNUAL_PRICE_ID')
        : Deno.env.get('STRIPE_MEMBER_MONTHLY_PRICE_ID');
      if (!priceId) throw new Error(`Stripe ${plan} member price is not configured.`);

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.confirmation_secret'],
        metadata: { supabase_user_id: user.id, product_type: 'member_premium', plan },
      });
      const invoice = subscription.latest_invoice as Stripe.Invoice;
      const confirmationSecret = invoice.confirmation_secret?.client_secret;
      if (!confirmationSecret) throw new Error('Stripe did not return a payment confirmation secret.');

      await admin.from('subscriptions').upsert({
        user_id: user.id,
        product_type: 'member_premium',
        plan,
        status: 'pending',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
      }, { onConflict: 'user_id,product_type' });

      return json({ subscriptionId: subscription.id, confirmationSecret });
    }

    if (action === 'cancel-member-subscription') {
      if (!profile.stripe_subscription_id) throw new Error('No active subscription was found.');
      const subscription = await stripe.subscriptions.update(profile.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
      await admin.from('subscriptions').update({ cancel_at_period_end: true }).eq('stripe_subscription_id', subscription.id);
      return json({ subscriptionId: subscription.id, cancelAtPeriodEnd: true });
    }

    if (action === 'get-status' || action === 'sync-subscription') {
      const { data, error } = await admin.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      return json({ subscription: data });
    }

    return json({ error: 'Unsupported billing action' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Billing request failed.';
    return json({ error: message }, message === 'Unauthorized' ? 401 : 400);
  }
});
