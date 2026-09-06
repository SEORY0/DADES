const MAX_ITEMS = 3;
const MAX_REDIRECTS = 2;
const MAX_HTML_BYTES = 512 * 1024;
const TIMEOUT_MS = 5000;
const IMAGE_META_NAMES = new Set(['og:image', 'twitter:image']);
const TOPICS = ['agents', 'security', 'ai'];

export async function findSourceCover({ issue, transport = fetch, timeoutMs = TIMEOUT_MS }) {
  const diagnostics = [];
  for (const item of issue.items.slice(0, MAX_ITEMS)) {
    const check = publicArticleUrl(item.url);
    if (!check.ok) {
      diagnostics.push({ component: 'cover', status: 'skipped', url: item.url, error: check.error });
      continue;
    }

    try {
      const article = await fetchArticleHtml(check.url, transport, timeoutMs);
      const image = extractImageUrl(article.html, article.url);
      if (!image) {
        diagnostics.push({ component: 'cover', status: 'miss', url: item.url });
        continue;
      }

      const cover = {
        image,
        alt: '',
        topic: inferTopic(item),
        sourceUrl: item.url,
        credit: item.origin || new URL(item.url).hostname,
      };
      diagnostics.push({ component: 'cover', status: 'ok', url: item.url, image });
      return { cover, diagnostics };
    } catch (error) {
      diagnostics.push({ component: 'cover', status: 'error', url: item.url, error: error.message });
    }
  }
  return { cover: null, diagnostics };
}

export function extractImageUrl(html, sourceUrl) {
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributesFor(tag[0]);
    const name = (attrs.property || attrs.name || '').toLowerCase();
    const content = attrs.content || '';
    if (!IMAGE_META_NAMES.has(name) || !content) continue;

    try {
      const image = new URL(content, sourceUrl);
      const check = publicArticleUrl(image.toString());
      if (check.ok) return check.url;
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchArticleHtml(startUrl, transport, timeoutMs) {
  let current = startUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchArticleResponse(current, transport, controller.signal);
      if (isRedirect(response.status)) {
        await cancelBody(response);
        const location = response.headers.get('location');
        if (!location) throw new Error(`redirect without location from ${current}`);
        const next = new URL(location, current);
        assertAllowedRedirect(startUrl, next);
        current = next.toString();
        continue;
      }

      if (!response.ok) {
        await cancelBody(response);
        throw new Error(`HTTP ${response.status} for ${current}`);
      }
      const contentType = response.headers.get('content-type') || '';
      if (contentType && !contentType.toLowerCase().includes('html')) {
        await cancelBody(response);
        throw new Error(`non-HTML response for ${current}`);
      }
      return { html: await readLimitedText(response), url: current };
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`too many redirects from ${startUrl}`);
}

async function fetchArticleResponse(url, transport, signal) {
  return await transport(url, {
    redirect: 'manual',
    signal,
    headers: { accept: 'text/html,application/xhtml+xml' },
  });
}

async function readLimitedText(response) {
  if (!response.body) {
    const fallback = await response.text();
    if (Buffer.byteLength(fallback) > MAX_HTML_BYTES) throw new Error('HTML response exceeded metadata size limit');
    return fallback;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_HTML_BYTES) {
        await reader.cancel();
        throw new Error('HTML response exceeded metadata size limit');
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function cancelBody(response) {
  if (response.body) await response.body.cancel().catch(() => {});
}

function attributesFor(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([^\s=]+)\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+)/g)) {
    attrs[match[1].toLowerCase()] = decodeAttribute(match[2]);
  }
  return attrs;
}

function decodeAttribute(value) {
  const unquoted = value.replace(/^["']|["']$/g, '');
  return unquoted
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function publicArticleUrl(input) {
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:') return { ok: false, error: 'article URL must use HTTPS' };
    if (url.username || url.password) return { ok: false, error: 'article URL must not include credentials' };
    if (!isPublicHostname(url.hostname)) return { ok: false, error: 'article URL host is not public' };
    return { ok: true, url: url.toString() };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function assertAllowedRedirect(startUrl, nextUrl) {
  const start = new URL(startUrl);
  const check = publicArticleUrl(nextUrl.toString());
  if (!check.ok) throw new Error(`unsafe redirect target: ${check.error}`);
  if (baseHostname(start.hostname) !== baseHostname(nextUrl.hostname)) {
    throw new Error(`redirected outside source host: ${nextUrl.toString()}`);
  }
}

function isRedirect(status) {
  return [301, 302, 303, 307, 308].includes(status);
}

function inferTopic(item) {
  const tags = (item.tags || []).join(' ').toLowerCase();
  if (tags.includes('agent')) return 'agents';
  if (tags.includes('security') || tags.includes('safety') || tags.includes('prompt-injection')) return 'security';
  return TOPICS.find((topic) => tags.includes(topic)) || 'ai';
}

function isPublicHostname(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
  if (host.includes(':')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return isPublicIpv4(host);
  return /^[a-z0-9.-]+$/.test(host);
}

function isPublicIpv4(host) {
  const octets = host.split('.').map(Number);
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = octets;
  if (a === 10 || a === 127 || a === 0 || a >= 224) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  return true;
}

function baseHostname(hostname) {
  return hostname.toLowerCase().replace(/^www\./, '');
}
