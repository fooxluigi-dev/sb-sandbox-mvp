// Quick health endpoint to verify Redis connectivity
// Access: GET /api/health
import { getKvClient } from './_redis.js';

export default async function handler(req, res) {
  const kv = await getKvClient();
  
  const result = {
    ok: false,
    redis: {
      connected: !!kv,
      envPresent: !!process.env.REDIS_URL,
      envName: process.env.REDIS_URL ? 'REDIS_URL' : 
               process.env.KV_URL ? 'KV_URL' : 
               process.env.KV_REST_API_URL ? 'KV_REST_API_URL' : 'none',
    }
  };

  if (kv) {
    try {
      await kv.set('test:health', 'ok');
      const val = await kv.get('test:health');
      await kv.del('test:health');
      result.ok = true;
      result.redis.readWrite = val === 'ok';
    } catch (e) {
      result.redis.error = e.message;
    }
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(result.ok ? 200 : 503).json(result);
}
