import { auth } from '../lib/firebase.ts';
import { getApiBaseUrl } from './api.ts';

let installed = false;

/**
 * Installs a global fetch wrapper for `/api/*` requests that:
 * 1. Rewrites relative `/api/*` paths to `VITE_API_BASE_URL` when deployed separately.
 * 2. Attaches the active Firebase ID token (`Authorization: Bearer <idToken>`)
 *    whenever the user is authenticated and no explicit Authorization header was passed.
 */
export function installAuthenticatedApiFetch(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  const apiBaseUrl = getApiBaseUrl();

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let targetInput: RequestInfo | URL = input;
    let isApiRequest = false;

    if (typeof input === 'string') {
      if (input.startsWith('/api')) {
        isApiRequest = true;
        if (apiBaseUrl) {
          targetInput = `${apiBaseUrl}${input}`;
        }
      } else if (apiBaseUrl && input.startsWith(apiBaseUrl) && input.slice(apiBaseUrl.length).startsWith('/api')) {
        isApiRequest = true;
      }
    } else if (input instanceof Request) {
      try {
        const parsed = new URL(input.url, window.location.origin);
        if (
          parsed.pathname.startsWith('/api') &&
          (parsed.origin === window.location.origin || (apiBaseUrl && input.url.startsWith(apiBaseUrl)))
        ) {
          isApiRequest = true;
          if (apiBaseUrl && parsed.origin === window.location.origin) {
            targetInput = new Request(`${apiBaseUrl}${parsed.pathname}${parsed.search}`, input);
          }
        }
      } catch {
        // ignore URL parse error
      }
    } else if (input instanceof URL) {
      if (
        input.pathname.startsWith('/api') &&
        (input.origin === window.location.origin || (apiBaseUrl && input.origin === new URL(apiBaseUrl).origin))
      ) {
        isApiRequest = true;
        if (apiBaseUrl && input.origin === window.location.origin) {
          targetInput = `${apiBaseUrl}${input.pathname}${input.search}`;
        }
      }
    }

    if (!isApiRequest) {
      return originalFetch(targetInput, init);
    }

    const headers = new Headers(
      init?.headers ?? (targetInput instanceof Request ? targetInput.headers : undefined)
    );

    if (!headers.has('Authorization') && auth?.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken();
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      } catch {
        // Proceed without token if SDK refresh transiently fails
      }
    }

    const nextInit: RequestInit = {
      ...init,
      headers,
    };

    return originalFetch(targetInput, nextInit);
  };
}
