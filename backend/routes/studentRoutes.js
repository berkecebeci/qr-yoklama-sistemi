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
                instructor: "Öğretim Üyesi",
                classroom: "Fakülte"
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

            // Tüm oturumları al
            const allSessions = sessionsSnap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));

            // Günlük gruplama: her gün için kaç yoklama açıldığını hesapla
            const dailyGroups = {};
            allSessions.forEach(ses => {
                const dateKey = ses.session_date || (ses.created_at ? ses.created_at.split('T')[0] : 'unknown');
                if (!dailyGroups[dateKey]) {
                    dailyGroups[dateKey] = [];
                }
                dailyGroups[dateKey].push(ses.id);
            });

            const totalDays = Object.keys(dailyGroups).length;

            // Find sessions this student attended for this course
            const attendanceQ = query(
                collection(db, "AttendanceLogs"),
                where("course_code", "==", course.code),
                where("student_id", "==", studentId)
            );
            const attendanceSnap = await getDocs(attendanceQ);
            const attendedSessionIds = new Set(attendanceSnap.docs.map(d => d.data().session_id));

            // Ağırlıklı devam hesaplama
            // Her gün için: katılınan yoklama sayısı / o gündeki toplam yoklama sayısı
            let weightedAttendance = 0;
            const dailyBreakdown = [];

            Object.entries(dailyGroups).forEach(([date, sessionIds]) => {
                const dailyTotal = sessionIds.length;
                const attendedInDay = sessionIds.filter(sid => attendedSessionIds.has(sid)).length;
                const dayWeight = attendedInDay / dailyTotal; // 0 ile 1 arası
                weightedAttendance += dayWeight;

                dailyBreakdown.push({
                    date,
                    total_sessions: dailyTotal,
                    attended: attendedInDay,
                    weight: dayWeight
                });
            });

            // Devamsızlık yüzdesi: toplam ağırlıklı devam / toplam gün sayısı * 100
            const percentage = totalDays === 0 ? 100 : Math.round((weightedAttendance / totalDays) * 100);
            const weightedAbsent = totalDays - weightedAttendance;

            const absenceLimit = 5;
            let status = 'Güvenli';
            let color = 'green';
            if (weightedAbsent >= absenceLimit) {
                status = 'Kaldı (Devamsızlık)';
                color = 'red';
            } else if (weightedAbsent >= absenceLimit - 1) {
                status = 'Sınırda (Devamsızlık)';
                color = 'orange';
            }

            courseSummaries.push({
                ...course,
                attendance_percentage: percentage,
                total_absences: parseFloat(weightedAbsent.toFixed(1)),
                absence_limit: absenceLimit,
                status: status,
                color: color,
                total_days: totalDays,
                total_sessions: allSessions.length,
                daily_breakdown: dailyBreakdown,
                next_class_time: "Pzt 09:00"
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
