import Stripe from 'npm:stripe@18.5.0';
import { corsHeaders, json } from '../_shared/cors.ts';
import { createAdminClient, requireUser } from '../_shared/supabase.ts';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;
const functionBaseUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/billing-return`;

function checkoutReturnUrl(target: string, status: 'success' | 'cancelled', bookingId?: string) {
  const params = new URLSearchParams({ target, checkout: status });
  if (bookingId) params.set('bookingId', bookingId);
  return `${functionBaseUrl}?${params.toString()}`;
}

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

    if (action === 'create-booking-checkout') {
      const coachId = String(body.coachId ?? '');
      const sessionLength = Number(body.sessionLength);
      const startsAt = new Date(String(body.startsAt ?? ''));
      if (!coachId || ![30, 60, 90].includes(sessionLength) || Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) {
        throw new Error('Invalid booking details.');
      }
      const { data: coach, error: coachError } = await admin.from('coach_profiles')
        .select('user_id, accepting_clients, session_30_price_cents, session_60_price_cents, session_90_price_cents')
        .eq('user_id', coachId).single();
      if (coachError || !coach?.accepting_clients) throw new Error('This coach is not accepting bookings.');
      const priceCents = sessionLength === 30 ? coach.session_30_price_cents
        : sessionLength === 60 ? coach.session_60_price_cents : coach.session_90_price_cents;
      if (typeof priceCents !== 'number' || priceCents < 50) throw new Error('This session is not available for purchase.');
      const endAt = new Date(startsAt.getTime() + sessionLength * 60_000);
      const { data: booking, error: bookingError } = await admin.from('bookings').insert({
        member_id: user.id,
        coach_id: coachId,
        session_length_minutes: sessionLength,
        price_cents: priceCents,
        starts_at: startsAt.toISOString(),
        ends_at: endAt.toISOString(),
        timezone: String(body.timezone ?? 'UTC'),
        member_notes: typeof body.notes === 'string' ? body.notes : null,
        status: 'pending',
        stripe_payment_status: 'unpaid',
      }).select('id').single();
      if (bookingError) throw bookingError;

      const returnUrl = typeof body.returnUrl === 'string' ? body.returnUrl : 'foster-performance://session-confirmation';
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: customerId,
        line_items: [{
          price_data: {
            currency: 'usd',
            unit_amount: priceCents,
            product_data: { name: `${sessionLength}-minute coaching session` },
          },
          quantity: 1,
        }],
        success_url: checkoutReturnUrl(returnUrl, 'success', booking.id),
        cancel_url: checkoutReturnUrl(returnUrl, 'cancelled', booking.id),
        metadata: { booking_id: booking.id, supabase_user_id: user.id },
        payment_intent_data: { metadata: { booking_id: booking.id, supabase_user_id: user.id } },
      });
      if (!session.url) throw new Error('Stripe did not return a checkout URL.');
      return json({ checkoutUrl: session.url, bookingId: booking.id });
    }

    if (action === 'create-member-checkout' || action === 'create-coach-checkout') {
      const plan = body.plan === 'annual' ? 'annual' : 'monthly';
      const productType = action === 'create-coach-checkout' ? 'coach_pro' : 'member_premium';
      const prefix = productType === 'coach_pro' ? 'STRIPE_COACH' : 'STRIPE_MEMBER';
      const priceId = Deno.env.get(`${prefix}_${plan.toUpperCase()}_PRICE_ID`);
      if (!priceId) throw new Error(`Stripe ${plan} ${productType === 'coach_pro' ? 'coach' : 'member'} price is not configured.`);
      const returnUrl = typeof body.returnUrl === 'string' ? body.returnUrl : 'foster-performance://billing-settings';

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: checkoutReturnUrl(returnUrl, 'success'),
        cancel_url: checkoutReturnUrl(returnUrl, 'cancelled'),
        allow_promotion_codes: true,
        subscription_data: {
          metadata: { supabase_user_id: user.id, product_type: productType, plan },
        },
        metadata: { supabase_user_id: user.id, product_type: productType, plan },
      });
      if (!session.url) throw new Error('Stripe did not return a checkout URL.');
      return json({ checkoutUrl: session.url });
    }

    if (action === 'cancel-member-subscription' || action === 'cancel-coach-subscription') {
      const productType = action === 'cancel-coach-subscription' ? 'coach_pro' : 'member_premium';
      const { data: storedSubscription, error: storedError } = await admin.from('subscriptions')
        .select('stripe_subscription_id').eq('user_id', user.id).eq('product_type', productType).maybeSingle();
      if (storedError) throw storedError;
      const subscriptionId = storedSubscription?.stripe_subscription_id ?? profile.stripe_subscription_id;
      if (!subscriptionId) throw new Error('No active subscription was found.');
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      await admin.from('subscriptions').update({ cancel_at_period_end: true }).eq('stripe_subscription_id', subscription.id);
      return json({ subscriptionId: subscription.id, cancelAtPeriodEnd: true });
    }

    if (action === 'get-status' || action === 'sync-subscription') {
      let query = admin.from('subscriptions').select('*').eq('user_id', user.id);
      if (body.productType === 'coach_pro') query = query.eq('product_type', 'coach_pro');
      else if (body.productType === 'member_premium') query = query.eq('product_type', 'member_premium');
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return json({ subscription: data });
    }

    return json({ error: 'Unsupported billing action' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Billing request failed.';
    return json({ error: message }, message === 'Unauthorized' ? 401 : 400);
  }
});
