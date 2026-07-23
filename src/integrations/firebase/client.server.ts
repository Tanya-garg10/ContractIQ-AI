import { initializeApp, getApps, getApp, cert } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// For server-side, you would need service account credentials
// For now, we'll use the same config (in production, use service account)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Validate Firebase config
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("Firebase configuration is incomplete. Please check environment variables.");
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize storage with proper error handling
let storage;
try {
  storage = getStorage(app);
  
  // Log storage bucket for debugging
  if (firebaseConfig.storageBucket) {
    console.log(`Firebase Storage initialized with bucket: ${firebaseConfig.storageBucket}`);
  } else {
    console.warn("Firebase Storage bucket not configured");
  }
} catch (error) {
  console.error("Failed to initialize Firebase Storage:", error);
  storage = null;
}

export { app, auth, db, storage };
