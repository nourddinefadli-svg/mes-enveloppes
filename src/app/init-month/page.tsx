'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';
import { initializeEnvelopes, getEnvelopes, getEnvelopesForPreviousMonth } from '@/services/firestore';
import { ENVELOPE_CLASSES, EnvelopeClassId, CURRENCY, getCurrentMonthId, formatMonthLabel } from '@/lib/constants';

export default function InitMonthPage() {
    const { user } = useAuth();
    const router = useRouter();
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
                    existingNames[env.name] = env.displayName || ENVELOPE_CLASSES.find(c => c.id === env.name)?.label || env.name;
                }
                setAmounts(existingAmounts);
                setDisplayNames(existingNames);
            } else {
                // Default all to 0 and default labels
                const defaultAmounts: Record<string, number> = {};
                const defaultNames: Record<string, string> = {};
                for (const cls of ENVELOPE_CLASSES) {
                    defaultAmounts[cls.id] = 0;
                    defaultNames[cls.id] = cls.label;
                }
                setAmounts(defaultAmounts);
                setDisplayNames(defaultNames);
            }
        }
        checkExisting();
    }, [user, monthId]);

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
                showToast('Données du mois précédent chargées !');
            } else {
                showToast('Aucun mois précédent trouvé.');
            }
        } catch {
            showToast('Erreur de chargement.');
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
            showToast('Mois initialisé avec succès !');
            setTimeout(() => router.push('/dashboard'), 1000);
        } catch (err) {
            console.error('Init error:', err);
            const msg = err instanceof Error ? err.message : 'Erreur inconnue';
            showToast(`Erreur: ${msg}`);
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
                        {alreadyInit ? 'Modifier le mois' : 'Initialiser le mois'}
                    </h1>
                    <p className="page-subtitle">{formatMonthLabel(monthId)}</p>
                </div>
                <button
                    className="btn btn-secondary"
                    onClick={handleLoadPrevious}
                    disabled={loadingPrev}
                >
                    {loadingPrev ? '⏳' : '📋'} Reprendre mois précédent
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
                                    placeholder={cls.label}
                                />
                                <input
                                    className="form-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={amounts[cls.id] || ''}
                                    onChange={(e) => handleChange(cls.id, e.target.value)}
                                    placeholder={`Montant en ${CURRENCY}`}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="glass-card" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        TOTAL BUDGET
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                        {total.toLocaleString('fr-FR')} {CURRENCY}
                    </div>
                </div>

                <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={loading}
                    style={{ width: '100%', padding: '1rem' }}
                >
                    {loading ? '⏳ Enregistrement...' : '✓ Valider les enveloppes'}
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
