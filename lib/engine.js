'use strict';

/**
 * SOSUKE Checker — check engine (validation, cache, normalized results).
 * Built by sosuke.
 */

const { getPlatform } = require('./platforms');

const cache = new Map();
const MAX_CACHE = 1200;

const TTL = {
  available: 90_000,
  taken: 90_000,
  invalid: 10 * 60_000,
  unknown: 20_000,
  rate_limited: 15_000,
  error: 10_000,
};

function normalizeUsername(raw) {
  if (typeof raw !== 'string') return '';
  let value = raw.trim();
  while (value.startsWith('@')) value = value.slice(1);
  return value.trim();
}

function cacheKey(platformId, username) {
  return `${platformId}:${username.toLowerCase()}`;
}

function prune() {
  if (cache.size <= MAX_CACHE) return;
  const drop = cache.size - MAX_CACHE + 100;
  let i = 0;
  for (const key of cache.keys()) {
    cache.delete(key);
    if (++i >= drop) break;
  }
}

/**
 * @param {string} platformId
 * @param {string} rawUsername
 * @param {{fresh?: boolean}} [options]
 */
async function checkUsername(platformId, rawUsername, options = {}) {
  const platform = getPlatform(platformId);
  if (!platform) {
    const err = new Error('Unknown platform');
    err.code = 'UNKNOWN_PLATFORM';
    throw err;
  }

  const username = normalizeUsername(rawUsername);
  if (!username) {
    return {
      platform: platform.id,
      name: platform.name,
      username: '',
      status: 'invalid',
      message: 'Enter a username first.',
      ms: 0,
      checkedAt: new Date().toISOString(),
    };
  }

  const key = cacheKey(platform.id, username);
  const now = Date.now();

  if (!options.fresh) {
    const hit = cache.get(key);
    if (hit && hit.expires > now) {
      return { ...hit.result, cached: true };
    }
    if (hit) cache.delete(key);
  }

  const started = Date.now();
  let result;
  try {
    result = await platform.check(username);
  } catch (error) {
    const timedOut =
      error &&
      (error.name === 'TimeoutError' ||
        error.name === 'AbortError' ||
        /timed? ?out/i.test(String(error.message || '')));
    result = {
      status: 'error',
      message: timedOut
        ? 'The platform took too long to answer. Try again.'
        : 'Lookup failed. Try again in a moment.',
    };
  }

  if (!result || typeof result !== 'object' || !result.status) {
    result = { status: 'error', message: 'The platform sent an unreadable response.' };
  }

  const normalized = {
    platform: platform.id,
    name: platform.name,
    username,
    status: result.status,
    message: result.message || '',
    url: result.url || null,
    avatar: result.avatar || null,
    extra: result.extra || null,
    source: result.source || platform.source,
    ms: Date.now() - started,
    checkedAt: new Date().toISOString(),
  };

  const ttl = TTL[normalized.status] || 20_000;
  cache.set(key, { result: normalized, expires: Date.now() + ttl });
  prune();

  return normalized;
}

function stats() {
  return { cacheSize: cache.size };
}

module.exports = { checkUsername, normalizeUsername, stats };
