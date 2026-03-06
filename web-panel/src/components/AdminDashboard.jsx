import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './AdminDashboard.css';

function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('students');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalData, setModalData] = useState({});
    const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'

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
                </nav>
                <button className="logout-btn" onClick={() => window.location.href = '/'}>Çıkış Yap</button>
            </div>

            <div className="admin-content">
                <header className="admin-header">
                    <h2>Yönetim Paneli - {
                        activeTab === 'students' ? 'Öğrenciler' :
                            activeTab === 'teachers' ? 'Akademisyenler' :
                                activeTab === 'notifications' ? 'Duyurular' : 'Dersler'
                    }</h2>
                    {activeTab !== 'notifications' && <button className="add-btn" onClick={handleAdd}>+ Yeni Ekle</button>}
                </header>

                {loading ? (
                    <p>Yükleniyor...</p>
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
        </div>
    );
}

export default AdminDashboard;
