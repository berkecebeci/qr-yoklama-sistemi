const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { collection, doc, setDoc, query, where, getDocs, updateDoc, getDoc } = require('firebase/firestore');
const { db } = require('../db');
const router = express.Router();

router.post('/start', async (req, res) => {
    const { course_code, duration_minutes } = req.body;

    const sessionId = "SES_" + Date.now();
    const expiresAt = new Date(Date.now() + duration_minutes * 60000);
    const initialQrContent = "QR_PAYLOAD_" + uuidv4();

    try {
        await setDoc(doc(db, "Sessions", sessionId), {
            course_code,
            expires_at: expiresAt.toISOString(),
            current_qr_token: initialQrContent,
            status: "active",
            created_at: new Date().toISOString()
        });

        return res.json({
            status: "OK",
            message: "Yoklama Oturumu Başlatıldı",
            data: {
                session_id: sessionId,
                qr_content: initialQrContent,
                expires_at: expiresAt
            }
        });
    } catch (error) {
        console.error("Firestore Error: ", error);
        return res.status(500).json({ status: "NOK", message: "Veritabanı hatası" });
    }
});

router.get('/course/:courseCode', async (req, res) => {
    const courseCode = req.params.courseCode;
    try {
        const q = query(
            collection(db, "Sessions"),
            where("course_code", "==", courseCode),
            where("status", "==", "closed")
        );
        const querySnapshot = await getDocs(q);

        let pastSessions = [];
        for (const sessionDoc of querySnapshot.docs) {
            const sessionData = sessionDoc.data();

            // Get attendee count
            const attendanceQ = query(
                collection(db, "AttendanceLogs"),
                where("session_id", "==", sessionDoc.id)
            );
            const attendanceSnap = await getDocs(attendanceQ);

            pastSessions.push({
                session_id: sessionDoc.id,
                created_at: sessionData.created_at,
                attendee_count: attendanceSnap.size
            });
        }

        // Sort by newest first
        pastSessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return res.json({ status: "OK", data: pastSessions });
    } catch (error) {
        console.error("Past Sessions Fetch Error:", error);
        return res.status(500).json({ status: "NOK", message: "Hata" });
    }
});

// Dinamik QR Kod Yenileme (Kopya karşıtı sistem FR-29)
router.post('/:session_id/rotate', async (req, res) => {
    const sessionId = req.params.session_id;
    try {
        const sessionRef = doc(db, "Sessions", sessionId);
        const sessionSnap = await getDoc(sessionRef);

        if (!sessionSnap.exists() || sessionSnap.data().status !== "active") {
            return res.status(403).json({ status: "NOK", message: "Aktif oturum bulunamadı." });
        }

        const newQrToken = "QR_DYNAMIC_" + uuidv4();
        await updateDoc(sessionRef, { current_qr_token: newQrToken });

        return res.json({
            status: "OK",
            data: { new_qr_token: newQrToken }
        });
    } catch (error) {
        return res.status(500).json({ status: "NOK" });
    }
});

router.get('/:session_id/live', async (req, res) => {
    const sessionId = req.params.session_id;
    try {
        const q = query(collection(db, "AttendanceLogs"), where("session_id", "==", sessionId));
        const querySnapshot = await getDocs(q);

        let attendees = [];
        querySnapshot.forEach((doc) => {
            attendees.push(doc.data());
        });

        return res.json({
            status: "OK",
            data: { attendees }
        });
    } catch (error) {
        return res.status(500).json({ status: "NOK", message: "Hata" });
    }
});

// Oturumu Sonlandırma
router.post('/:session_id/close', async (req, res) => {
    const sessionId = req.params.session_id;
    try {
        await updateDoc(doc(db, "Sessions", sessionId), { status: "closed" });
        return res.json({ status: "OK", message: "Oturum Sonlandırıldı" });
    } catch (err) {
        return res.status(500).json({ status: "NOK" });
    }
});

module.exports = router;
