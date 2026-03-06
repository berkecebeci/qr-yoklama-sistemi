const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');

// Sizin ilettiğiniz yapılandırma parametreleri
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
const db = getFirestore(app);

module.exports = { db };
