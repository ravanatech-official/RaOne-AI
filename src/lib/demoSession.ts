export interface DemoSessionState {
  token: string;
  uid: string;
  tenantId: string;
  displayName: string;
  email: string;
  isDemo: true;
  expiresAt: string;
}

type DemoSessionListener = (session: DemoSessionState | null) => void;

// Held strictly in JS runtime memory (never written to localStorage/sessionStorage)
let activeDemoSession: DemoSessionState | null = null;
const listeners = new Set<DemoSessionListener>();

function notify(): void {
  for (const listener of listeners) {
    try {
      listener(activeDemoSession);
    } catch {
      // ignore listener errors
    }
  }
}

export function getDemoSession(): DemoSessionState | null {
  if (!activeDemoSession) return null;
  const expMs = Date.parse(activeDemoSession.expiresAt);
  if (Number.isFinite(expMs) && expMs <= Date.now()) {
    activeDemoSession = null;
    return null;
  }
  return activeDemoSession;
}

export function getDemoAccessToken(): string | null {
  return getDemoSession()?.token || null;
}

export function setDemoSession(session: DemoSessionState): void {
  activeDemoSession = session;
  notify();
}

export function clearDemoSession(): void {
  if (!activeDemoSession) return;
  activeDemoSession = null;
  notify();
}

export function subscribeToDemoSession(listener: DemoSessionListener): () => void {
  listeners.add(listener);
  listener(getDemoSession());
  return () => {
    listeners.delete(listener);
  };
}
