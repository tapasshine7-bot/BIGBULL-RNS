# VIP Hub

RVRSED BIGBULL is a public player gateway for launching free partner tools, checking live tool status, and viewing the shared activity ledger.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/rversed-bigbull run dev` — run the VIP Hub web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + production-build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/rversed-bigbull/src/pages/startup-page.tsx` — terminal/intro sequence
- `artifacts/rversed-bigbull/src/App.tsx` — client routes and shared providers
- `artifacts/rversed-bigbull/src/index.css` — visual system, animations, and responsive dashboard styling
- `artifacts/api-server/src/routes/portal.ts` — public portal API endpoints
- `artifacts/api-server/src/lib/portal.ts` — partner registry and public activity data
- `lib/api-spec/openapi.yaml` — source-of-truth API contract

## Architecture decisions

- The intro sequence remains the first screen, then routes directly to `/gateway` with public access.
- Portal endpoints are public and use same-origin `/api` paths so the web app works behind the Replit proxy and on standard static hosting with a routed API.
- If the API is hosted separately, set the frontend build variable `VITE_API_BASE_URL` to the API origin; otherwise leave it unset for same-origin routing.
- SPA fallback files are included for the main client routes so direct navigation works on Cloudflare Pages, Vercel, and similar static hosts.
- Partner tools and the public activity ledger are read-only service data; the API does not require a database connection just to boot the public hub.
- The OpenAPI document is the API source of truth; generated client and validation files must be refreshed after contract changes.

## Product

Users see the animated startup terminal, enter the public gateway automatically, launch the Bio Tool or VIP Hub, inspect partner status, and browse profile/activity views without creating an account.

## User preferences

- Preserve the existing terminal, dashboard, animations, styling, assets, and working navigation unless a requested repair requires a targeted change.

## Gotchas

- Run API codegen after editing `lib/api-spec/openapi.yaml`.
- Web requests use relative `/api/...` paths; do not add hardcoded development hosts.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
