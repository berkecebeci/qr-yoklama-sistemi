const express = require('express');
const { messaging, adminDb } = require('../firebaseAdmin');
const router = express.Router();

// 1. Cihaz (FCM) Token'ı Veritabanına Kaydetme
router.post('/register-token', async (req, res) => {
    const { user_id, fcm_token } = req.body;

    if (!user_id || !fcm_token) {
        return res.status(400).json({ status: "NOK", message: "Eksik parametre" });
    }

    try {
        // FCM token'ını kullanıcının dökümanına kaydet
        await adminDb.collection("Users").doc(user_id).set({
            fcm_token: fcm_token,
            fcm_updated_at: new Date().toISOString()
        }, { merge: true });

        return res.json({ status: "OK", message: "FCM token kaydedildi" });
    } catch (error) {
        console.error("FCM Token Kayıt Hatası:", error);
        return res.status(500).json({ status: "NOK", message: "Sunucu hatası" });
    }
});

// 2. Bir kullanıcıya veya tüm sınıfa bildirim gönderme (Genellikle Akademisyen/Admin kullanır)
router.post('/send', async (req, res) => {
    const { title, body, target_user_id } = req.body;

    if (!title || !body) {
        return res.status(400).json({ status: "NOK", message: "Başlık ve içerik zorunludur" });
    }

    try {
        let tokens = [];

        if (target_user_id) {
            // Belirli bir öğrenciye
            const userDoc = await adminDb.collection("Users").doc(target_user_id).get();
            if (userDoc.exists && userDoc.data().fcm_token) {
                tokens.push(userDoc.data().fcm_token);
            }
        } else {
            // Hiç target yoksa herkese (Tüm öğrencilere) at - Genelde bir 'topic' kullanmak daha iyidir ama örnek için token topluyoruz
            const usersSnap = await adminDb.collection("Users").where("role", "==", "student").get();
            usersSnap.forEach(doc => {
                if (doc.data().fcm_token) tokens.push(doc.data().fcm_token);
            });
        }

        if (tokens.length === 0) {
            return res.status(404).json({ status: "NOK", message: "Bildirim gönderilecek uygun cihaz/token bulunamadı." });
        }

        const messagePayload = {
            notification: { title, body },
            tokens: tokens
        };

        const response = await messaging.sendMulticast(messagePayload);

        return res.json({
            status: "OK",
            message: `${response.successCount} mesaja başarıyla gönderildi.`,
            failedCount: response.failureCount
        });

    } catch (error) {
        console.error("Bildirim Gönderme Hatası:", error);
        return res.status(500).json({ status: "NOK", message: "Sunucu hatası" });
    }
});

module.exports = router;
