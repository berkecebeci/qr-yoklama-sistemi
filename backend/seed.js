const { db } = require('./db');
const { doc, setDoc } = require('firebase/firestore');

async function seedDatabase() {
    console.log("Seeding database...");

    const users = [
        { user_id: "ADMIN001", name: "ZBEÜ Admin", email: "admin@zbeu.edu.tr", role: "admin", password: "admin" }, // Mock password for login check
        { user_id: "ACAD9988", name: "Elif Yılmaz", email: "elif.yilmaz@akademik.edu.tr", role: "academician" },
        { user_id: "ACAD7766", name: "Ahmet Kaya", email: "ahmet.kaya@akademik.edu.tr", role: "academician" },
        { user_id: "STUDENT101", name: "Ali Veli", email: "ali.veli@ogrenci.edu.tr", role: "student" },
        { user_id: "STUDENT102", name: "Ayşe Öz", email: "ayse.oz@ogrenci.edu.tr", role: "student" },
    ];

    const courses = [
        { code: "MBG301", name: "Moleküler Biyoloji", instructor_id: "ACAD9988" },
        { code: "FIZ102", name: "Fizik II", instructor_id: "ACAD9988" },
        { code: "MAT201", name: "Diferansiyel Denklemler", instructor_id: "ACAD7766" },
        { code: "BLM497", name: "Proje Tasarımı", instructor_id: "ACAD7766" }
    ];

    try {
        for (const user of users) {
            await setDoc(doc(db, "Users", user.user_id), {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                role: user.role,
                created_at: new Date().toISOString()
            });
            console.log(`Added user: ${user.name}`);
        }

        for (const course of courses) {
            await setDoc(doc(db, "Courses", course.code), {
                code: course.code,
                name: course.name,
                instructor_id: course.instructor_id,
                created_at: new Date().toISOString()
            });
            console.log(`Added course: ${course.code}`);
        }

        console.log("Database seed complete!");
        process.exit();
    } catch (error) {
        console.error("Seeding error:", error);
    }
}

seedDatabase();
