'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import Navigation from '@/components/Navigation';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AppShell({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner" />
            </div>
        );
    }

    if (!user) return null;

    const { language, setLanguage, isRTL } = useLanguage();

    return (
        <>
            <Navigation />
            <div className="language-switcher glass-card">
                <button
                    className={`lang-btn ${language === 'fr' ? 'active' : ''}`}
                    onClick={() => setLanguage('fr')}
                >
                    FR
                </button>
                <button
                    className={`lang-btn ${language === 'ar' ? 'active' : ''}`}
                    onClick={() => setLanguage('ar')}
                >
                    AR
                </button>
                <button
                    className={`lang-btn ${language === 'both' ? 'active' : ''}`}
                    onClick={() => setLanguage('both')}
                >
                    FR/AR
                </button>
            </div>
            <main className="app-container">
                {children}
            </main>

            <style jsx>{`
                .language-switcher {
                    position: fixed;
                    top: 1rem;
                    right: ${isRTL ? 'auto' : '1rem'};
                    left: ${isRTL ? '1rem' : 'auto'};
                    z-index: 1000;
                    display: flex;
                    gap: 0.5rem;
                    padding: 0.4rem;
                    border-radius: var(--radius-full);
                }
                .lang-btn {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    font-size: 0.75rem;
                    font-weight: 700;
                    padding: 0.4rem 0.8rem;
                    cursor: pointer;
                    border-radius: var(--radius-full);
                    transition: all 0.2s;
                }
                .lang-btn:hover {
                    color: var(--text-primary);
                }
                .lang-btn.active {
                    background: var(--accent-gradient);
                    color: white;
                }
                @media (max-width: 640px) {
                    .language-switcher {
                        top: auto;
                        bottom: 6rem;
                    }
                }
            `}</style>
        </>
    );
}
