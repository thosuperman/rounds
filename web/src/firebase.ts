// Firebase bootstrap: App Check (required by Firebase AI Logic), Auth, Firestore with
// offline persistence, Remote Config and Firebase AI Logic (Gemini Developer API backend).

import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { fetchAndActivate, getRemoteConfig, getValue } from 'firebase/remote-config';
import { getAI, GoogleAIBackend } from 'firebase/ai';

// Read each variable as `import.meta.env.X` directly. Aliasing import.meta.env to a variable makes
// Vite inline every VITE_ value into the bundle, including the local App Check debug token.

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

// App Check. On localhost a debug token is used (register it in the Firebase console);
// in production reCAPTCHA (Google Cloud Fraud Defense, score-based key) attests the web app.
// The debug branch is removed from production builds (import.meta.env.DEV is replaced by false).
if (import.meta.env.DEV) {
  (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
    import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
}
export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_SITE_KEY || 'missing-site-key'),
  isTokenAutoRefreshEnabled: true,
});

export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const ai = getAI(app, { backend: new GoogleAIBackend() });

export const remoteConfig = getRemoteConfig(app);
remoteConfig.settings.minimumFetchIntervalMillis = import.meta.env.DEV ? 60_000 : 3_600_000;
remoteConfig.defaultConfig = {
  compile_model: 'gemini-3.5-flash',
  cloud_model: 'gemini-3.5-flash-lite',
  allow_cloud_escalation: true,
  max_escalation_attempts: 3,
};

let rcReady: Promise<boolean> | null = null;
export function loadRemoteConfig() {
  rcReady ??= fetchAndActivate(remoteConfig).catch(() => false); // offline: cached or defaults
  return rcReady;
}

export const rc = {
  compileModel: () => getValue(remoteConfig, 'compile_model').asString(),
  cloudModel: () => getValue(remoteConfig, 'cloud_model').asString(),
  allowCloudEscalation: () => getValue(remoteConfig, 'allow_cloud_escalation').asBoolean(),
  maxEscalationAttempts: () => getValue(remoteConfig, 'max_escalation_attempts').asNumber(),
};
