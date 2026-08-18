---
name: Split-host API configuration
description: Deployment contract for hosting the static frontend and API on separate origins.
---

The frontend API override must be an origin such as `https://api.example.com`; generated client paths already include `/api`.

**Why:** Preserving an environment pathname can turn a valid `/api/gateway` request into `/api/api/gateway` when the API is deployed separately.

**How to apply:** Keep the override optional for same-origin reverse-proxy deployments, normalize configured values to their origin before applying them, and document the origin-only contract in the environment example.