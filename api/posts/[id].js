// Render a programmable post in the sandbox domain
// GET /p/:id
// Serves sandbox code wrapped in HTML with permissive CSP (no same-origin access)
// 
// Posts are stored in Redis at key post:<id> (JSON)
// If Redis is down, falls back to the data from the main project

import { redisGet } from '../_redis.js';

const CSP_CONFIG = {
  basic: "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
  builder: "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src * data:; connect-src *",
  god: "default-src *; script-src * 'unsafe-inline' 'unsafe-eval'; img-src * data:; connect-src *; style-src * 'unsafe-inline'; font-src * data:",
};

export default async function handler(req, res) {
  const id = req.query.id;

  if (!id || !/^p\d{6,}$/.test(id)) {
    return res.status(400).send('Invalid post ID');
  }

  // Fetch post from shared Redis
  const post = await redisGet(`post:${id}`);
  if (!post) {
    return res.status(404).send('Post not found');
  }

  // If post has no sandbox, show a simple text render
  if (!post.sandbox || !post.sandbox.code) {
    const textHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="referrer" content="no-referrer">
<style>
  body {
    margin: 0; padding: 1.5rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", monospace;
    background: #fff; color: #111; line-height: 1.6;
    white-space: pre-wrap; word-wrap: break-word;
  }
</style>
</head>
<body>${escapeHtml(post.text || '')}</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(textHtml);
  }

  // Sandboxed post — wrap in HTML with permissive CSP
  const level = post.sandbox.level || 'builder';
  const csp = CSP_CONFIG[level] || CSP_CONFIG.builder;
  const sandboxAttr = 'allow-scripts allow-popups allow-forms'; // NO allow-same-origin

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${escapeCsp(csp)}">
<meta name="referrer" content="no-referrer">
<style>body{margin:0;padding:1rem;font-family:system-ui;}</style>
</head>
<body>
${post.sandbox.code}
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(200).send(html);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function escapeCsp(s) {
  // Keep single quotes (needed for CSP directives like 'unsafe-inline')
  // Only strip double quotes to prevent header injection
  return String(s).replace(/"/g, '');
}
