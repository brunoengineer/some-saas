/**
 * Firebase settings come from `.env.local` (see `.env.example`). Without them
 * the app runs as the prototype: sample data in this browser, no sign-in.
 *
 * These values are not secret: they identify the project to the browser.
 * What protects the data is sign-in plus the rules in `firestore.rules`.
 */
const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
};

/** True when the Firebase settings are present: sign-in and shared data are on. */
export const firebaseEnabled = !!(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
