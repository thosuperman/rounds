// Loaded on demand from the Privacy Policy page. Reads the anonymous user ID that Firebase Auth
// already stored in this browser. It never signs in, so no account is created.
import { auth } from '../firebase';

export async function storedAnonymousId(): Promise<string | null> {
  await auth.authStateReady();
  return auth.currentUser?.uid ?? null;
}
