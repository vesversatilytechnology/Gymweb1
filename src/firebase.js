import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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