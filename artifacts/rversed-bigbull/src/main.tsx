import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { setBaseUrl } from '@workspace/api-client-react';

import './index.css';

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

if (configuredApiBaseUrl) {
  try {
    const apiUrl = new URL(configuredApiBaseUrl, window.location.origin);
    if (!['http:', 'https:'].includes(apiUrl.protocol)) {
      throw new Error('API base URL must use HTTP or HTTPS.');
    }
    setBaseUrl(apiUrl.origin + apiUrl.pathname.replace(/\/+$/, ''));
  } catch (error) {
    console.error('Invalid VITE_API_BASE_URL; using same-origin API routes.', error);
  }
}

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
