// Each signed-in user (anonymous auth for the demo) gets an isolated workspace so judges
// can try the full supervisor + technician flow without seeing anyone else's data.

import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

let ws: string | null = null;
export function currentWorkspace() {
  return ws;
}

export type Role = 'supervisor' | 'technician';

export interface Session {
  user: User;
  workspaceId: string;
  displayName: string;
}

/** Sign in (anonymously) and make sure the workspace document exists. Works offline after first run. */
export function startSession(onReady: (s: Session) => void, onError: (e: unknown) => void) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      signInAnonymously(auth).catch(onError);
      return;
    }
    ws = user.uid;
    const ref = doc(db, 'workspaces', ws);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          owner: user.uid,
          // The demo owner holds both roles; rules check membership per role.
          roles: { [user.uid]: ['supervisor', 'technician'] },
          createdAt: serverTimestamp(),
          demo: true,
        });
      }
    } catch {
      // Offline on first load of an existing workspace: cached data still works.
    }
    onReady({ user, workspaceId: ws, displayName: `Tech ${user.uid.slice(0, 4).toUpperCase()}` });
  });
}
