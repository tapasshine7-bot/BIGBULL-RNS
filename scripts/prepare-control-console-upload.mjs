import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const accountId = 'fa1ff40d263749a0aa47fe056ecc6769';
const workerName = 'bigbull-rns-control-console';
const directory = '/home/ubuntu/BIGBULL-RNS/artifacts/rversed-bigbull/dist/public';

const assetsToPublish = [
  ['index.html', '/control/index.html', 'text/html; charset=utf-8'],
  ['assets/index-doYGMZN2.js', '/control/assets/index-doYGMZN2.js', 'application/javascript; charset=utf-8'],
  ['assets/index-BmeKaw0U.css', '/control/assets/index-BmeKaw0U.css', 'text/css; charset=utf-8'],
  ['rversal-logo.png', '/control/rversal-logo.png', 'image/png'],
];

const assets = {};
for (const [source, destination, type] of assetsToPublish) {
  let content = readFileSync(join(directory, source));
  if (source === 'index.html') {
    content = Buffer.from(
      content
        .toString('utf8')
        .replace(/\s*<link rel="icon"[^>]*>/g, '')
        .replace(/\s*<link rel="manifest"[^>]*>/g, '')
        .replace(/\s*<link rel="apple-touch-icon"[^>]*>/g, '')
        .replace(/\s*<link rel="preconnect"[^>]*>/g, '')
        .replace(/\s*<link href="https:\/\/fonts\.googleapis\.com[^>]*>/g, '')
        .replaceAll('src="/assets/', 'src="/control/assets/')
        .replaceAll('href="/assets/', 'href="/control/assets/')
        .replace(/\s*<script>\s*if \("serviceWorker"[\s\S]*?<\/script>/g, ''),
      'utf8',
    );
  }
  assets[destination] = { data: content.toString('base64'), type };
}

const workerCode = `const ASSETS = ${JSON.stringify(assets)};
function decode(base64) {
  const text = atob(base64);
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) bytes[index] = text.charCodeAt(index);
  return bytes;
}
function securityHeaders(type, isDocument, clearBrowserCache) {
  const headers = new Headers({
    'content-type': type,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'same-origin',
    'x-robots-tag': 'noindex, nofollow',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'cache-control': isDocument ? 'no-store' : 'public, max-age=31536000, immutable',
  });
  if (isDocument) headers.set('content-security-policy', "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'; img-src 'self' https: data:; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'");
  if (clearBrowserCache) headers.set('clear-site-data', '"cache"');
  return headers;
}
export default {
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    const url = new URL(request.url);
    let key = url.pathname;
    if (key === '/control' || key === '/control/' || (key.startsWith('/control/') && !ASSETS[key])) key = '/control/index.html';
    const asset = ASSETS[key];
    if (!asset) return new Response('Not found', { status: 404, headers: securityHeaders('text/plain; charset=utf-8', false, false) });
    const isDocument = key.endsWith('.html');
    const clearBrowserCache = isDocument;
    return new Response(request.method === 'HEAD' ? null : decode(asset.data), { headers: securityHeaders(asset.type, isDocument, clearBrowserCache) });
  },
};`;

const encodedCode = Buffer.from(workerCode, 'utf8').toString('base64');
const request = {
  account_id: accountId,
  code: `async () => {
    const code = atob(${JSON.stringify(encodedCode)});
    const metadata = { main_module: 'index.js', compatibility_date: '2026-08-18', bindings: [], annotations: { 'workers/message': 'Serve the existing Control Console with native Tool Manager at /control.' } };
    const boundary = '----BigBullControlConsole' + Date.now();
    const body = [
      '--' + boundary,
      'Content-Disposition: form-data; name="metadata"',
      'Content-Type: application/json',
      '',
      JSON.stringify(metadata),
      '--' + boundary,
      'Content-Disposition: form-data; name="index.js"; filename="index.js"',
      'Content-Type: application/javascript+module',
      '',
      code,
      '--' + boundary + '--',
    ].join('\\r\\n');
    return cloudflare.request({ method: 'PUT', path: '/accounts/' + accountId + '/workers/scripts/' + ${JSON.stringify(workerName)}, body, contentType: 'multipart/form-data; boundary=' + boundary, rawBody: true });
  }`,
};

writeFileSync('/tmp/bigbull-control-console-upload.json', JSON.stringify(request));
console.log(`Prepared ${Object.keys(assets).length} Control Console assets (${createHash('sha256').update(workerCode).digest('hex').slice(0, 12)}).`);
