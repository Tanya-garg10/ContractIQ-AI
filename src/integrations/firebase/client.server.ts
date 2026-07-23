import { initializeApp, getApps, getApp, cert } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDiiFNt97EPQBqqdbf1yAzwck4nf8SA9P4",
  authDomain: "contractiq-a1417.firebaseapp.com",
  projectId: "contractiq-a1417",
  storageBucket: "contractiq-a1417.firebasestorage.app",
  messagingSenderId: "170662491700",
  appId: "1:170662491700:web:ee9ddd8d1821ed526b3c61",
  measurementId: "G-WM70GEDVQ6"
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
