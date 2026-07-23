import { initializeApp, getApps, getApp } from "firebase/app";
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

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
