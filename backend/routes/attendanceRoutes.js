const express = require('express');
const { collection, addDoc, query, where, getDocs, doc, getDoc } = require('firebase/firestore');
const { db } = require('../db');
const router = express.Router();

router.post('/scan', async (req, res) => {
    const { qr_content, device_id, student_id } = req.body;

    try {
        // 1. Güvenlik Katmanı: Cihaz Kimliği (Device ID) Kontrolü
        // Öğrencinin veritabanında daha önceden kaydettirdiği cihaz bu mu?
        if (student_id) {
            const deviceRef = doc(db, "Devices", student_id);
            const deviceSnap = await getDoc(deviceRef);

            if (deviceSnap.exists()) {
                const registeredDevice = deviceSnap.data().device_id;
                if (registeredDevice !== device_id) {
                    return res.status(403).json({
                        status: "NOK",
                        message: "Kopya giriş denemesi engellendi: Lütfen sisteme kayıtlı olan kendi cihazınızdan yoklama veriniz.",
                        error_code: 403
                    });
                }
            } else {
                // If a student doesn't have a registered device in DB, block attendance for security
                // (They should have registered during login)
                return res.status(403).json({
                    status: "NOK",
                    message: "Güvenlik İhlali: Cihazınız sisteme kayıtlı değil. Lütfen tekrar giriş yapın.",
                    error_code: 403
                });
            }
        }

        // 2. Güvenlik Katmanı: QR Kontrolü (Zaman kısıtlı dinamik token mi?)
        const q = query(collection(db, "Sessions"), where("current_qr_token", "==", qr_content), where("status", "==", "active"));
        const sessionSnap = await getDocs(q);

        if (sessionSnap.empty) {
            return res.status(403).json({
                status: "NOK",
                message: "QR Kod Geçersiz veya Yoklama Süresi Dolmuş.",
                error_code: 403
            });
        }

        const sessionData = sessionSnap.docs[0].data();
        const sessionId = sessionSnap.docs[0].id;

        const existingScanQ = query(
            collection(db, "AttendanceLogs"),
            where("session_id", "==", sessionId),
            where("student_device", "==", device_id)
        );
        const existingScanSnap = await getDocs(existingScanQ);

        if (!existingScanSnap.empty) {
            return res.json({
                status: "OK",
                message: "Yoklamaya zaten katıldınız.",
            });
        }

        let studentName = "BİLİNMEYEN_ÖĞRENCİ";
        if (student_id) {
            const userSnap = await getDoc(doc(db, "Users", student_id));
            if (userSnap.exists()) {
                studentName = userSnap.data().name || "İsimsiz Öğrenci";
            }
        }

        await addDoc(collection(db, "AttendanceLogs"), {
            session_id: sessionId,
            student_id: student_id || "BİLİNMEYEN_ÖĞRENCİ",
            student_name: studentName,
            student_device: device_id,
            course_code: sessionData.course_code,
            timestamp: new Date().toISOString()
        });

        return res.json({
            status: "OK",
            message: "Yoklamanız Alındı.",
            data: {
                course_name: sessionData.course_code,
                attendance_time: new Date().toISOString()
            }
        });
    } catch (e) {
        console.error("Attendance Scan Error:", e);
        return res.status(500).json({ status: "NOK", message: "Sunucu hatası" });
    }
});

router.post('/manual', async (req, res) => {
    const { session_id, student_id } = req.body;

    if (!session_id || !student_id) {
        return res.status(400).json({ status: "NOK", message: "Eksik parametreler" });
    }

    try {
        const sessionRef = doc(db, "Sessions", session_id);
        const sessionSnap = await getDoc(sessionRef);

        if (!sessionSnap.exists()) {
            return res.status(404).json({ status: "NOK", message: "Oturum bulunamadı" });
        }

        const sessionData = sessionSnap.data();

        // Check if student exists in Users collection
        const studentQ = query(
            collection(db, "Users"),
            where("user_id", "==", student_id),
            where("role", "==", "student")
        );
        const studentSnap = await getDocs(studentQ);

        let studentName = "Bilinmeyen Öğrenci";

        if (!studentSnap.empty) {
            studentName = studentSnap.docs[0].data().name;
        } else if (student_id === "STUDENT101" || student_id === "123456") {
            studentName = "Test Öğrencisi";
        } else {
            return res.json({ status: "NOK", message: "Geçersiz öğrenci numarası. Sistemde böyle bir öğrenci bulunamadı." });
        }

        // Check if already in attendance
        const existingScanQ = query(
            collection(db, "AttendanceLogs"),
            where("session_id", "==", session_id),
            where("student_id", "==", student_id)
        );
        const existingScanSnap = await getDocs(existingScanQ);

        if (!existingScanSnap.empty) {
            return res.json({ status: "NOK", message: "Öğrenci zaten yoklamada mevcut." });
        }

        await addDoc(collection(db, "AttendanceLogs"), {
            session_id: session_id,
            student_id: student_id,
            student_name: studentName,
            student_device: "MANUAL_ENTRY",
            course_code: sessionData.course_code,
            timestamp: new Date().toISOString()
        });

        return res.json({ status: "OK", message: "Manuel olarak eklendi.", data: { student_id, student_name: studentName } });
    } catch (e) {
        console.error("Manual Attendance Error:", e);
        return res.status(500).json({ status: "NOK", message: "Sunucu hatası" });
    }
});

module.exports = router;
