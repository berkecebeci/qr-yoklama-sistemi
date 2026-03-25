const express = require('express');
const { collection, getDocs, doc, setDoc, deleteDoc, query, where } = require('firebase/firestore');
const { db } = require('../db');
const router = express.Router();

// A real application would have middleware here to verify the JWT has role="admin"
// e.g. router.use(verifyAdminToken);

// ----------------- USERS (Students & Teachers) -----------------
router.get('/users', async (req, res) => {
    try {
        const usersSnap = await getDocs(collection(db, "Users"));
        const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const students = users.filter(u => u.role === 'student');
        const teachers = users.filter(u => u.role === 'academician');

        return res.json({ status: "OK", data: { students, teachers } });
    } catch (error) {
        console.error("Admin Get Users Error:", error);
        return res.status(500).json({ status: "NOK", message: "Sunucu hatası" });
    }
});

router.post('/users', async (req, res) => {
    const { user_id, name, email, role } = req.body;
    try {
        // Create user doc where document ID is the user_id (e.g. STUDENT101)
        await setDoc(doc(db, "Users", user_id), {
            user_id,
            name,
            email,
            role,
            created_at: new Date().toISOString()
        });
        return res.json({ status: "OK", message: "Kullanıcı başarıyla eklendi." });
    } catch (error) {
        console.error("Admin Add User Error:", error);
        return res.status(500).json({ status: "NOK", message: "Sunucu hatası" });
    }
});

router.delete('/users/:id', async (req, res) => {
    try {
        await deleteDoc(doc(db, "Users", req.params.id));
        return res.json({ status: "OK", message: "Kullanıcı silindi." });
    } catch (error) {
        return res.status(500).json({ status: "NOK", message: "Sunucu hatası" });
    }
});

// ----------------- COURSES -----------------
router.get('/courses', async (req, res) => {
    try {
        const coursesSnap = await getDocs(collection(db, "Courses"));
        const courses = coursesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.json({ status: "OK", data: { courses } });
    } catch (error) {
        console.error("Admin Get Courses Error:", error);
        return res.status(500).json({ status: "NOK", message: "Sunucu hatası" });
    }
});

router.post('/courses', async (req, res) => {
    const { code, name, instructor_id } = req.body;
    try {
        await setDoc(doc(db, "Courses", code), {
            code,
            name,
            instructor_id,
            created_at: new Date().toISOString()
        });
        return res.json({ status: "OK", message: "Ders başarıyla eklendi." });
    } catch (error) {
        return res.status(500).json({ status: "NOK", message: "Sunucu hatası" });
    }
});

router.delete('/courses/:code', async (req, res) => {
    try {
        await deleteDoc(doc(db, "Courses", req.params.code));
        return res.json({ status: "OK", message: "Ders silindi." });
    } catch (error) {
        return res.status(500).json({ status: "NOK", message: "Sunucu hatası" });
    }
});

// ----------------- REPORTS (Excel Export) -----------------
router.get('/reports/:courseCode', async (req, res) => {
    const { courseCode } = req.params;
    try {
        // 1. Get all closed sessions for this course, ordered by creation (we'll sort in memory here)
        const qSessions = query(collection(db, "Sessions"), where("course_code", "==", courseCode), where("status", "==", "closed"));
        const sessionSnap = await getDocs(qSessions);

        let sessions = sessionSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        sessions.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        if (sessions.length === 0) {
            return res.json({ status: "OK", data: [], message: "Bu derse ait bitmiş bir yoklama oturumu bulunmamaktadır." });
        }

        // Günlük gruplama: her tarih için kaç yoklama açıldığını hesapla
        const dailyCounts = {};
        sessions.forEach(ses => {
            const dateKey = ses.session_date || (ses.created_at ? ses.created_at.split('T')[0] : 'unknown');
            dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
        });

        // Her session'a günlük sıra numarasını ata (eğer yoksa)
        const dailyIndex = {};
        sessions.forEach(ses => {
            const dateKey = ses.session_date || (ses.created_at ? ses.created_at.split('T')[0] : 'unknown');
            dailyIndex[dateKey] = (dailyIndex[dateKey] || 0) + 1;
            ses._dailyNumber = dailyIndex[dateKey];
            ses._dailyTotal = dailyCounts[dateKey];
            ses._dateKey = dateKey;
        });

        const totalDays = Object.keys(dailyCounts).length;

        // 2. Fetch all students to build rows
        const usersSnap = await getDocs(collection(db, "Users"));
        const allStudents = usersSnap.docs.map(d => d.data()).filter(u => u.role === 'student');

        // 3. For each session, fetch attendance logs
        // Build a grid: mapping student ID -> { user_id, name, session1: true/false ... }
        const studentGrid = {};
        allStudents.forEach(stu => {
            studentGrid[stu.user_id] = {
                "Öğrenci No": stu.user_id,
                "Ad Soyad": stu.name,
                _weightedAttendance: 0
            };
        });

        let sessionIndex = 1;
        for (const session of sessions) {
            const attQ = query(collection(db, "AttendanceLogs"), where("session_id", "==", session.id));
            const attSnap = await getDocs(attQ);

            // Map of student_ids who attended this specific session
            const attendedStudentIds = new Set(attSnap.docs.map(doc => doc.data().student_id));

            // Sütun başlığı: aynı günde birden fazla yoklama varsa (1/3) gibi etiket ekle
            let sessionColName;
            if (session._dailyTotal > 1) {
                sessionColName = `Oturum ${sessionIndex} (${new Date(session.created_at).toLocaleDateString('tr-TR')}) [${session._dailyNumber}/${session._dailyTotal}]`;
            } else {
                sessionColName = `Oturum ${sessionIndex} (${new Date(session.created_at).toLocaleDateString('tr-TR')})`;
            }

            const sessionWeight = 1 / session._dailyTotal;

            // Populate the grid for this session
            Object.values(studentGrid).forEach(stuRecord => {
                if (attendedStudentIds.has(stuRecord["Öğrenci No"])) {
                    stuRecord[sessionColName] = "Katıldı";
                    stuRecord._weightedAttendance += sessionWeight;
                } else {
                    stuRecord[sessionColName] = "Yok";
                }
            });

            sessionIndex++;
        }

        // Finalize rows with weighted percentage
        const finalRows = Object.values(studentGrid).map(stu => {
            const percentage = ((stu._weightedAttendance / totalDays) * 100).toFixed(0) + "%";

            // Create a clean object without the temporary counter
            const { _weightedAttendance, ...rest } = stu;
            return {
                ...rest,
                "Toplam Gün": totalDays,
                "Toplam Oturum": sessions.length,
                "Ağırlıklı Devam": `${_weightedAttendance.toFixed(1)} / ${totalDays}`,
                "Devam Oranı": percentage
            };
        });

        return res.json({ status: "OK", data: finalRows });

    } catch (error) {
        console.error("Report Generation Error:", error);
        return res.status(500).json({ status: "NOK", message: "Rapor oluşturulurken sunucu hatası meydana geldi." });
    }
});

module.exports = router;
