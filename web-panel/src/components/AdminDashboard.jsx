import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { getAuth, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import './AdminDashboard.css';

function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('students');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalData, setModalData] = useState({});
    const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [pwdForm, setPwdForm] = useState({ current: '', newPass: '', confirm: '' });
    const [pwdError, setPwdError] = useState('');

    const fetchItems = async () => {
        setLoading(true);
        try {
            if (activeTab === 'students' || activeTab === 'teachers') {
                const res = await fetch('http://localhost:5000/api/admin/users');
                const data = await res.json();
                if (data.status === 'OK') {
                    setItems(activeTab === 'students' ? data.data.students : data.data.teachers);
                }
            } else if (activeTab === 'courses') {
                const res = await fetch('http://localhost:5000/api/admin/courses');
                const data = await res.json();
                if (data.status === 'OK') {
                    setItems(data.data.courses);
                }
            }
        } catch (error) {
            console.error("Error fetching admin data", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchItems();
    }, [activeTab]);

    const handleDelete = async (id, isCourse = false) => {
        if (!window.confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
        try {
            const url = isCourse
                ? `http://localhost:5000/api/admin/courses/${id}`
                : `http://localhost:5000/api/admin/users/${id}`;

            const res = await fetch(url, { method: 'DELETE' });
            if (res.ok) {
                fetchItems(); // refresh list
            }
        } catch (e) {
            console.error("Silme hatası", e);
        }
    };

    const handleAdd = () => {
        setModalMode('add');
        setModalData(activeTab === 'courses'
            ? { code: '', name: '', instructor_id: '' }
            : { user_id: '', name: '', email: '', password: '', role: activeTab === 'students' ? 'student' : 'academician' }
        );
        setShowModal(true);
    };

    const handleEdit = (item) => {
        setModalMode('edit');
        setModalData({ ...item });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const url = activeTab === 'courses'
                ? 'http://localhost:5000/api/admin/courses'
                : 'http://localhost:5000/api/admin/users';

            // In a real app, 'edit' would use PUT/PATCH, but we only have POST to setDoc in our simple backend for now.
            // setDoc in Firestore overwrites by ID, so POST works for both adding and updating if the ID is the same.

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(modalData)
            });

            if (res.ok) {
                setShowModal(false);
                fetchItems();
            } else {
                alert("Kaydetme sırasında bir hata oluştu.");
            }
        } catch (error) {
            console.error("Save error", error);
            alert("Sunucu hatası");
        }
    };

    const handleSendNotification = async (e) => {
        e.preventDefault();
        const title = e.target.title.value;
        const body = e.target.body.value;
        const studentId = e.target.studentId.value; // Optional

        try {
            const res = await fetch('http://localhost:5000/api/notifications/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, body, target_user_id: studentId || null })
            });
            const data = await res.json();
            if (data.status === 'OK') {
                alert(`Başarılı: ${data.message}`);
                e.target.reset();
            } else {
                alert(`Hata: ${data.message}`);
            }
        } catch (err) {
            alert("Sunucu hatası");
        }
    };

    // FR-02: Yoklama Listesi Yükleme (Excel/CSV)
    const handleUploadStudentList = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet);

            let successCount = 0;
            for (const row of rows) {
                const userId = row['Öğrenci No'] || row['student_id'] || row['user_id'];
                const name = row['Ad Soyad'] || row['name'] || row['ad_soyad'];
                const email = row['E-Posta'] || row['email'] || `${userId}@ogrenci.edu.tr`;
                if (!userId || !name) continue;

                await fetch('http://localhost:5000/api/admin/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: String(userId), name, email, role: 'student' })
                });
                successCount++;
            }
            alert(`${successCount} öğrenci başarıyla sisteme yüklendi.`);
            fetchItems();
        } catch (error) {
            console.error('Upload error:', error);
            alert('Dosya yüklenirken hata oluştu: ' + error.message);
        }
        e.target.value = ''; // Reset file input
    };

    // FR-07: Admin kullanıcı şifresi sıfırlama
    const handleResetUserPassword = async (userId, userEmail) => {
        if (!window.confirm(`${userEmail} adresine şifre sıfırlama e-postası gönderilsin mi?`)) return;
        try {
            const res = await fetch('http://localhost:5000/api/auth/reset_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userEmail })
            });
            const data = await res.json();
            alert(data.message || 'Şifre sıfırlama bağlantısı gönderildi.');
        } catch (e) {
            alert('Hata: ' + e.message);
        }
    };

    // FR-06: Admin kendi şifresini değiştirme
    const handleAdminChangePassword = async () => {
        setPwdError('');
        if (!pwdForm.current || !pwdForm.newPass || !pwdForm.confirm) {
            setPwdError('Tüm alanları doldurun.');
            return;
        }
        if (pwdForm.newPass.length < 8) { setPwdError('Yeni şifre en az 8 karakter olmalıdır.'); return; }
        if (pwdForm.newPass !== pwdForm.confirm) { setPwdError('Yeni şifreler eşleşmiyor.'); return; }
        try {
            const authInstance = getAuth();
            const user = authInstance.currentUser;
            if (!user) { setPwdError('Firebase oturumu bulunamadı. Lütfen çıkış yapıp tekrar giriş yapın.'); return; }
            const credential = EmailAuthProvider.credential(user.email, pwdForm.current);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, pwdForm.newPass);
            alert('Şifreniz başarıyla değiştirildi.');
            setShowPasswordModal(false);
            setPwdForm({ current: '', newPass: '', confirm: '' });
        } catch (error) {
            setPwdError('Şifre değiştirme hatası: ' + error.message);
        }
    };

    const handleExportExcel = async (courseCode, courseName) => {
        try {
            const res = await fetch(`http://localhost:5000/api/admin/reports/${courseCode}`);
            const json = await res.json();

            if (json.status !== 'OK') {
                alert("Rapor alınamadı: " + json.message);
                return;
            }

            if (!json.data || json.data.length === 0) {
                alert("Bu derse ait bitmiş bir yoklama kaydı bulunamadı.");
                return;
            }

            // Generate Excel
            const worksheet = XLSX.utils.json_to_sheet(json.data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Yoklama Raporu");

            // Trigger download
            XLSX.writeFile(workbook, `${courseCode}_${courseName}_Yoklama_Raporu.xlsx`);
        } catch (error) {
            console.error(error);
            alert("Excel oluşturulurken bir hata meydana geldi.");
        }
    };

    return (
        <div className="admin-container">
            <div className="admin-sidebar">
                <div className="admin-brand">ZBEÜ Admin</div>
                <nav className="admin-nav">
                    <button
                        className={activeTab === 'students' ? 'active' : ''}
                        onClick={() => setActiveTab('students')}
                    >
                        Öğrenciler
                    </button>
                    <button
                        className={activeTab === 'teachers' ? 'active' : ''}
                        onClick={() => setActiveTab('teachers')}
                    >
                        Akademisyenler
                    </button>
                    <button
                        className={activeTab === 'courses' ? 'active' : ''}
                        onClick={() => setActiveTab('courses')}
                    >
                        Dersler
                    </button>
                    <button
                        className={activeTab === 'notifications' ? 'active' : ''}
                        onClick={() => setActiveTab('notifications')}
                    >
                        Duyurular (FCM)
                    </button>
                    <button
                        className={activeTab === 'upload' ? 'active' : ''}
                        onClick={() => setActiveTab('upload')}
                    >
                        Yoklama Listesi Yükle
                    </button>
                </nav>
                <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button className="logout-btn" style={{ margin: 0, backgroundColor: '#3b82f6' }} onClick={() => { setShowPasswordModal(true); setPwdError(''); setPwdForm({ current: '', newPass: '', confirm: '' }); }}>Şifre Değiştir</button>
                    <button className="logout-btn" style={{ margin: 0 }} onClick={() => { localStorage.removeItem('token'); window.location.href = '/'; }}>Çıkış Yap</button>
                </div>
            </div>

            <div className="admin-content">
                <header className="admin-header">
                    <h2>Yönetim Paneli - {
                        activeTab === 'students' ? 'Öğrenciler' :
                            activeTab === 'teachers' ? 'Akademisyenler' :
                                activeTab === 'notifications' ? 'Duyurular' :
                                    activeTab === 'upload' ? 'Yoklama Listesi Yükle' : 'Dersler'
                    }</h2>
                    {activeTab !== 'notifications' && activeTab !== 'upload' && <button className="add-btn" onClick={handleAdd}>+ Yeni Ekle</button>}
                </header>

                {loading ? (
                    <p>Yükleniyor...</p>
                ) : activeTab === 'upload' ? (
                    <div className="table-wrapper" style={{ padding: '24px' }}>
                        <h3 style={{ marginTop: 0 }}>Yoklama Listesi Yükle (FR-02)</h3>
                        <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '16px' }}>Öğrenci listesini Excel (.xlsx) veya CSV dosyası olarak sisteme yükleyin. Dosyada <strong>"Öğrenci No"</strong>, <strong>"Ad Soyad"</strong> ve isteğe bağlı <strong>"E-Posta"</strong> sütunları bulunmalıdır.</p>
                        <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleUploadStudentList}
                            style={{ padding: '12px', border: '2px dashed #ccc', borderRadius: '8px', width: '100%', cursor: 'pointer' }}
                        />
                    </div>
                ) : activeTab === 'notifications' ? (
                    <div className="table-wrapper" style={{ padding: '24px' }}>
                        <h3 style={{ marginTop: 0 }}>Yeni Duyuru (Push Notification) Gönder</h3>
                        <form onSubmit={handleSendNotification} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '500px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Başlık</label>
                                <input name="title" required placeholder="Ders İptali" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Mesaj</label>
                                <textarea name="body" required placeholder="Bugünkü ders iptal edilmiştir." rows="4" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', resize: 'vertical' }}></textarea>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Hedef Öğrenci ID (İsteğe Bağlı)</label>
                                <input name="studentId" placeholder="Örn: STUDENT101 (Tüm öğrencilere göndermek için boş bırakın)" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
                            </div>
                            <button type="submit" style={{ padding: '12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Bildirimi Gönder</button>
                        </form>
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    {activeTab !== 'courses' ? (
                                        <>
                                            <th>Kullanıcı ID</th>
                                            <th>Ad Soyad</th>
                                            <th>E-Posta</th>
                                            <th>İşlemler</th>
                                        </>
                                    ) : (
                                        <>
                                            <th>Ders Kodu</th>
                                            <th>Ders Adı</th>
                                            <th>Eğitmen ID</th>
                                            <th>İşlemler</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {items.length === 0 ? (
                                    <tr><td colSpan="4">Kayıt Bulunamadı.</td></tr>
                                ) : (
                                    items.map((item, index) => (
                                        <tr key={item.id || index}>
                                            {activeTab !== 'courses' ? (
                                                <>
                                                    <td>{item.user_id}</td>
                                                    <td>{item.name}</td>
                                                    <td>{item.email}</td>
                                                    <td>
                                                        <button className="action-btn edit" onClick={() => handleEdit(item)}>Düzenle</button>
                                                        <button className="action-btn delete" onClick={() => handleDelete(item.user_id || item.id, false)}>Sil</button>
                                                        <button className="action-btn" style={{ backgroundColor: '#f59e0b', color: 'white', marginLeft: '4px' }} onClick={() => handleResetUserPassword(item.user_id, item.email)}>Şifre Sıfırla</button>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td>{item.code}</td>
                                                    <td>{item.name}</td>
                                                    <td>{item.instructor_id}</td>
                                                    <td>
                                                        <button className="action-btn edit" onClick={() => handleExportExcel(item.code, item.name)} style={{ backgroundColor: '#10b981', color: 'white', marginRight: '8px' }}>Excel Çıktısı</button>
                                                        <button className="action-btn edit" onClick={() => handleEdit(item)}>Düzenle</button>
                                                        <button className="action-btn delete" onClick={() => handleDelete(item.code || item.id, true)}>Sil</button>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Overlay */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>{modalMode === 'add' ? 'Yeni Ekle' : 'Düzenle'} - {activeTab === 'courses' ? 'Ders' : 'Kullanıcı'}</h3>
                        <form onSubmit={handleSave}>
                            {activeTab !== 'courses' ? (
                                <>
                                    <input required placeholder="Kullanıcı ID (Örn: STUDENT102)" value={modalData.user_id || ''} onChange={e => setModalData({ ...modalData, user_id: e.target.value })} disabled={modalMode === 'edit'} />
                                    <input required placeholder="Ad Soyad" value={modalData.name || ''} onChange={e => setModalData({ ...modalData, name: e.target.value })} />
                                    <input required type="email" placeholder="E-Posta" value={modalData.email || ''} onChange={e => setModalData({ ...modalData, email: e.target.value })} />
                                </>
                            ) : (
                                <>
                                    <input required placeholder="Ders Kodu (Örn: MAT101)" value={modalData.code || ''} onChange={e => setModalData({ ...modalData, code: e.target.value })} disabled={modalMode === 'edit'} />
                                    <input required placeholder="Ders Adı" value={modalData.name || ''} onChange={e => setModalData({ ...modalData, name: e.target.value })} />
                                    <input required placeholder="Eğitmen ID (Örn: ACAD9988)" value={modalData.instructor_id || ''} onChange={e => setModalData({ ...modalData, instructor_id: e.target.value })} />
                                </>
                            )}
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowModal(false)} className="cancel-btn">İptal</button>
                                <button type="submit" className="save-btn">{modalMode === 'add' ? 'Oluştur' : 'Güncelle'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Password Change Modal */}
            {showPasswordModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Şifre Değiştir</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input type="password" placeholder="Mevcut Şifre" value={pwdForm.current} onChange={e => setPwdForm({ ...pwdForm, current: e.target.value })} />
                            <input type="password" placeholder="Yeni Şifre (en az 8 karakter)" value={pwdForm.newPass} onChange={e => setPwdForm({ ...pwdForm, newPass: e.target.value })} />
                            <input type="password" placeholder="Yeni Şifre (Tekrar)" value={pwdForm.confirm} onChange={e => setPwdForm({ ...pwdForm, confirm: e.target.value })} />
                            {pwdError && <p style={{ color: '#ef4444', margin: 0, fontSize: '14px' }}>{pwdError}</p>}
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowPasswordModal(false)} className="cancel-btn">İptal</button>
                                <button type="button" onClick={handleAdminChangePassword} className="save-btn">Güncelle</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminDashboard;
