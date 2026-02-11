'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';
import { initializeEnvelopes, getEnvelopes, getEnvelopesForPreviousMonth } from '@/services/firestore';
import { ENVELOPE_CLASSES, EnvelopeClassId, getCurrentMonthId } from '@/lib/constants';
import { useLanguage } from '@/contexts/LanguageContext';

export default function InitMonthPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { t, isRTL, formatMonth, formatEnvelopeName } = useLanguage();
    const monthId = getCurrentMonthId();

    const [amounts, setAmounts] = useState<Record<string, number>>({});
    const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [alreadyInit, setAlreadyInit] = useState(false);
    const [loadingPrev, setLoadingPrev] = useState(false);
    const [toast, setToast] = useState('');

    useEffect(() => {
        async function checkExisting() {
            if (!user) return;
            const envs = await getEnvelopes(user.uid, monthId);
            if (envs.length > 0) {
                setAlreadyInit(true);
                const existingAmounts: Record<string, number> = {};
                const existingNames: Record<string, string> = {};
                for (const env of envs) {
                    existingAmounts[env.name] = env.initialAmount;
                    existingNames[env.name] = formatEnvelopeName(env.name, env.displayName);
                }
                setAmounts(existingAmounts);
                setDisplayNames(existingNames);
            } else {
                const defaultAmounts: Record<string, number> = {};
                const defaultNames: Record<string, string> = {};
                for (const cls of ENVELOPE_CLASSES) {
                    defaultAmounts[cls.id] = 0;
                    defaultNames[cls.id] = formatEnvelopeName(cls.id);
                }
                setAmounts(defaultAmounts);
                setDisplayNames(defaultNames);
            }
        }
        if (user) checkExisting();
    }, [user, monthId, formatEnvelopeName]);

    const handleChange = (id: string, value: string) => {
        const num = parseFloat(value) || 0;
        setAmounts((prev) => ({ ...prev, [id]: num }));
    };

    const handleNameChange = (id: string, value: string) => {
        setDisplayNames((prev) => ({ ...prev, [id]: value }));
    };

    const handleLoadPrevious = async () => {
        if (!user) return;
        setLoadingPrev(true);
        try {
            const prev = await getEnvelopesForPreviousMonth(user.uid, monthId);
            if (prev) {
                setAmounts(prev.amounts);
                setDisplayNames(prev.displayNames);
                showToast(t('initMonth.successLoad'));
            } else {
                showToast(t('initMonth.noPrevious'));
            }
        } catch {
            showToast(t('initMonth.loadError'));
        } finally {
            setLoadingPrev(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);
        try {
            await initializeEnvelopes(
                user.uid,
                monthId,
                amounts as Record<EnvelopeClassId, number>,
                displayNames
            );
            showToast(t('initMonth.successInit'));
            setTimeout(() => router.push('/dashboard'), 1000);
        } catch (err) {
            console.error('Init error:', err);
            const msg = err instanceof Error ? err.message : 'Error';
            showToast(`${t('initMonth.errorPrefix')} ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const total = Object.values(amounts).reduce((s, v) => s + v, 0);

    return (
        <AppShell>
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        {alreadyInit ? t('initMonth.titleEdit') : t('initMonth.titleInit')}
                    </h1>
                    <p className="page-subtitle">{formatMonth(monthId)}</p>
                </div>
                <button
                    className="btn btn-secondary"
                    onClick={handleLoadPrevious}
                    disabled={loadingPrev}
                >
                    {loadingPrev ? '⏳' : '📋'} {t('initMonth.loadPrev')}
                </button>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="init-grid">
                    {ENVELOPE_CLASSES.map((cls) => (
                        <div key={cls.id} className="glass-card init-card">
                            <div className="init-icon">{cls.icon}</div>
                            <div className="init-fields">
                                <input
                                    className="name-input"
                                    type="text"
                                    value={displayNames[cls.id] || ''}
                                    onChange={(e) => handleNameChange(cls.id, e.target.value)}
                                    placeholder={t(`envelopes.${cls.id}` as any)}
                                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                                />
                                <input
                                    className="form-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={amounts[cls.id] || ''}
                                    onChange={(e) => handleChange(cls.id, e.target.value)}
                                    placeholder={t('initMonth.amountPlaceholder')}
                                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="glass-card" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        {t('initMonth.totalBudget')}
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                        {total.toLocaleString('fr-FR')} {t('common.currency')}
                    </div>
                </div>

                <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={loading}
                    style={{ width: '100%', padding: '1rem' }}
                >
                    {loading ? `⏳ ${t('initMonth.saving')}` : `✓ ${t('initMonth.validate')}`}
                </button>
            </form>

            {toast && <div className="toast">{toast}</div>}

            <style jsx>{`
                .name-input {
                    background: none;
                    border: none;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    color: white;
                    font-weight: 600;
                    font-size: 0.95rem;
                    padding: 4px 0;
                    margin-bottom: 8px;
                    width: 100%;
                    outline: none;
                    transition: border-color 0.2s;
                }
                .name-input:focus {
                    border-bottom-color: var(--accent-primary);
                }
                .init-fields {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                }
            `}</style>
        </AppShell>
    );
}
