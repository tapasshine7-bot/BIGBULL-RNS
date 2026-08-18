---
name: Partner availability checks
description: Why partner tool status belongs on the API server instead of the browser.
---

Partner-tool availability should be measured by the API server with bounded, concurrent HTTP probes and exposed as timestamped data for the frontend to poll.

**Why:** Browser-side checks are blocked or distorted by cross-origin rules, while partner sites may return useful non-2xx responses such as 403 that still prove the host is reachable.

**How to apply:** Keep the UI as a consumer of the server status response; distinguish reachable-but-restricted responses from connection failures, include latency and checked time, and use a short polling interval with a timeout.