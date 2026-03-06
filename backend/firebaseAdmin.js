const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Ensure we don't initialize multiple times if the file is imported multiple times
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const adminDb = admin.firestore();
const messaging = admin.messaging();
const adminAuth = admin.auth();

module.exports = { admin, adminDb, messaging, adminAuth };
