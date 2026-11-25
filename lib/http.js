'use strict';

/**
 * SOSUKE Checker — tiny HTTP helpers.
 * No dependencies. Built by sosuke.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const JSON_HEADERS = {
  'user-agent': UA,
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
};

const HTML_HEADERS = {
  'user-agent': UA,
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
};

/**
 * The web edition uses Node's built-in fetch. The desktop app swaps in
 * Electron's Chromium-backed net.fetch so sites see a real browser TLS
 * fingerprint instead of blocking the lookup.
 */
let fetchImpl = (...args) => fetch(...args);

function setFetchImpl(impl) {
  fetchImpl = typeof impl === 'function' ? impl : (...args) => fetch(...args);
}

/**
 * fetch with a hard timeout and sane defaults.
 * @param {string} url
 * @param {{timeout?: number, headers?: Record<string,string>} & RequestInit} [opts]
 */
async function httpFetch(url, opts = {}) {
  const { timeout = 9000, headers = {}, ...rest } = opts;
  return fetchImpl(url, {
    redirect: 'follow',
    ...rest,
    headers: { ...JSON_HEADERS, ...headers },
    signal: AbortSignal.timeout(timeout),
  });
}

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function readText(res) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

/** First capture group of a regex, or undefined. */
function pick(text, re) {
  if (!text) return undefined;
  const m = text.match(re);
  return m && m[1] != null ? m[1] : undefined;
}

const ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  nbsp: ' ',
};

function decodeEntities(value) {
  if (!value) return value;
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9#]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] || m);
}

function cleanText(value) {
  return decodeEntities(String(value || '').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function pageTitle(html) {
  return cleanText(pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
}

function isRateLimited(res) {
  return res.status === 429 || res.status === 503;
}

function rateLimitMessage(res) {
  const retry = Number(res.headers.get('retry-after'));
  if (Number.isFinite(retry) && retry > 0) {
    return `Rate limited by the platform — retry in about ${retry}s.`;
  }
  return 'Rate limited by the platform — try again in a minute.';
}

module.exports = {
  UA,
  JSON_HEADERS,
  HTML_HEADERS,
  setFetchImpl,
  httpFetch,
  readJson,
  readText,
  pick,
  decodeEntities,
  cleanText,
  pageTitle,
  isRateLimited,
  rateLimitMessage,
};
