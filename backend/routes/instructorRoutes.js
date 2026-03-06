const express = require('express');
const { collection, getDocs, query, where, doc, setDoc } = require('firebase/firestore');
const { db } = require('../db');
const router = express.Router();

// Get Instructor Dashboard Data (Courses & Stats)
router.get('/:instructorId/dashboard', async (req, res) => {
    const { instructorId } = req.params;
    try {
        // Fetch courses assigned to this instructor
        const q = query(collection(db, "Courses"), where("instructor_id", "==", instructorId));
        const coursesSnap = await getDocs(q);

        // Ensure meta string exists for UI compatibility
        const courses = coursesSnap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                code: data.code,
                name: data.name,
                meta: `${instructorId} | Aktif`
            };
        });

        // Calculate Real Overall Attendance
        let totalSessions = 0;
        let totalAttendees = 0;

        // Find total students in system (simplified logic for overall max possible attendance per session)
        const usersSnap = await getDocs(collection(db, "Users"));
        let totalStudents = 0;
        usersSnap.forEach(u => { if (u.data().role === 'student') totalStudents++; });

        for (const course of courses) {
            const sessionsQ = query(collection(db, "Sessions"), where("course_code", "==", course.code));
            const sessionsSnap = await getDocs(sessionsQ);

            sessionsSnap.forEach(sDoc => {
                totalSessions++;
                totalAttendees += (sDoc.data().attendee_count || 0);
            });
        }

        let overallPercentage = 0;
        if (totalSessions > 0 && totalStudents > 0) {
            const maxPossibleAttendance = totalSessions * totalStudents;
            overallPercentage = Math.round((totalAttendees / maxPossibleAttendance) * 100);
        }

        res.json({
            status: "OK",
            data: {
                courses: courses,
                stats: {
                    active_courses: courses.length,
                    overall_attendance: `${overallPercentage}%`,
                    warnings: 0
                }
            }
        });
    } catch (error) {
        console.error("Instructor Dashboard Error:", error);
        res.status(500).json({ status: "NOK", message: "Veri çekilirken sunucu hatası oluştu." });
    }
});

// Update Instructor Profile
router.post('/:instructorId/profile', async (req, res) => {
    const { instructorId } = req.params;
    const { name, title } = req.body;
    try {
        const userRef = doc(db, "Users", instructorId);
        // Update user properties in Firestore
        await setDoc(userRef, {
            name,
            role: title === 'Yönetici' ? 'admin' : 'academician'
        }, { merge: true });

        res.json({ status: "OK", message: "Profil güncellendi" });
    } catch (error) {
        console.error("Profile Update Error:", error);
        res.status(500).json({ status: "NOK", message: "Profil güncellenemedi." });
    }
});

module.exports = router;
