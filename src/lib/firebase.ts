import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getApp(): FirebaseApp | null {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'your_firebase_api_key') {
    return null;
  }
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

let _auth: Auth | null = null;
let _db: Firestore | null = null;

export function getFirebaseAuth(): Auth | null {
  if (_auth) return _auth;
  const app = getApp();
  if (!app) return null;
  _auth = getAuth(app);
  return _auth;
}

export function getFirebaseDb(): Firestore | null {
  if (_db) return _db;
  const app = getApp();
  if (!app) return null;
  _db = getFirestore(app);
  return _db;
}

export const googleProvider = new GoogleAuthProvider();

export function isFirebaseConfigured(): boolean {
  return !!(firebaseConfig.apiKey && firebaseConfig.apiKey !== 'your_firebase_api_key');
}
