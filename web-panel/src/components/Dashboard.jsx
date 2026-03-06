import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    LayoutDashboard,
    BookOpen,
    User,
    LogOut,
    Layers,
    PieChart,
    AlertTriangle,
    Search,
    QrCode,
    Mail,
    Shield,
    Edit2
} from 'lucide-react';

const Dashboard = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('Ana Sayfa');

    // User Details State
    const [userName, setUserName] = useState(() => {
        return localStorage.getItem('profile_name') || "Dr. Öğretim Üyesi";
    });
    const [userTitle, setUserTitle] = useState(() => {
        return localStorage.getItem('profile_title') || "Akademisyen";
    });
    const userId = localStorage.getItem('user_id');
    const [courses, setCourses] = useState([]);
    const [stats, setStats] = useState({ active_courses: 0, overall_attendance: '0%', warnings: 0 });

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/instructor/${userId}/dashboard`);
                if (res.data.status === 'OK') {
                    setCourses(res.data.data.courses);
                    setStats(res.data.data.stats);
                }
            } catch (err) {
                console.error("Dashboard veri çekme hatası:", err);
            }
        };
        if (userId) fetchDashboardData();
    }, [userId]);

    // Navigate to Live Attendance
    const startAttendance = async (courseCode) => {
        try {
            const res = await axios.post('http://localhost:5000/api/session/start', {
                course_code: courseCode,
                duration_minutes: 50
            });
            if (res.data.status === 'OK') {
                navigate(`/live/${res.data.data.session_id}`, {
                    state: {
                        course: courseCode,
                        qr_content: res.data.data.qr_content
                    }
                });
            }
        } catch (error) {
            console.error(error);
            alert("Oturum başlatılamadı!");
            // Fallback for UI visualization testing if backend unreachabe
            navigate(`/live/test_session_123`, { state: { course: courseCode, qr_content: "test_qr" } });
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/');
    };

    return (
        <div style={{ display: 'flex', height: '100vh', backgroundColor: '#F8FAFC', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {/* Sidebar */}
            <div style={{ width: '250px', backgroundColor: 'white', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', padding: '24px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', marginBottom: '40px' }}>
                    <div style={{ width: '32px', height: '32px', backgroundColor: '#EF4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px' }}>
                        <QrCode color="white" size={18} />
                    </div>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1E293B' }}>QR Yoklama</span>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 16px' }}>
                    <SidebarItem icon={<LayoutDashboard size={20} />} label="Ana Sayfa" active={activeTab === 'Ana Sayfa'} onClick={() => setActiveTab('Ana Sayfa')} />
                    <SidebarItem icon={<BookOpen size={20} />} label="Derslerim" active={activeTab === 'Derslerim'} onClick={() => setActiveTab('Derslerim')} />
                    <SidebarItem icon={<User size={20} />} label="Profil" active={activeTab === 'Profil'} onClick={() => setActiveTab('Profil')} />
                </div>

                <div style={{ padding: '0 16px' }}>
                    <button
                        onClick={handleLogout}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', width: '100%', backgroundColor: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', borderRadius: '8px', fontWeight: '500' }}>
                        <LogOut size={20} />
                        Çıkış Yap
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                {/* Header */}
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 40px', backgroundColor: 'white', borderBottom: '1px solid #E2E8F0' }}>
                    <h2 style={{ margin: 0, fontSize: '20px', color: '#1E293B' }}>{activeTab === 'Ana Sayfa' ? 'Hoşgeldiniz' : activeTab}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1E293B' }}>{userName}</div>
                            <div style={{ fontSize: '12px', color: '#64748B' }}>{userTitle}</div>
                        </div>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#DBEAFE', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6', fontWeight: 'bold' }}>
                            {userName ? userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'ÖÜ'}
                        </div>
                    </div>
                </header>

                {/* Body Details */}
                <main style={{ padding: '32px 40px', flex: 1 }}>
                    {activeTab === 'Ana Sayfa' && <OverviewTab onNavigateToCourse={() => setActiveTab('Derslerim')} stats={stats} courses={courses} />}
                    {activeTab === 'Derslerim' && <CoursesTab onStartSession={startAttendance} courses={courses} />}
                    {activeTab === 'Profil' && <ProfileTab userName={userName} userTitle={userTitle} email={`${userId}@zbeu.edu.tr`} onSaveProfile={async (newName, newTitle) => {
                        try {
                            const res = await axios.post(`http://localhost:5000/api/instructor/${userId}/profile`, {
                                name: newName,
                                title: newTitle
                            });
                            if (res.data.status === 'OK') {
                                setUserName(newName);
                                setUserTitle(newTitle);
                                localStorage.setItem('profile_name', newName);
                                localStorage.setItem('profile_title', newTitle);
                                alert("Profil güncellendi.");
                            } else {
                                alert("Profil güncellenemedi: " + res.data.message);
                            }
                        } catch (err) {
                            alert("Profil kaydedilirken hata oluştu!");
                        }
                    }} />}
                </main>
            </div>
        </div>
    );
};

const SidebarItem = ({ icon, label, active, onClick }) => {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', width: '100%',
                backgroundColor: active ? '#EFF6FF' : 'transparent',
                color: active ? '#3B82F6' : '#64748B',
                border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s', textAlign: 'left'
            }}
        >
            {icon}
            {label}
        </button>
    );
}

const OverviewTab = ({ onNavigateToCourse, stats, courses }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Stat Cards */}
            <div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1E293B' }}>Genel Bakış</h3>
                <div style={{ display: 'flex', gap: '24px' }}>
                    <StatCard title="Aktif Dersler" value={stats.active_courses} icon={<Layers color="#3B82F6" size={24} />} bgColor="#EFF6FF" />
                    <StatCard title="Genel Katılım" value={stats.overall_attendance} icon={<PieChart color="#10B981" size={24} />} bgColor="#D1FAE5" />
                    <StatCard title="Katılım Uyarıları" value={stats.warnings} icon={<AlertTriangle color="#EF4444" size={24} />} bgColor="#FEE2E2" />
                </div>
            </div>

            {/* Upcoming Classes */}
            <div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1E293B' }}>Kayıtlı Dersleriniz</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {courses.slice(0, 3).map(course => (
                        <ScheduleCard
                            key={course.code}
                            initials={course.code.substring(0, 2).toUpperCase()}
                            code={course.code}
                            name={course.name}
                            time="Ders Programına Göre"
                            location="Fakülte Binası"
                            btnLabel="Derse Git"
                            btnType="primary"
                            onAction={onNavigateToCourse}
                        />
                    ))}
                    {courses.length === 0 && <p style={{ color: '#64748B' }}>Henüz üzerinize atanmış bir ders bulunmuyor.</p>}
                </div>
            </div>
        </div>
    );
}

const StatCard = ({ title, value, icon, bgColor }) => {
    return (
        <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {icon}
                </div>
                <span style={{ fontSize: '14px', color: '#64748B', fontWeight: '500' }}>{title}</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1E293B' }}>{value}</div>
        </div>
    );
}

const ScheduleCard = ({ initials, code, name, time, location, btnLabel, btnType, onAction }) => {
    const isPrimary = btnType === 'primary';
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', padding: '16px 24px', borderRadius: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '8px', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#475569' }}>
                    {initials}
                </div>
                <div>
                    <div style={{ fontWeight: '600', color: '#1E293B', marginBottom: '4px' }}>{code} - {name}</div>
                    <div style={{ fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{time}</span> • <span>{location}</span>
                    </div>
                </div>
            </div>
            <button
                onClick={onAction}
                style={{
                    backgroundColor: isPrimary ? '#3B82F6' : '#F1F5F9',
                    color: isPrimary ? 'white' : '#64748B',
                    border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: '500', cursor: isPrimary ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                {isPrimary && <QrCode size={16} />}
                {btnLabel}
            </button>
        </div>
    );
};

const CoursesTab = ({ onStartSession, courses }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCourses = courses.filter(c =>
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: '12px 16px', borderRadius: '8px', width: '400px', border: '1px solid #E2E8F0' }}>
                <Search size={18} color="#94A3B8" />
                <input
                    type="text"
                    placeholder="Ders adı veya kodu ile ara"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ border: 'none', outline: 'none', marginLeft: '12px', flex: 1, fontSize: '14px' }}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
                {filteredCourses.map(course => (
                    <CourseControlCard
                        key={course.code}
                        code={course.code}
                        name={course.name}
                        meta={course.meta}
                        onStart={() => onStartSession(course.code)}
                    />
                ))}
                {filteredCourses.length === 0 && <div style={{ color: '#64748B' }}>Sonuç bulunamadı.</div>}
            </div>
        </div>
    );
};

const CourseControlCard = ({ code, name, meta, onStart }) => {
    const [announcement, setAnnouncement] = useState('');
    const [pastSessions, setPastSessions] = useState(null);
    const [loadingPast, setLoadingPast] = useState(false);
    const [visibleCount, setVisibleCount] = useState(5);

    const handleSendAnnouncement = async () => {
        if (!announcement) return;
        try {
            const res = await axios.post('http://localhost:5000/api/notifications/send', {
                title: `${code} - ${name}`,
                body: announcement,
                target_user_id: null
            });
            if (res.data.status === 'OK') {
                alert(`Duyuru gönderildi: ${announcement}`);
                setAnnouncement('');
            } else {
                alert(`Duyuru gönderilemedi: ${res.data.message}`);
            }
        } catch (err) {
            alert("Duyuru gönderilirken bir hata oluştu.");
        }
    };

    return (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1E293B', marginBottom: '4px' }}>{code} {name}</div>
                <div style={{ fontSize: '13px', color: '#64748B' }}>{meta}</div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
                <input
                    type="text"
                    placeholder="Sınıfa hızlı bir duyuru gönderin..."
                    value={announcement}
                    onChange={(e) => setAnnouncement(e.target.value)}
                    style={{ flex: 1, padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
                />
                <button
                    onClick={handleSendAnnouncement}
                    style={{ backgroundColor: '#F1F5F9', color: '#475569', border: 'none', padding: '0 16px', borderRadius: '6px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}>
                    Gönder
                </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                    onClick={onStart}
                    style={{ backgroundColor: '#10B981', color: 'white', border: 'none', padding: '12px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '600', cursor: 'pointer', flex: 1 }}>
                    <QrCode size={18} />
                    Yoklama Başlat
                </button>
                <button
                    onClick={async () => {
                        if (pastSessions) {
                            setPastSessions(null); // toggle off
                            setVisibleCount(5);
                            return;
                        }
                        setLoadingPast(true);
                        try {
                            const res = await axios.get(`http://localhost:5000/api/session/course/${code}`);
                            if (res.data.status === 'OK') setPastSessions(res.data.data);
                        } catch {
                            alert("Geçmiş yoklamalar okunamadı.");
                        } finally {
                            setLoadingPast(false);
                        }
                    }}
                    style={{ backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', padding: '12px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '600', cursor: 'pointer', flex: 1 }}>
                    <BookOpen size={18} />
                    {loadingPast ? 'Yükleniyor...' : (pastSessions ? 'Gizle' : 'Geçmiş Yoklamalar')}
                </button>
            </div>

            {pastSessions && (
                <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#1E293B' }}>Eski Oturumlar ({pastSessions.length})</h4>
                    {pastSessions.length === 0 ? <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>Bu derse ait geçmiş yoklama kaydı bulunamadı.</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {pastSessions.slice(0, visibleCount).map(sess => (
                                <div key={sess.session_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '13px' }}>
                                    <div>
                                        <div style={{ fontWeight: '500', color: '#333' }}>{new Date(sess.created_at).toLocaleString('tr-TR')}</div>
                                        <div style={{ color: '#64748B', fontSize: '11px' }}>ID: {sess.session_id.substring(0, 12)}...</div>
                                    </div>
                                    <div style={{ fontWeight: '600', color: '#10B981' }}>{sess.attendee_count} Katılımcı</div>
                                </div>
                            ))}
                            {pastSessions.length > visibleCount && (
                                <button
                                    onClick={() => setVisibleCount(prev => prev + 5)}
                                    style={{ marginTop: '8px', padding: '8px', backgroundColor: '#EFF6FF', color: '#3B82F6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}>
                                    Daha Fazla Göster
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const ProfileTab = ({ userName, userTitle, email, onSaveProfile }) => {
    const [activeModal, setActiveModal] = useState(null);

    const closeModal = () => setActiveModal(null);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '800px', position: 'relative' }}>
            <h3 style={{ margin: '0 0 -16px 0', fontSize: '18px', color: '#1E293B', fontWeight: 'bold' }}>Hesap Yönetimi</h3>
            {/* Header Profile Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ width: '80px', height: '80px', backgroundColor: '#DBEAFE', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6', fontWeight: 'bold', fontSize: '28px' }}>
                    ÖÜ
                </div>
                <div>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: '#1E293B' }}>{userName}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', fontSize: '14px' }}>
                        <Mail size={16} /> {email}
                    </div>
                </div>
                <button
                    onClick={() => setActiveModal('edit_profile')}
                    style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#EFF6FF', color: '#3B82F6', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', transition: '0.2s' }}>
                    <Edit2 size={16} />
                    Profili Düzenle
                </button>
            </div>

            <div style={{ display: 'flex', gap: '24px' }}>
                {/* Personal Information */}
                <div style={{ flex: 1, backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ margin: '0 0 24px 0', fontSize: '16px', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={20} color="#3B82F6" /> Kişisel Bilgiler
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <InfoRow label="Tam Ad" value={userName} />
                        <InfoRow label="Ünvan" value={userTitle} />
                        <InfoRow label="Departman" value="Bilgisayar Mühendisliği" />
                        <InfoRow label="Sicil No" value="ZB-2023-456" />
                    </div>
                </div>

                {/* Account & Security */}
                <div style={{ flex: 1, backgroundColor: 'white', padding: '32px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ margin: '0 0 24px 0', fontSize: '16px', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Shield size={20} color="#10B981" /> Güvenlik Ayarları
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <InfoRow label="Şifre" value="********" action="Değiştir" onAction={() => setActiveModal('change_password')} />
                        <InfoRow label="İki Adımlı Doğrulama" value="Kapalı" action="Aktif Et" onAction={() => setActiveModal('two_factor')} />
                        <InfoRow label="Son Giriş" value="Bugün, 20:45" />
                        <InfoRow label="Cihaz Eşleşmeleri" value="1 Kayıtlı Cihaz" action="Yönet" onAction={() => setActiveModal('devices')} />
                    </div>
                </div>
            </div>

            {/* Overlays */}
            {activeModal && <ModalOverlay type={activeModal} onClose={closeModal} userName={userName} userTitle={userTitle} email={email} onSaveProfile={(n, t) => { onSaveProfile(n, t); closeModal(); }} />}
        </div>
    );
};

const InfoRow = ({ label, value, action, onAction }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F8FAFC', paddingBottom: '12px' }}>
        <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '6px' }}>{label}</div>
            <div style={{ fontSize: '14px', color: '#1E293B', fontWeight: '500' }}>{value}</div>
        </div>
        {action && (
            <button
                onClick={onAction}
                style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: 0 }}>
                {action}
            </button>

        )}
    </div>
);

const ModalOverlay = ({ type, onClose, userName, userTitle, email, onSaveProfile }) => {
    const [editName, setEditName] = useState(userName);
    const [editTitle, setEditTitle] = useState(userTitle);

    let content = null;
    let onSaveClick = () => { alert('Değişiklikler kaydedildi!'); onClose(); };

    if (type === 'edit_profile') {
        content = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0 }}>Profili Düzenle</h3>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #E2E8F0' }} />
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #E2E8F0' }} />
                <input type="email" value={email} disabled style={{ padding: '10px', borderRadius: '6px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }} />
            </div>
        );
        onSaveClick = () => {
            onSaveProfile(editName, editTitle);
        };
    } else if (type === 'change_password') {
        content = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0 }}>Şifre Değiştir</h3>
                <input type="password" placeholder="Mevcut Şifre" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #E2E8F0' }} />
                <input type="password" placeholder="Yeni Şifre" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #E2E8F0' }} />
                <input type="password" placeholder="Yeni Şifre (Tekrar)" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #E2E8F0' }} />
            </div>
        );
    } else if (type === 'two_factor') {
        content = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0 }}>İki Adımlı Doğrulama (2FA)</h3>
                <p style={{ fontSize: '14px', color: '#64748B' }}>
                    Hesabınızı güvenceye almak için cep telefonunuza SMS şifresi gönderilmesini sağlayın. (Yapım aşamasında)
                </p>
            </div>
        );
    } else if (type === 'devices') {
        content = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0 }}>Cihaz Eşleşmeleri</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                    <div>
                        <div style={{ fontWeight: '500' }}>Windows PC - Chrome</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>Son Görülme: 1 Dakika Önce</div>
                    </div>
                    <button style={{ color: '#EF4444', backgroundColor: '#FEE2E2', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer' }}>Kaldır</button>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div style={{ backgroundColor: 'white', width: '400px', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {content}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#F1F5F9', color: '#475569', cursor: 'pointer', fontWeight: '500' }}>İptal</button>
                    <button onClick={onSaveClick} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#3B82F6', color: 'white', cursor: 'pointer', fontWeight: '500' }}>Kaydet</button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
