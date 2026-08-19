// Same-origin API bridge for rnsbigbull.site.
// Forwards /api/** requests to the Cloudflare Worker API host, keeping
// admin login, banners, and every other API call on the same origin so
// mobile networks and security filters can never treat it as cross-origin.

const API_ORIGIN = 'https://bigbull-rns-api.tapasshine7.workers.dev';

export const onRequest: PagesFunction = async (context) => {
  const target = new URL(context.request.url);
  const upstream = new URL(`${API_ORIGIN}${target.pathname}${target.search}`);

  const headers = new Headers(context.request.headers);
  headers.set('host', upstream.host);

  const response = await fetch(upstream.toString(), {
    method: context.request.method,
    headers,
    body: context.request.body,
    redirect: 'manual',
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.set('access-control-allow-origin', '*');
  responseHeaders.set('access-control-allow-methods', 'GET, POST, OPTIONS');
  responseHeaders.set('access-control-allow-headers', 'content-type, x-admin-token, authorization');

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
};
