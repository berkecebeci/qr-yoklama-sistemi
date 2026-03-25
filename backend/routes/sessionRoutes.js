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

    // Bugünün tarihini al (sadece tarih, saat olmadan)
    const today = new Date();
    const sessionDate = today.toISOString().split('T')[0]; // "YYYY-MM-DD"

    try {
        // Aynı gün aynı ders için kaç yoklama açıldığını bul
        const todaySessionsQ = query(
            collection(db, "Sessions"),
            where("course_code", "==", course_code),
            where("session_date", "==", sessionDate)
        );
        const todaySessionsSnap = await getDocs(todaySessionsQ);
        const sessionNumber = todaySessionsSnap.size + 1;

        await setDoc(doc(db, "Sessions", sessionId), {
            course_code,
            expires_at: expiresAt.toISOString(),
            current_qr_token: initialQrContent,
            status: "active",
            created_at: new Date().toISOString(),
            session_date: sessionDate,
            session_number: sessionNumber
        });

        return res.json({
            status: "OK",
            message: "Yoklama Oturumu Başlatıldı",
            data: {
                session_id: sessionId,
                qr_content: initialQrContent,
                expires_at: expiresAt,
                session_number: sessionNumber,
                session_date: sessionDate
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
                attendee_count: attendanceSnap.size,
                session_number: sessionData.session_number || 1,
                session_date: sessionData.session_date || (sessionData.created_at ? sessionData.created_at.split('T')[0] : '')
            });
        }

        // Sort by newest first
        pastSessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Her gün için o gündeki toplam yoklama sayısını hesapla
        const dailyCounts = {};
        pastSessions.forEach(s => {
            if (s.session_date) {
                dailyCounts[s.session_date] = (dailyCounts[s.session_date] || 0) + 1;
            }
        });

        // Her oturuma o gündeki toplam yoklama sayısını ekle
        pastSessions = pastSessions.map(s => ({
            ...s,
            daily_total: dailyCounts[s.session_date] || 1
        }));

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

// Geçmiş yoklama detayı: hangi öğrenci var, hangi yok
router.get('/:session_id/detail', async (req, res) => {
    const sessionId = req.params.session_id;
    try {
        // Oturum bilgisini al
        const sessionRef = doc(db, "Sessions", sessionId);
        const sessionSnap = await getDoc(sessionRef);

        if (!sessionSnap.exists()) {
            return res.status(404).json({ status: "NOK", message: "Oturum bulunamadı" });
        }

        // Katılan öğrencileri al
        const attQ = query(collection(db, "AttendanceLogs"), where("session_id", "==", sessionId));
        const attSnap = await getDocs(attQ);
        const attendedMap = {};
        attSnap.docs.forEach(d => {
            const data = d.data();
            attendedMap[data.student_id] = {
                student_id: data.student_id,
                student_name: data.student_name,
                timestamp: data.timestamp
            };
        });

        // Tüm öğrencileri al
        const usersSnap = await getDocs(collection(db, "Users"));
        const allStudents = usersSnap.docs
            .map(d => d.data())
            .filter(u => u.role === 'student');

        const present = [];
        const absent = [];

        allStudents.forEach(stu => {
            if (attendedMap[stu.user_id]) {
                present.push({
                    student_id: stu.user_id,
                    student_name: stu.name,
                    timestamp: attendedMap[stu.user_id].timestamp
                });
            } else {
                absent.push({
                    student_id: stu.user_id,
                    student_name: stu.name
                });
            }
        });

        return res.json({
            status: "OK",
            data: {
                present,
                absent,
                total_students: allStudents.length,
                present_count: present.length,
                absent_count: absent.length
            }
        });
    } catch (error) {
        console.error("Session Detail Error:", error);
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
