'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LoginPage() {
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, register } = useAuth();
    const router = useRouter();
    const { t, isRTL } = useLanguage();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isRegister) {
                await register(email, password);
            } else {
                await login(email, password);
            }
            router.push('/dashboard');
        } catch (err: unknown) {
            const firebaseError = err as { code?: string };
            let errorKey = 'unknown';
            switch (firebaseError.code) {
                case 'auth/user-not-found': errorKey = 'userNotFound'; break;
                case 'auth/wrong-password': errorKey = 'wrongPassword'; break;
                case 'auth/email-already-in-use': errorKey = 'emailInUse'; break;
                case 'auth/weak-password': errorKey = 'weakPassword'; break;
                case 'auth/invalid-email': errorKey = 'invalidEmail'; break;
                case 'auth/invalid-api-key': errorKey = 'invalidApiKey'; break;
                case 'auth/invalid-credential': errorKey = 'invalidCredential'; break;
            }
            setError(t(`auth.errors.${errorKey}` as any));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="glass-card auth-card">
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '3rem' }}>💰</span>
                </div>
                <h1 className="auth-title">{t('auth.title')}</h1>
                <p className="auth-subtitle">
                    {isRegister ? t('auth.createAccount') : t('auth.loginToManage')}
                </p>

                {error && <div className="auth-error">{error}</div>}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="email" style={{ textAlign: isRTL ? 'right' : 'left', display: 'block' }}>
                            {t('auth.email')}
                        </label>
                        <input
                            id="email"
                            className="form-input"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="email@example.com"
                            required
                            style={{ textAlign: isRTL ? 'right' : 'left' }}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="password" style={{ textAlign: isRTL ? 'right' : 'left', display: 'block' }}>
                            {t('auth.password')}
                        </label>
                        <input
                            id="password"
                            className="form-input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={6}
                            style={{ textAlign: isRTL ? 'right' : 'left' }}
                        />
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
                        {loading ? t('common.loading') : isRegister ? t('auth.signUp') : t('auth.signIn')}
                    </button>
                </form>

                <div className="auth-toggle">
                    {isRegister ? t('auth.hasAccount') : t('auth.noAccount')}{' '}
                    <button onClick={() => { setIsRegister(!isRegister); setError(''); }}>
                        {isRegister ? t('auth.signIn') : t('auth.signUp')}
                    </button>
                </div>
            </div>
        </div>
    );
}
