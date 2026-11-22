import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
import { firebaseConfig, firebaseEnabled } from './config';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let fs: Firestore | null = null;

if (firebaseEnabled) {
  app = initializeApp(firebaseConfig as Required<typeof firebaseConfig>);
  auth = getAuth(app);
  fs = initializeFirestore(app, {
    // Optional fields are often `undefined` in our records; Firestore would reject them otherwise.
    ignoreUndefinedProperties: true,
    // Keep a copy in the browser: reopening the app only downloads what changed,
    // which keeps us well inside the free plan's daily read allowance.
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
}

export const firebaseAuth = auth;
export const firestore = fs;
