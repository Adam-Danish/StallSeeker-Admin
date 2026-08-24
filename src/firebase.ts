import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// Extracted from the Flutter project's firebase_options.dart
const firebaseConfig = {
  apiKey: "AIzaSyBPTOZDnYDXxe9VNSzYLXPvso5nIiHTsPc",
  authDomain: "stallseeker-c2ffe.firebaseapp.com",
  projectId: "stallseeker-c2ffe",
  storageBucket: "stallseeker-c2ffe.firebasestorage.app",
  messagingSenderId: "793011933510",
  appId: "1:793011933510:web:e9cb5587fb777961911547",
  measurementId: "G-KEBYKY2P8P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
