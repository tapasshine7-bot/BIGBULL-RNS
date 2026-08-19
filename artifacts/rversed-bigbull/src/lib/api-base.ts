// Resolves the configured API origin, mirroring the validation in main.tsx.
export function getApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (configured) {
    try {
      const apiUrl = new URL(configured, window.location.origin);
      if (['http:', 'https:'].includes(apiUrl.protocol)) return apiUrl.origin;
    } catch {
      // fall through to same-origin
    }
  }
  return window.location.origin;
}
