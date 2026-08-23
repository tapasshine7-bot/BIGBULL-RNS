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

## Reference

[1]: https://developers.cloudflare.com/workers/configuration/routing/workers-dev/ "Cloudflare Workers Dev documentation"
