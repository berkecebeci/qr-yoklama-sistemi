import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDANmS3qiOr1rCEeEV3jhpUVc4YAlCWHag",
    authDomain: "qr-ile-yoklama.firebaseapp.com",
    projectId: "qr-ile-yoklama",
    storageBucket: "qr-ile-yoklama.firebasestorage.app",
    messagingSenderId: "483886734852",
    appId: "1:483886734852:web:f663454d8e47e65cdf9f51",
    measurementId: "G-69T48JESBN"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
