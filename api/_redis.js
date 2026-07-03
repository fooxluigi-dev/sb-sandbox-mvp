// Shared Redis helper — connects to the same KV store as the main platform
// Env var: REDIS_URL (set in Vercel dashboard for both projects)

let kvClient = null;

export async function getKvClient() {
  if (kvClient) return kvClient;

  const redisUrl = process.env.REDIS_URL || process.env.KV_URL || process.env.KV_REST_API_URL;
  if (!redisUrl) return null;

  try {
    const { createClient } = await import('redis');
    const client = createClient({ url: redisUrl });
    client.on('error', () => { /* silent */ });
    await client.connect();
    kvClient = client;
    return kvClient;
  } catch (e) {
    console.error('[sb] Redis connection failed:', e.message);
    return null;
  }
}

export async function redisGet(key) {
  const kv = await getKvClient();
  if (!kv) return null;
  const raw = await kv.get(key);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}
