// Diagnostic endpoint: checks Redis connectivity and server state
// GET /api/diag — no auth, no side effects
import { getKvClient } from './_redis.js';

export default async function handler(req, res) {
  const start = Date.now();

  // Check env
  const env = {
    REDIS_URL: !!process.env.REDIS_URL,
    KV_URL: !!process.env.KV_URL,
    KV_REST_API_URL: !!process.env.KV_REST_API_URL,
    VERCEL: process.env.VERCEL || null,
    VERCEL_ENV: process.env.VERCEL_ENV || null,
    APP_ORIGIN: !!process.env.APP_ORIGIN,
  };

  // Check Redis
  const kv = await getKvClient();
  let redis = { connected: !!kv, ping: null, readWrite: null };
  if (kv) {
    try {
      const pong = await kv.ping();
      redis.ping = pong;
      await kv.set('diag:test', 'ok');
      const val = await kv.get('diag:test');
      redis.readWrite = val === 'ok';
      await kv.del('diag:test');
    } catch (e) {
      redis.error = e.message;
    }
  }

  const elapsed = Date.now() - start;

  const ok = kv !== null && redis.ping === 'PONG';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(ok ? 200 : 503).json({
    ok,
    uptime: process.uptime(),
    ms: elapsed,
    node: process.version,
    env,
    redis,
    ts: new Date().toISOString(),
  });
}
