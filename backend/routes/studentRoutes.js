const express = require('express');
const { collection, query, where, getDocs, doc, getDoc } = require('firebase/firestore');
const { db } = require('../db');
const router = express.Router();

// Öğrenciye ait dersler ve yoklama durumları
router.get('/:student_id/dashboard', async (req, res) => {
    const studentId = req.params.student_id;

    try {
        // Fetch all registered courses from Firestore
        const coursesSnap = await getDocs(collection(db, "Courses"));
        const enrolledCourses = coursesSnap.docs.map(doc => {
            const data = doc.data();
            return {
                code: data.code,
                title: data.name,
                instructor: "Öğretim Üyesi", // Without a join to Users, use generic title or leave blank
                classroom: "Fakülte" // Generic placeholder until classroom fields are added to DB
            };
        });

        let courseSummaries = [];

        for (const course of enrolledCourses) {
            // Find total sessions held for this course
            const sessionsQ = query(
                collection(db, "Sessions"),
                where("course_code", "==", course.code)
            );
            const sessionsSnap = await getDocs(sessionsQ);
            const totalSessions = sessionsSnap.size;

            // Find sessions this student attended for this course
            const attendanceQ = query(
                collection(db, "AttendanceLogs"),
                where("course_code", "==", course.code),
                where("student_id", "==", studentId)
            );
            const attendanceSnap = await getDocs(attendanceQ);
            const attendedSessions = attendanceSnap.size;

            // Basic calculation
            const absenceLimit = 5;
            const absentCount = totalSessions - attendedSessions;
            const percentage = totalSessions === 0 ? 100 : Math.round((attendedSessions / totalSessions) * 100);

            let status = 'Güvenli';
            let color = 'green';
            if (absentCount >= absenceLimit) {
                status = 'Kaldı (Devamsızlık)';
                color = 'red';
            } else if (absentCount >= absenceLimit - 1) {
                status = 'Sınırda (Devamsızlık)';
                color = 'orange';
            }

            courseSummaries.push({
                ...course,
                attendance_percentage: percentage,
                total_absences: absentCount,
                absence_limit: absenceLimit,
                status: status,
                color: color,
                next_class_time: "Pzt 09:00" // Simulated upcoming
            });
        }

        return res.json({
            status: "OK",
            data: { courses: courseSummaries }
        });

    } catch (error) {
        console.error("Student Dashboard Error:", error);
        return res.status(500).json({ status: "NOK", message: "Sunucu hatası" });
    }
});

// Öğrencinin yaklaşan dersleri (Ana Sayfa)
router.get('/:student_id/schedule', async (req, res) => {
    const studentId = req.params.student_id;

    try {
        // Dynamic schedule fetched from real courses
        const activeSessionsQ = query(collection(db, "Sessions"), where("status", "==", "active"));
        const activeSessionsSnap = await getDocs(activeSessionsQ);
        const activeCourseCodes = activeSessionsSnap.docs.map(doc => doc.data().course_code);

        const coursesSnap = await getDocs(collection(db, "Courses"));
        let schedule = [];

        coursesSnap.forEach(doc => {
            const data = doc.data();
            schedule.push({
                time: "Ders Programı", // Generic until DB supports times
                title: `${data.name} (${data.code})`,
                instructor: "Öğretim Üyesi",
                classroom: "Fakülte",
                isNow: activeCourseCodes.includes(data.code)
            });
        });

        return res.json({
            status: "OK",
            data: { schedule: schedule }
        });

    } catch (error) {
        console.error("Student Schedule Error:", error);
        return res.status(500).json({ status: "NOK", message: "Sunucu hatası" });
    }
});

module.exports = router;
