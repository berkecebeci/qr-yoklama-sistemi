import React, { useEffect, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import axios from 'axios';

const LiveAttendance = () => {
    const { sessionId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const initialState = location.state || {};
    const [qrContent, setQrContent] = useState(initialState.qr_content || 'loading...');
    const [course] = useState(initialState.course || 'Bilinmiyor');

    const [attendees, setAttendees] = useState([]);
    const [manualStudentId, setManualStudentId] = useState('');

    // Her 3 saniyede bir Katılanları çek ve QR kodu ROTE ET (Dinamik QR Mantığı)
    useEffect(() => {
        const fetchLive = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/session/${sessionId}/live`);
                if (res.data.status === 'OK') setAttendees(res.data.data.attendees);
            } catch (err) { console.error("Live fetch error", err); }
        };

        const rotateQR = async () => {
            try {
                const res = await axios.post(`http://localhost:5000/api/session/${sessionId}/rotate`);
                if (res.data.status === 'OK') setQrContent(res.data.data.new_qr_token);
            } catch (err) { console.error("Rotate error", err); }
        };

        const listInterval = setInterval(fetchLive, 2000);
        // QR kodun 5 saniyede bir değişmesini istiyoruz
        const qrInterval = setInterval(rotateQR, 5000);

        return () => {
            clearInterval(listInterval);
            clearInterval(qrInterval);
        };
    }, [sessionId]);

    const handleClose = async () => {
        try {
            await axios.post(`http://localhost:5000/api/session/${sessionId}/close`);
            navigate('/dashboard');
        } catch (e) {
            console.error(e);
            alert('Kapatılamadı');
        }
    };

    const handleAddManual = async () => {
        if (!manualStudentId) return;
        try {
            const res = await axios.post(`http://localhost:5000/api/attendance/manual`, {
                session_id: sessionId,
                student_id: manualStudentId
            });
            if (res.data.status === 'OK') {
                const studentName = res.data.data?.student_name || 'Öğrenci';
                alert(`${studentName} başarıyla eklendi.`);
                setManualStudentId('');
                // Let the next listInterval fetch the updated list
            } else {
                alert(res.data.message || 'Eklenemedi');
            }
        } catch (e) {
            console.error(e);
            alert('Sunucu hatası');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'row', height: '100vh', width: '100vw' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f4f9' }}>
                <h2>Yoklama Aktif</h2>
                <p>Ders: {course}</p>
                <div style={{ padding: '20px', background: 'white', borderRadius: '10px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
                    <QRCode value={qrContent} size={256} />
                </div>
                <p style={{ color: 'red', fontWeight: 'bold' }}>QR Kod Her 5 Saniyede Bir Değişir (Süre Kısıtlı)</p>

                <button
                    onClick={handleClose}
                    style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                    Oturumu Sonlandır
                </button>
            </div>

            <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
                <h2>Canlı Yoklama Listesi</h2>
                <h3>Katılanlar ({attendees.length})</h3>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {attendees.map((student, index) => (
                        <li key={index} style={{ padding: '10px', borderBottom: '1px solid #ccc', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{student.student_name ? `${student.student_name} (${student.student_id})` : (student.student_id ? `Öğrenci No: ${student.student_id}` : `Cihaz: ${student.student_device.substring(0, 8)}...`)}</span>
                            <span style={{ color: 'green' }}>✓ Katıldı</span>
                        </li>
                    ))}
                    {attendees.length === 0 && <p>Henüz katılan kimse yok...</p>}
                </ul>

                {/* Manual Entry Form */}
                <div style={{ marginTop: '40px', padding: '20px', backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ marginTop: 0 }}>Manuel Öğrenci Ekle</h3>
                    <p style={{ fontSize: '13px', color: '#64748B' }}>Kamerası bozuk veya telefonu olmayan öğrencileri numarasıyla ekleyin.</p>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <input
                            type="text"
                            placeholder="Öğrenci Numarası"
                            value={manualStudentId}
                            onChange={(e) => setManualStudentId(e.target.value)}
                            style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #E2E8F0' }}
                        />
                        <button
                            onClick={handleAddManual}
                            style={{ padding: '10px 20px', backgroundColor: '#3B82F6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
                            Ekle
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveAttendance;
