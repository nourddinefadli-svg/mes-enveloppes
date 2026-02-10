'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, register } = useAuth();
    const router = useRouter();

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
            switch (firebaseError.code) {
                case 'auth/user-not-found':
                    setError('Aucun compte trouvé avec cet email.');
                    break;
                case 'auth/wrong-password':
                    setError('Mot de passe incorrect.');
                    break;
                case 'auth/email-already-in-use':
                    setError('Cet email est déjà utilisé.');
                    break;
                case 'auth/weak-password':
                    setError('Le mot de passe doit contenir au moins 6 caractères.');
                    break;
                case 'auth/invalid-email':
                    setError('Email invalide.');
                    break;
                case 'auth/invalid-api-key':
                    setError('Clé API Firebase invalide. Vérifiez votre .env.local.');
                    break;
                case 'auth/invalid-credential':
                    setError('Email ou mot de passe incorrect.');
                    break;
                default:
                    console.error('Firebase error:', firebaseError);
                    setError(`Erreur: ${firebaseError.code || 'inconnue'}. Vérifiez la console.`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="glass-card auth-card">
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '3rem' }}>💰</span>
                </div>
                <h1 className="auth-title">Mes Enveloppes</h1>
                <p className="auth-subtitle">
                    {isRegister ? 'Créer un compte' : 'Connectez-vous pour gérer vos charges'}
                </p>

                {error && <div className="auth-error">{error}</div>}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="email">Email</label>
                        <input
                            id="email"
                            className="form-input"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="votre@email.com"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="password">Mot de passe</label>
                        <input
                            id="password"
                            className="form-input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={6}
                        />
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
                        {loading ? 'Chargement...' : isRegister ? "S'inscrire" : 'Se connecter'}
                    </button>
                </form>

                <div className="auth-toggle">
                    {isRegister ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
                    <button onClick={() => { setIsRegister(!isRegister); setError(''); }}>
                        {isRegister ? 'Se connecter' : "S'inscrire"}
                    </button>
                </div>
            </div>
        </div>
    );
}
