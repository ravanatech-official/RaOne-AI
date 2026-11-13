const DEFAULT_CLOUD_RUN_BACKEND_URL = 'https://raone-ai-backend-348832701843.asia-southeast1.run.app';

const FIREBASE_HOSTING_HOSTNAMES = new Set([
  'raoneai.web.app',
  'raoneai.firebaseapp.com',
]);

export function getApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) {
    return configured;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    if (
      FIREBASE_HOSTING_HOSTNAMES.has(hostname) ||
      (hostname.startsWith('raoneai--') && hostname.endsWith('.web.app'))
    ) {
      return DEFAULT_CLOUD_RUN_BACKEND_URL;
    }
  }

  return '';
}

export function resolveApiUrl(path: string): string {
  if (!path.startsWith('/api')) {
    return path;
  }
  const baseUrl = getApiBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
}
