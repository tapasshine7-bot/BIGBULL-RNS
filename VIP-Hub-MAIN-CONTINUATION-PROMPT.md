# VIP Hub MAIN — continuation prompt

Continue the repair of the VIP Hub MAIN project from the current files. Treat this as the MAIN production project, not a backup. Preserve the existing terminal/intro screen, dashboard layout, animations, styling, assets, and working navigation.

## Completed in the current pass

- Removed the login and signup UI and the username/password requirement.
- The intro terminal now routes directly to `/gateway` after the boot sequence.
- Removed the `/api/auth/*` routes and generated auth client hooks.
- Removed session, password-hashing, cookie, and user-authentication code.
- Made `/api/gateway`, `/api/vip`, `/api/bio`, `/api/profile`, and `/api/activity` public.
- Kept the existing dashboard and page routes: `/gateway`, `/vip`, `/bio`, `/profile`, and `/activity`.
- Updated the OpenAPI contract and regenerated the React client and Zod schemas.
- Removed plain-HTTP partner URLs; partner links now use HTTPS.
- Kept frontend API requests on relative `/api/...` paths for proxy and deployment compatibility.
- Refreshed workspace dependencies and confirmed the full typecheck passes.
- Confirmed the API bundle and web production build pass when the artifact environment values are present.
- Removed the main web app's Replit-only Vite runtime tooling and made Vite builds work with or without Replit environment variables.
- Added optional `VITE_API_BASE_URL` support for a separately hosted API, while retaining same-origin `/api/...` as the default.
- Added SPA fallback rules for the client routes for Vercel, Cloudflare Pages, and similar static hosts.
- Confirmed the live API through the shared proxy:
  - `GET /api/healthz` returns 200.
  - `GET /api/gateway` returns the public player, 8 tools, and 8 online tools.
  - `GET /api/vip` returns the VIP Hub payload.
  - `GET /api/bio` returns the Bio Tool payload.
  - `GET /api/profile` returns the public player profile.
  - `GET /api/activity` returns the activity ledger.
- Confirmed CORS preflight and cross-origin GET behavior.
- Confirmed the dashboard preview loads without browser console errors.

## Files to know

- `artifacts/rversed-bigbull/src/pages/startup-page.tsx` — terminal/intro sequence
- `artifacts/rversed-bigbull/src/App.tsx` — frontend routing
- `artifacts/rversed-bigbull/src/components/app-shell.tsx` — shared shell/navigation
- `artifacts/rversed-bigbull/src/index.css` — visual system and dashboard styling
- `artifacts/api-server/src/routes/portal.ts` — public API routes
- `artifacts/api-server/src/lib/portal.ts` — partner tool registry and public activity data
- `lib/api-spec/openapi.yaml` — API source of truth
- `lib/api-client-react/src/generated/` — generated frontend API client
- `lib/api-zod/src/generated/` — generated API validation schemas

## Remaining work

1. Do not restore authentication, name entry, or a login page.
2. Run:
   - `pnpm run typecheck`
   - `pnpm run build`
3. Restart the managed API and web workflows and inspect logs.
4. Check the intro screen and direct dashboard route in a browser at desktop and mobile widths.
5. Check the `/vip`, `/bio`, `/profile`, and `/activity` routes and verify their API calls.
6. Before any GitHub push, ask the user for the exact repository URL and verify its owner/name. Never place an access token in source, `.env`, ZIP files, logs, or commit history. Use secure authentication only.
7. Only after the user confirms the repository, push this MAIN project to that repository and verify the remote.
8. Recreate the final archive as `VIP-Hub-MAIN.zip` after any final changes. Exclude `node_modules`, `.cache`, `.git`, and temporary build metadata, but include source, assets, configuration, API contracts, deployment fallback files, and required build output.

Do not mix this project with any old backup or unrelated repository.