// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, enableNetwork, } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDC-DoaxJNyiQEWBI1x96u2KVfcvRXOzYE",
  authDomain: "webgym-68603.firebaseapp.com",
  projectId: "webgym-68603",
  storageBucket: "webgym-68603.appspot.com",
  messagingSenderId: "216746040573",
  appId: "1:216746040573:web:a2e938f277e00f01617294"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Conecta aos emuladores só em dev/local
const isLocal =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

if (isLocal) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  // força voltar para online caso tenha ficado offline
  enableNetwork(db).catch(() => { });
  console.log("[Firebase] Emuladores conectados");
}