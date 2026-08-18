# VIP Hub Main — Handoff

## Completed

- Preserved the existing RVRSED BIGBULL terminal intro, dashboard visual language, assets, animations, partner launch links, and activity surface.
- Removed the fake Profile navigation item and its unused page, route, deployment redirect, and API endpoint.
- Kept the public player access data required by the dashboard; this is not an authentication or login flow.
- Confirmed there is no login page, username/password flow, or `/api/auth/login` implementation.
- Added `GET /api/live-status`. The API server checks every registered partner URL with a five-second timeout and returns `online`, `warning`, or `offline`, plus latency and the HTTP result.
- The dashboard polls live status every 15 seconds and refreshes again when the browser window regains focus.
- Kept same-origin `/api/...` requests as the default. A separately hosted API can be selected with `VITE_API_BASE_URL` using an HTTPS or HTTP origin/path.
- Removed the old Profile route from Vercel rewrites and the static redirect list.

## Verification

- Full workspace TypeScript check passes.
- API server typecheck and production bundle pass.
- Frontend production build passes. Vite reports only the existing non-fatal tooltip sourcemap-location warning.
- Health, gateway, and live-status API requests return successful responses through the shared `/api` path.
- The dashboard preview loads without browser console errors from the app code.
- The direct `/profile` URL now renders the not-found state rather than a profile screen.

## Remaining before GitHub push

- GitHub repository URL and authorization have not been provided, so no push was attempted.
- If the API is deployed separately from the frontend, set `VITE_API_BASE_URL` in the hosting provider’s build environment. If frontend and API share a reverse-proxied origin, leave it empty.