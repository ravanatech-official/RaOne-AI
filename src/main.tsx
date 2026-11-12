import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
if (apiBaseUrl) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api')) {
      return originalFetch(`${apiBaseUrl}${input}`, init);
    }
    if (input instanceof Request) {
      const url = new URL(input.url, window.location.origin);
      if (url.origin === window.location.origin && url.pathname.startsWith('/api')) {
        return originalFetch(new Request(`${apiBaseUrl}${url.pathname}${url.search}`, input), init);
      }
    }
    return originalFetch(input, init);
  };
}

createRoot(document.getElementById('root')!).render(<App />);
