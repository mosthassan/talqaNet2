import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  query, 
  limit, 
  orderBy,
  onSnapshot
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyCHRjnQAXJ7KckqYPzGocKLvYqUy5bwmOA",
  authDomain: "mikrotic-1a8ae.firebaseapp.com",
  projectId: "mikrotic-1a8ae",
  storageBucket: "mikrotic-1a8ae.firebasestorage.app",
  messagingSenderId: "11504761785",
  appId: "1:11504761785:web:91af460089a85ff7fcd468",
  measurementId: "G-6CY0P3HZ8E"
};

// Initialize Firebase safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

// Authorized Super Admins
export const SUPER_ADMIN_EMAILS = [
  'mosthassan.ye@gmail.com'
];

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return SUPER_ADMIN_EMAILS.some(adminEmail => adminEmail.toLowerCase() === clean);
}

// Google Sign-In with popup & fallback
export async function loginWithGoogle(): Promise<{ user: User; isAdmin: boolean }> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const isAdmin = isSuperAdminEmail(user.email);
    return { user, isAdmin };
  } catch (error: any) {
    // If popup blocked in mobile or iframe, attempt redirect
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
      try {
        await signInWithRedirect(auth, provider);
      } catch (redirectErr) {
        throw redirectErr;
      }
    }
    throw error;
  }
}

// Email/Password login fallback
export async function loginWithEmail(email: string, pass: string): Promise<{ user: User; isAdmin: boolean }> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
  const user = result.user;
  const isAdmin = isSuperAdminEmail(user.email);
  return { user, isAdmin };
}

// Sign out
export async function logoutFirebase(): Promise<void> {
  await signOut(auth);
}

// Check redirect result on mount
export async function checkRedirectAuthResult(): Promise<{ user: User; isAdmin: boolean } | null> {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      return {
        user: result.user,
        isAdmin: isSuperAdminEmail(result.user.email)
      };
    }
  } catch (e) {
    console.warn('Redirect auth check warning:', e);
  }
  return null;
}
