const allowedTarget = (value: string) =>
  value.startsWith('foster-performance://') || value.startsWith('exp://') || value.startsWith('http://localhost:');

Deno.serve((req) => {
  const url = new URL(req.url);
  const target = url.searchParams.get('target') ?? 'foster-performance://billing-settings';
  if (!allowedTarget(target)) return new Response('Invalid redirect target', { status: 400 });
  const destination = new URL(target);
  for (const key of ['checkout', 'bookingId']) {
    const value = url.searchParams.get(key);
    if (value) destination.searchParams.set(key, value);
  }
  const escapedDestination = JSON.stringify(destination.toString()).replace(/</g, '\\u003c');
  return new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Returning to Foster Performance</title></head><body style="font-family:sans-serif;background:#0a0a0a;color:#fff;text-align:center;padding:48px"><h2>Returning to Foster Performance…</h2><p>If the app does not open, <a style="color:#60a5fa" href=${escapedDestination}>tap here</a>.</p><script>window.location.replace(${escapedDestination})</script></body></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
});
