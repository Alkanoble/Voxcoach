import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDCsvtRXB1P6Ed75uqpueG4MsSLerWL-I4",
  authDomain: "voxcoach-e7f00.firebaseapp.com",
  projectId: "voxcoach-e7f00",
  storageBucket: "voxcoach-e7f00.firebasestorage.app",
  messagingSenderId: "918593924398",
  appId: "1:918593924398:web:7407861e1e541d986f5ebf"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
