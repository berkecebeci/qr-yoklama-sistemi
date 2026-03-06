const { adminAuth } = require('./firebaseAdmin');

const users = [
    { uid: "STUDENT101", email: "ali.veli@ogrenci.edu.tr", password: "ogrenci123", displayName: "Ali Veli" },
    { uid: "ACAD9988", email: "elif.yilmaz@akademik.edu.tr", password: "GucluSifre123!", displayName: "Elif Yılmaz" },
    // Admin user (optional, we check admin directly in code, but let's register just in case)
    { uid: "ADMIN001", email: "admin@zbeu.edu.tr", password: "admin123", displayName: "Admin" }
];

async function createAuthUsers() {
    for (const u of users) {
        try {
            await adminAuth.createUser({
                uid: u.uid,
                email: u.email,
                password: u.password,
                displayName: u.displayName,
            });
            console.log(`Created user in Auth: ${u.email}`);
        } catch (error) {
            if (error.code === 'auth/email-already-exists' || error.code === 'auth/uid-already-exists') {
                console.log(`User already exists: ${u.email}, updating password...`);
                // Update password just in case
                await adminAuth.updateUser(u.uid, { password: u.password });
                console.log(`Updated password for: ${u.email}`);
            } else {
                console.error(`Error creating ${u.email}:`, error);
            }
        }
    }
    console.log("Done.");
    process.exit();
}

createAuthUsers();
