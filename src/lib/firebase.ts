import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Official RaOne Firebase Project Configuration (raoneai)
export const firebaseConfig = {
  apiKey: "AIzaSyAptFzhW_aiLWlxm_mDsbhJr_RptHHyd7k",
  authDomain: "raoneai.firebaseapp.com",
  projectId: "raoneai",
  storageBucket: "raoneai.firebasestorage.app",
  messagingSenderId: "348832701843",
  appId: "1:348832701843:web:7b35f496852f30cf96dc66",
  measurementId: "G-04CTJ02EJ7",
};

// Project Architecture & Services Overview (as configured by RavanaTec)
export const RAONE_PROJECT_OVERVIEW = {
  projectName: "RaOne",
  projectId: "raoneai",
  projectNumber: "348832701843",
  billingPlan: "Blaze Plan (Pay-as-you-go)",
  adminEmail: "firebase00.ravanatech@gmail.com",
  appId: "1:348832701843:web:7b35f496852f30cf96dc66",
  services: {
    auth: {
      status: "Active",
      emailSignIn: true,
      googleSignIn: true,
      authorizedDomains: [
        "localhost",
        "raoneai.firebaseapp.com",
        "raoneai.web.app"
      ],
      mfa: false,
    },
    firestore: {
      status: "Active",
      instance: "(default) FIRESTORE_NATIVE",
      location: "nam5 (US Multi-region)",
      rulesStatus: "Locked (Production Ready)",
    },
    realtimeDb: {
      status: "Active",
      instance: "raoneai-default-rtdb",
      location: "us-central1",
      url: "https://raoneai-default-rtdb.firebaseio.com",
    },
    aiLogic: {
      geminiDeveloperApi: true,
      vertexAiGeminiApi: true,
      monitoring: "Metrics, Logging, and Tracing Active",
    },
    analytics: {
      status: "Active",
      propertyId: "563366712",
      measurementId: "G-04CTJ02EJ7",
    },
  },
};

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Firebase Auth & Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Safe Analytics Export (Disabled on dev/preview URLs to prevent 403 Installations API referer restriction)
export const analytics: any = null;

// Auth helper functions
export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return result.user;
}

export async function signupWithEmail(email: string, pass: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
