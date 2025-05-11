import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAXAeR-pNe4Howzl_Ai8Kz3RXHfxSzwPrc",
  authDomain: "chatwidgetai-3981c.firebaseapp.com",
  projectId: "chatwidgetai-3981c",
  storageBucket: "chatwidgetai-3981c.firebasestorage.app",
  messagingSenderId: "329630405654",
  appId: "1:329630405654:web:2306940bcb6aad5cfc1137",
  measurementId: "G-287NYCRGP7",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth, collection, doc, setDoc, getDoc };