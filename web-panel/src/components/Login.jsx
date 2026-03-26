import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const Login = () => {
    const [email, setEmail] = useState('elif.yilmaz@akademik.edu.tr');
    const [password, setPassword] = useState('GucluSifre123!');
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [resetMessage, setResetMessage] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            let loginEmail = email;
            if (loginEmail.toLowerCase() === 'admin') {
                loginEmail = 'admin@zbeu.edu.tr';
            }

            const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
            const user = userCredential.user;
            const idToken = await user.getIdToken();

            // Call backend to verify token and get role/JWT
            const res = await fetch('http://localhost:5000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            });

            const data = await res.json();

            if (data.status === 'OK') {
                sessionStorage.setItem('token', data.data.access_token);
                sessionStorage.setItem('role', data.data.role);
                sessionStorage.setItem('user_id', data.data.user_id);
                sessionStorage.setItem('profile_name', data.data.name || 'Öğretmen');
                sessionStorage.setItem('profile_title', data.data.role === 'academician' ? 'Akademisyen' : 'Yönetici');

                if (data.data.role === 'admin') {
                    navigate('/admin');
                } else {
                    navigate('/dashboard');
                }
            } else {
                alert('Giriş Başarısız: ' + data.message);
            }
        } catch (error) {
            console.error('Login Error:', error);
            let message = 'Giriş Başarısız';
            if (error.code === 'auth/user-not-found') message = 'Kullanıcı bulunamadı';
            if (error.code === 'auth/wrong-password') message = 'Hatalı şifre';
            if (error.code === 'auth/invalid-email') message = 'Geçersiz e-posta';
            alert(message + ': ' + error.message);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        try {
            await sendPasswordResetEmail(auth, email);
            setResetMessage("Şifre sıfırlama e-postası gönderildi. Lütfen kutunuzu kontrol edin.");
        } catch (error) {
            console.error(error);
            alert("Hata: " + error.message);
        }
    };

    if (isForgotPassword) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '10%' }}>
                <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '350px', textAlign: 'center' }}>
                    <h2 style={{ marginBottom: '8px', color: '#1E293B' }}>Şifremi Unuttum</h2>
                    <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '24px' }}>Hesabınıza kayıtlı e-posta adresinizi girin. Size bir şifre sıfırlama bağlantısı göndereceğiz.</p>

                    {resetMessage ? (
                        <div style={{ padding: '16px', backgroundColor: '#D1FAE5', color: '#065F46', borderRadius: '8px', marginBottom: '24px' }}>
                            {resetMessage}
                        </div>
                    ) : (
                        <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input
                                type="email"
                                placeholder="E-Posta Adresiniz"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                style={{ padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', outline: 'none' }}
                            />
                            <button type="submit" style={{ padding: '12px', backgroundColor: '#3B82F6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                Sıfırlama Bağlantısı Gönder
                            </button>
                        </form>
                    )}

                    <div style={{ marginTop: '24px' }}>
                        <button onClick={() => { setIsForgotPassword(false); setResetMessage(''); }} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}>
                            Giriş Ekranına Dön
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '10%' }}>
            <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '350px', textAlign: 'center' }}>
                <div style={{ marginBottom: '32px' }}>
                    <h2 style={{ margin: 0, color: '#1E293B' }}>ZBEÜ Akademisyen</h2>
                    <p style={{ margin: '8px 0 0', color: '#64748B', fontSize: '14px' }}>Yoklama Yönetim Paneli</p>
                </div>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <input
                        type="text"
                        placeholder="E-Posta veya Kullanıcı Adı"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        style={{ padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', outline: 'none' }}
                    />
                    <input
                        type="password"
                        placeholder="Şifre"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        style={{ padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', outline: 'none' }}
                    />
                    <button type="submit" style={{ padding: '12px', backgroundColor: '#0056b3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>Giriş Yap</button>
                </form>

                <div style={{ marginTop: '20px' }}>
                    <button onClick={() => setIsForgotPassword(true)} style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', fontSize: '14px' }}>
                        Şifremi Unuttum?
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
