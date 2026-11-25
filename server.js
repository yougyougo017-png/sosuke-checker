'use strict';

/**
 * SOSUKE Checker — zero-dependency local server.
 * Built by sosuke.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { publicPlatforms } = require('./lib/platforms');
const { checkUsername, normalizeUsername } = require('./lib/engine');

const PORT = Number(process.env.PORT) || 7331;
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const VERSION = '1.1.0';
const STARTED = Date.now();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': [
    "default-src 'self'",
    "img-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "script-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; '),
};

/* ------------------------------------------------------------------ */
/* lightweight per-IP rate limit                                       */
/* ------------------------------------------------------------------ */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 240;
const buckets = new Map();

function clientIp(req) {
  return (
    (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'local'
  );
}

function allowRequest(req) {
  const now = Date.now();
  const ip = clientIp(req);
  let bucket = buckets.get(ip);
  if (!bucket || bucket.reset <= now) {
    bucket = { count: 0, reset: now + WINDOW_MS };
    buckets.set(ip, bucket);
  }
  bucket.count += 1;
  if (buckets.size > 5000) {
    for (const [key, value] of buckets) {
      if (value.reset <= now) buckets.delete(key);
    }
  }
  return {
    allowed: bucket.count <= MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - bucket.count),
    reset: Math.ceil((bucket.reset - now) / 1000),
  };
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

function sendText(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'content-type': contentType,
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req, limit = 8192) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Body too large'), { code: 'BODY_TOO_LARGE' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { code: 'BAD_JSON' }));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let relative;
  try {
    relative = decodeURIComponent(pathname);
  } catch {
    return sendText(res, 400, 'Bad request');
  }

  if (relative === '/' || relative === '') relative = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, relative));

  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== PUBLIC_DIR) {
    return sendText(res, 403, 'Forbidden');
  }

  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      return sendText(res, 404, 'Not found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      ...SECURITY_HEADERS,
      'content-type': MIME[ext] || 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    };

    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
}

/* ------------------------------------------------------------------ */
/* server                                                              */
/* ------------------------------------------------------------------ */

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return sendText(res, 400, 'Bad request');
  }

  const pathname = url.pathname;

  if (pathname === '/api/health') {
    return sendJson(res, 200, {
      ok: true,
      name: 'SOSUKE Checker',
      version: VERSION,
      by: 'sosuke',
      uptime: Math.round((Date.now() - STARTED) / 1000),
      platforms: publicPlatforms().length,
    });
  }

  if (pathname === '/api/platforms') {
    return sendJson(res, 200, {
      name: 'SOSUKE Checker',
      version: VERSION,
      by: 'sosuke',
      platforms: publicPlatforms(),
    });
  }

  if (pathname === '/api/check') {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { error: 'Use POST for /api/check.' }, { allow: 'POST' });
    }

    const limit = allowRequest(req);
    if (!limit.allowed) {
      return sendJson(
        res,
        429,
        { error: `Easy there — too many checks. Try again in ${limit.reset}s.` },
        { 'retry-after': String(limit.reset) }
      );
    }

    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      const tooLarge = error.code === 'BODY_TOO_LARGE';
      return sendJson(res, tooLarge ? 413 : 400, {
        error: tooLarge ? 'Request too large.' : 'Send valid JSON.',
      });
    }

    const platform = typeof body.platform === 'string' ? body.platform.trim().toLowerCase() : '';
    const username = normalizeUsername(body.username);
    const fresh = Boolean(body.fresh);

    if (!platform) return sendJson(res, 400, { error: 'Missing platform.' });
    if (!username) return sendJson(res, 400, { error: 'Missing username.' });
    if (username.length > 64 || !/^[A-Za-z0-9._-]+$/.test(username)) {
      return sendJson(res, 400, {
        error: 'Usernames may use letters, numbers, dots, hyphens and underscores only.',
      });
    }

    try {
      const result = await checkUsername(platform, username, { fresh });
      return sendJson(res, 200, result, {
        'x-ratelimit-remaining': String(limit.remaining),
      });
    } catch (error) {
      if (error && error.code === 'UNKNOWN_PLATFORM') {
        return sendJson(res, 404, { error: 'Unknown platform.' });
      }
      console.error('[check]', error);
      return sendJson(res, 500, { error: 'Lookup failed on the server.' });
    }
  }

  if (pathname.startsWith('/api/')) {
    return sendJson(res, 404, { error: 'Unknown API route.' });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...SECURITY_HEADERS, allow: 'GET, HEAD' });
    return res.end('Method not allowed');
  }

  return serveStatic(req, res, pathname);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use.`);
    console.error(`  Try:  PORT=7332 npm start\n`);
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`;
  console.log('');
  console.log('  SOSUKE CHECKER  v' + VERSION);
  console.log('  ---------------------------------');
  console.log(`  ${publicPlatforms().length} platforms armed`);
  console.log(`  ${url}`);
  console.log('  built by sosuke');
  console.log('');
});
