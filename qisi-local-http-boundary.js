const PUBLIC_FILE_RE = /<(?:script|link)\b[^>]*\b(?:src|href)=["']\.\/(?!vendor\/)([^"'?#]+)(?:[?#][^"']*)?["']/gi;
const VENDOR_ASSET_RE = /^\/vendor\/(?:[a-z0-9_-]+\/)+[a-z0-9_.-]+\.(?:js|css|woff2?|ttf)$/i;

function isAllowedLocalHost(host, port) {
  const match = /^(localhost|127\.0\.0\.1):(\d{1,5})$/i.exec(String(host || ''));
  return Boolean(match && Number(match[2]) === port);
}

function isAllowedLocalOrigin(origin, port) {
  if (origin === undefined) return true;
  if (typeof origin !== 'string') return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'http:'
      && isAllowedLocalHost(parsed.host, port)
      && parsed.origin === origin;
  } catch {
    return false;
  }
}

function publicRootAssets(html) {
  const assets = new Set(['/main.html', '/app.js', '/app.css']);
  for (const match of String(html || '').matchAll(PUBLIC_FILE_RE)) {
    if (/^[a-z0-9_-]+\.(?:js|css)$/i.test(match[1])) assets.add(`/${match[1]}`);
  }
  return assets;
}

function isPublicAsset(pathname, rootAssets) {
  if (pathname === '/') return true;
  if (typeof pathname !== 'string' || /[%\\]|\/\.|\/\//.test(pathname)) return false;
  return rootAssets.has(pathname) || VENDOR_ASSET_RE.test(pathname);
}

module.exports = { isAllowedLocalHost, isAllowedLocalOrigin, publicRootAssets, isPublicAsset };
