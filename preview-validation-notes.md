# BigBull RNS Preview Validation Notes

- **2026-08-22:** The frontend-only Vite preview at `/gateway` cannot complete the live dashboard request without the Worker API. Its error boundary displayed `Cannot read properties of undefined (reading 'displayName')` because the gateway response was incomplete. This is an integration-availability issue in the isolated frontend preview, not a TypeScript/build failure. The Worker and frontend validations continue to be run independently until a local Worker+D1 API preview is connected.
