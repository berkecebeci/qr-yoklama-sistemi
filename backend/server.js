const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middlewares
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Fake/Mock Database until Firebase is configured
const db = {
    users: [],
    sessions: [],
    attendanceLogs: []
};

// Basit bir test endpoint'i
app.get('/api/ping', (req, res) => {
    res.json({ message: 'QR Yoklama API çalışıyor!' });
});

// Rotaların dahil edilmesi
const authRoutes = require('./routes/authRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const instructorRoutes = require('./routes/instructorRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/instructor', instructorRoutes);

// Sunucuyu başlatma
const PORT = process.env.PORT || 5000;
app.listen(PORT, '127.0.0.1', () => {
    console.log(`Sunucu http://127.0.0.1:${PORT} portunda çalışıyor.`);
});
