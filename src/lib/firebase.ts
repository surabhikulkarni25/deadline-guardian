import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "zesty-exchanger-cs7sz",
  appId: "1:595901612683:web:dda8d0d5cc784da35b4a8e",
  apiKey: "AIzaSyB-vCF3SWdeHsilldCb6RpqaIBopfFEfuU",
  authDomain: "zesty-exchanger-cs7sz.firebaseapp.com",
  storageBucket: "zesty-exchanger-cs7sz.firebasestorage.app",
  messagingSenderId: "595901612683",
  measurementId: ""
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-cf82be61-24e9-45d9-bb96-d385f8547042");
export const googleProvider = new GoogleAuthProvider();
