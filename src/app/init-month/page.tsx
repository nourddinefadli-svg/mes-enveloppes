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
                const existing: Record<string, number> = {};
                for (const env of envs) {
                    existing[env.name] = env.initialAmount;
                }
                setAmounts(existing);
            } else {
                // Default all to 0
                const defaults: Record<string, number> = {};
                for (const cls of ENVELOPE_CLASSES) {
                    defaults[cls.id] = 0;
                }
                setAmounts(defaults);
            }
        }
        checkExisting();
    }, [user, monthId]);

    const handleChange = (id: string, value: string) => {
        const num = parseFloat(value) || 0;
        setAmounts((prev) => ({ ...prev, [id]: num }));
    };

    const handleLoadPrevious = async () => {
        if (!user) return;
        setLoadingPrev(true);
        try {
            const prev = await getEnvelopesForPreviousMonth(user.uid, monthId);
            if (prev) {
                setAmounts(prev);
                showToast('Montants du mois précédent chargés !');
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
            await initializeEnvelopes(user.uid, monthId, amounts as Record<EnvelopeClassId, number>);
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
                                <div className="init-label">{cls.label}</div>
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
        </AppShell>
    );
}
