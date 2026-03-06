const express = require('express');
const jwt = require('jsonwebtoken');
const { doc, setDoc, getDoc } = require('firebase/firestore');
const { db } = require('../db');
const { adminAuth } = require('../firebaseAdmin');
const router = express.Router();

const JWT_SECRET = 'super-secret-qr-key-123';

router.post('/login', async (req, res) => {
    const { idToken, device_id, device_model } = req.body;
    console.log(`Login attempt for device: ${device_model || 'Unknown'} - Body keys:`, Object.keys(req.body), 'Token:', idToken ? (idToken.length > 20 ? 'Present (length: ' + idToken.length + ')' : idToken) : 'MISSING OR EMPTY!');

    if (!idToken) {
        return res.status(400).json({ status: "NOK", message: "Kimlik doğrulama belirteci (ID Token) bulunamadı." });
    }

    try {
        console.log("Verifying ID token...");
        // 1. Verify the ID Token with Firebase Admin SDK
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const email = decodedToken.email;
        const uid = decodedToken.uid;
        console.log(`Token verified! UID: ${uid}, Email: ${email}`);

        // 2. Fetch user record from Firestore using UID (which we set as user_id in seed)
        console.log(`Fetching user document from Firestore for UID: ${uid}...`);
        const userDoc = await getDoc(doc(db, "Users", uid));

        if (!userDoc.exists()) {
            console.log(`Failed: User document not found in Firestore for UID: ${uid}`);
            return res.status(404).json({ status: "NOK", message: "Kullanıcı veritabanında bulunamadı." });
        }

        console.log(`User document found. Proceeding with login.`);
        const userData = userDoc.data();
        const role = userData.role;
        const studentId = userData.user_id;

        // 3. Issue our own JWT for existing session management if needed, 
        // or just return the user profile. Let's keep JWT for now to minimize changes in other routes.
        const token = jwt.sign({ user_id: studentId, role: role }, JWT_SECRET, { expiresIn: '1d' });

        // 4. Phase 1 Security: Automatic Device Registration on Login (for students)
        if (role === 'student' && device_id) {
            try {
                const deviceRef = doc(db, "Devices", studentId);
                const deviceSnap = await getDoc(deviceRef);

                if (!deviceSnap.exists()) {
                    await setDoc(deviceRef, {
                        device_id: device_id,
                        device_model: device_model || 'Unknown',
                        registered_at: new Date().toISOString()
                    });
                }
            } catch (error) {
                console.error("Device registration error during login:", error);
            }
        }

        return res.json({
            status: "OK",
            message: "Giriş Başarılı",
            data: {
                access_token: token,
                role: role,
                user_id: studentId,
                email: email,
                name: userData.name
            }
        });

    } catch (error) {
        console.error("/// FULL BACKEND LOGIN ERROR ///");
        console.error("Code:", error.code);
        console.error("Message:", error.message);
        console.error("Stack:", error.stack);
        console.error("/// END ERROR ///");
        return res.status(401).json({ status: "NOK", message: "Kimlik doğrulama başarısız: " + error.message });
    }
});

// Cihaz Kilidi / Kaydı (Device Registration) - FR-30
router.post('/register_device', async (req, res) => {
    const { student_id, device_id, device_model } = req.body;

    try {
        // Öğrencinin cihazını "Devices" (Cihaz Kimliği) koleksiyonuna kaydet
        await setDoc(doc(db, "Devices", student_id), {
            device_id: device_id,
            device_model: device_model || 'Unknown',
            registered_at: new Date().toISOString()
        });

        return res.json({
            status: "OK",
            message: "Cihaz başarıyla hesabınıza tanımlandı. Artık sadece bu cihazdan yoklama verebilirsiniz."
        });
    } catch (e) {
        console.error("Device Register Error:", e);
        return res.status(500).json({ status: "NOK", message: "Veritabanı bağlantı hatası." });
    }
});

router.post('/reset_password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ status: "NOK", message: "E-posta gerekli" });

    // In a real app, integrate with Firebase Admin auth.generatePasswordResetLink(email)
    return res.json({
        status: "OK",
        message: "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi."
    });
});

module.exports = router;
