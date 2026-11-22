import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  Auth,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  Firestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import firebaseAppletConfig from '../../firebase-applet-config.json';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig.storageBucket || '',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseAppletConfig.appId || '',
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ||
    firebaseAppletConfig.measurementId ||
    '',
};

export const firestoreDatabaseId =
  (firebaseAppletConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId || '(default)';

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Initialize Firebase App
export const app: FirebaseApp | null = isFirebaseConfigured
  ? !getApps().length
    ? initializeApp(firebaseConfig)
    : getApp()
  : null;

function createFirestoreInstance(firebaseApp: FirebaseApp): Firestore {
  const targetDbId =
    firestoreDatabaseId && firestoreDatabaseId !== '(default)' ? firestoreDatabaseId : undefined;
  try {
    return initializeFirestore(
      firebaseApp,
      {
        experimentalForceLongPolling: true,
      },
      targetDbId
    );
  } catch {
    return targetDbId ? getFirestore(firebaseApp, targetDbId) : getFirestore(firebaseApp);
  }
}

// Firebase Auth & Firestore (bound to provisioned firestoreDatabaseId)
export const auth: Auth | null = app ? getAuth(app) : null;
export const db: Firestore | null = app ? createFirestoreInstance(app) : null;
export const googleProvider = new GoogleAuthProvider();

// Safe Firebase Analytics initialization (only when measurementId is explicitly configured and supported)
export let analytics: Analytics | null = null;
if (app && firebaseConfig.measurementId && typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported && app) {
        try {
          analytics = getAnalytics(app);
        } catch {
          analytics = null;
        }
      }
    })
    .catch(() => {
      analytics = null;
    });
}

// Structured Firestore Error Handling (OperationType & FirestoreErrorInfo)
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Startup Firestore Connection Validation
export async function testConnection(): Promise<void> {
  if (!db) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      // Allow long-polling transport to settle and re-probe once
      await new Promise((resolve) => setTimeout(resolve, 1200));
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (retryError) {
        if (retryError instanceof Error && retryError.message.includes('the client is offline')) {
          console.error('Please check your Firebase configuration.');
        }
      }
    }
  }
}

if (typeof window !== 'undefined' && db) {
  testConnection();
}

function requireAuth(): Auth {
  if (!auth) {
    throw new Error(
      'Firebase authentication is not configured. Verify firebase-applet-config.json or VITE_FIREBASE_* environment variables.'
    );
  }
  return auth;
}

// Auth helper functions
export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(requireAuth(), googleProvider);
  return result.user;
}

export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const result = await signInWithEmailAndPassword(requireAuth(), email, pass);
  return result.user;
}

export async function signupWithEmail(email: string, pass: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(requireAuth(), email, pass);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  if (auth) {
    await signOut(auth);
  }
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}
