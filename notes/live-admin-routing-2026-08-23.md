# Live Admin routing observation — 2026-08-23

The public `https://rnsbigbull.site/gateway` page presents an **Admin** card whose control-panel action links to `/control`. The live `/admin` route is not defined by the currently served Pages frontend and returns its frontend 404 screen. The owner-provided screenshot depicts a separate existing Control Console visual experience that is not located by text in the checked-in source at this point.

The corrected release now routes `/control*` to the separate `bigbull-rns-control-console` static Worker. Browser verification confirmed that `https://rnsbigbull.site/control` renders the established Control Console and visibly exposes its native **Tool Manager** tab, including form fields for name, HTTPS link, optional HTTPS logo, location, description, visibility and its Edit, move up/down, and permanent Remove controls. The page uses the existing same-origin Admin API and existing locally held owner session; no Admin credential was changed or exposed.

## Mobile cache note

The root Pages site still serves a versioned service worker (`rvrsed-bigbull-v1`) which caches successful requests and can retain a previously loaded Control Console on a mobile browser. The new Control Console route itself returns the current native dashboard and carries `no-store` for its HTML.

The separate Control Console Worker was updated in deployment `9cb20a29be8b4ff8980dd53c08629fb3` so the one-time URL `https://rnsbigbull.site/control?refresh=1` additionally returns `Clear-Site-Data: "cache"`. Browser validation of that exact URL showed the current native Control Console with the **Tool Manager** tab. This refresh target clears stale browser document/cache storage without changing the root service worker, public Pages routes, Admin credential, or API route.

The Control Console was then updated again in deployment `c4ff62dc828243348f79ab40436046df` so the permanent normal URL `https://rnsbigbull.site/control` itself returns both `Cache-Control: no-store` and `Clear-Site-Data: "cache"`. Browser validation of that normal URL confirmed the visible **Tool Manager** tab with no query string required.

## Non-destructive production stability check

On 2026-08-23, the main page, Gateway, VIP Hub, Bio page, Control Console, and the public Gateway, VIP, Bio, and live-status API endpoints each returned HTTP 200. The unauthenticated Tool Manager API correctly returned HTTP 401, confirming that owner controls remained protected. The live Control Console rendered its overview and Tool Manager form plus existing tool table without browser-console output. Frontend and Worker type checks passed, along with 15 focused Tool Manager, CORS, Admin bootstrap, and owner-control regression tests. No Admin credentials, routes, or tool records were changed during this check.
