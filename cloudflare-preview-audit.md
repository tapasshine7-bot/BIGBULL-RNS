# Cloudflare Preview Deployment Audit

Date: 2026-08-23

## Read-only account findings

The enabled Cloudflare account contains the existing `bigbull-rns-api` Worker. It has a production route on `rnsbigbull.site/api/*` and uses the source configuration's D1 database binding `bigbull-rns-db` (`c7c415d7-ec40-42c7-aae7-9b1168030fea`). This Worker must not be overwritten during preview validation.

The frontend handoff specifies a separately built static dashboard. Cloudflare Pages is supported using build command `pnpm --filter @workspace/rversed-bigbull run build` and output `artifacts/rversed-bigbull/dist/public`; when the API is separately hosted, `VITE_API_BASE_URL` must point to a safe HTTPS API origin. Production and preview Pages deployments are distinct API deployment environments.

## Safety decision

Before any production deployment, create and validate a distinct preview target. Confirm that it uses an isolated preview Worker/API origin and does not alter `rnsbigbull.site`, its production Worker route, or the production D1 data.

## Pages deployment finding

The existing `rnsbigbull-site` Pages project has the production alias `https://rnsbigbull.site`, but the deployment audit reports an ad-hoc deployment with no configured build command, output directory, root directory, environment variables, repository clone, or build stage. Therefore, a GitHub push alone cannot update the live website. A separate Pages upload/deployment is required after the preview Worker and frontend preview are verified.

## Isolated Worker preview finding

The preview Worker `bigbull-rns-api-toolmanager-preview` was created through the account API with exactly one D1 binding: the new preview database `bigbull-rns-toolmanager-preview-db` (`0de0944e-d50e-4a8f-879f-22e6d77ffefb`) and `PREVIEW_MODE=true`. It has no production route or production D1 binding. The apparent Workers.dev test URL returned Cloudflare 404 after upload, so the account-level Workers.dev exposure must be explicitly checked or enabled before it can become the preview API origin. Cloudflare documents that enabled Workers.dev URLs are public and can be protected with Access if needed. [1]

## Pages preview deployment method

The existing Pages project is an ad-hoc static deployment with no repository build configuration. A safe preview therefore requires a direct static-asset upload with branch metadata `tool-manager-preview`, rather than an update to its `main` production deployment. Cloudflare's Pages deployment API accepts a branch and a content manifest; the supported upload client first checks asset hashes, uploads only missing files, and then creates the branch deployment. [2]

The connected account interface can retrieve the required short-lived Pages upload token, but it cannot forward arbitrary authorization headers to the Pages asset-store endpoints. The direct branch upload consequently returned authorization failure before creating any Pages deployment. The production Pages deployment and `rnsbigbull.site` were not changed. The isolated preview will instead use a separate Workers.dev static frontend hostname, with the API CORS allowlist limited to that one hostname.

## Working isolated preview

The public preview frontend is available only at `https://bigbull-rns-toolmanager-preview-site.tapasshine7.workers.dev`; it has no production custom-domain route and is marked `X-Robots-Tag: noindex, nofollow`. Its separate API is `https://bigbull-rns-api-toolmanager-preview.tapasshine7.workers.dev`, bound only to `bigbull-rns-toolmanager-preview-db`. Public Gateway bootstrap and exact-origin CORS were verified. Owner login and CRUD validation remain intentionally blocked until the owner configures new preview-only `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_RECOVERY` Worker secrets; these values must never be committed or copied from prior chat messages.

## Corrected production Control Console rollout

The production API Worker `bigbull-rns-api` remains on the existing `rnsbigbull.site/api/*` route. Its owner authentication remains backed by the already-existing production D1 credential record; it was not read, replaced, or changed.

The narrow `rnsbigbull.site/control*` route (`fd59bc26e62e4f3796695a1cfc4299f5`) now targets a separate static Worker named `bigbull-rns-control-console` (deployment `e8132dd12f3440a9a32c3b82c330f5c4`). It serves the established **Control Console** visual experience at `/control`, not a replacement credential page. The dashboard visibly includes the native **Tool Manager** tab with add, edit, visibility, placement, reordering, and permanent Remove controls. It uses the existing same-origin `/api/admin` endpoints and therefore does not add a second credential or alter the main Admin login.

Only `/control*` was switched. The public Pages frontend and routes such as `/gateway`, `/vip`, `/bio`, and the existing `/api/*` Worker route were not modified by this corrected deployment. The Control Console static route is marked noindex, embeds no credentials, and applies browser security headers.

## Reference

[1]: https://developers.cloudflare.com/workers/configuration/routing/workers-dev/ "Cloudflare Workers Dev documentation"
[2]: https://developers.cloudflare.com/workers/static-assets/direct-upload/ "Cloudflare static asset direct upload documentation"
