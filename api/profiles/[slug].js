// Render a profile in the sandbox domain
// GET /u/:slug
// Serves user code wrapped in HTML with permissive CSP (no same-origin access)

import { redisGet } from '../_redis.js';

const CSP_CONFIG = {
  basic: "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
  builder: "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src * data:; connect-src *",
  god: "default-src *; script-src * 'unsafe-inline' 'unsafe-eval'; img-src * data:; connect-src *; style-src * 'unsafe-inline'; font-src * data:",
};

export default async function handler(req, res) {
  const slug = req.query.slug;

  if (!slug || !/^[a-z0-9_-]{1,32}$/i.test(slug)) {
    return res.status(400).send('Invalid slug');
  }

  // Fetch from shared Redis
  const profile = await redisGet(`profile:${slug}`);
  if (!profile) {
    return res.status(404).send('Profile not found');
  }

  const level = profile.sandbox || 'god';
  const csp = CSP_CONFIG[level] || CSP_CONFIG.god;
  const sandboxAttr = 'allow-scripts allow-popups allow-forms'; // NO allow-same-origin

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${escapeCsp(csp)}">
<meta name="referrer" content="no-referrer">
<style>body{margin:0;}</style>
</head>
<body>
${profile.code || ''}
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // No cookies on this domain
  res.setHeader('Set-Cookie', 'sb_session=; Path=/; Max-Age=0; SameSite=Strict');
  // Extra headers to prevent any platform leak
  // Cross-origin iframe: allow framing from sandbox-mvp feed domain
  // Derive allowed frame origin from APP_ORIGIN (supports localhost dev) or fallback to production
  const frameOrigin = process.env.APP_ORIGIN || 'https://sandbox-mvp-beige.vercel.app';
  res.setHeader('Content-Security-Policy', `frame-ancestors ${frameOrigin}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(200).send(html);
}

function escapeCsp(s) {
  // Keep single quotes (needed for CSP directives like 'unsafe-inline')
  // Only strip double quotes to prevent header injection
  return String(s).replace(/"/g, '');
}
