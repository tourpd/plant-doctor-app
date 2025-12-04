import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDuwJB7D_cRH-eayNarLKHFX1GJRLkRY",
  authDomain: "farmer-ai-ea9eb.firebaseapp.com",
  projectId: "farmer-ai-ea9eb",
  storageBucket: "farmer-ai-ea9eb.firebasestorage.app",
  messagingSenderId: "531780163104",
  appId: "1:531780163104:web:28137ec5c1c75f3264e45"
};

const app = initializeApp(firebaseConfig);

export const storage = getStorage(app);