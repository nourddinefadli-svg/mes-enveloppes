'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';
import { addExpense } from '@/services/firestore';
import { ENVELOPE_CLASSES, CURRENCY, getCurrentMonthId } from '@/lib/constants';

export default function AddExpensePage() {
    const { user } = useAuth();
    const router = useRouter();
    const monthId = getCurrentMonthId();

    const today = new Date().toISOString().split('T')[0];
    const [envelopeName, setEnvelopeName] = useState<string>(ENVELOPE_CLASSES[0].id);
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(today);
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState('');

    const selectedEnvelope = ENVELOPE_CLASSES.find((c) => c.id === envelopeName);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            showToast('Montant invalide.');
            return;
        }

        setLoading(true);
        try {
            await addExpense(user.uid, monthId, {
                envelopeName,
                amount: amountNum,
                date: new Date(date),
                note: note.trim() || undefined,
            });
            showToast('Dépense ajoutée !');
            setTimeout(() => router.push('/dashboard'), 800);
        } catch {
            showToast('Erreur lors de l\'ajout.');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    return (
        <AppShell>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Ajouter une dépense</h1>
                    <p className="page-subtitle">Enregistrer une nouvelle dépense</p>
                </div>
            </div>

            <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="expense-date">📅 Date</label>
                        <input
                            id="expense-date"
                            className="form-input"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="expense-envelope">
                            {selectedEnvelope?.icon} Classe
                        </label>
                        <select
                            id="expense-envelope"
                            className="form-select"
                            value={envelopeName}
                            onChange={(e) => setEnvelopeName(e.target.value)}
                        >
                            {ENVELOPE_CLASSES.map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                    {cls.icon} {cls.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="expense-amount">💵 Montant ({CURRENCY})</label>
                        <input
                            id="expense-amount"
                            className="form-input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={`Montant en ${CURRENCY}`}
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="expense-note">📝 Note (optionnelle)</label>
                        <input
                            id="expense-note"
                            className="form-input"
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Description de la dépense..."
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => router.back()}
                            style={{ flex: 1 }}
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                            style={{ flex: 2 }}
                        >
                            {loading ? '⏳ Ajout...' : '✓ Ajouter la dépense'}
                        </button>
                    </div>
                </form>
            </div>

            {toast && <div className="toast">{toast}</div>}
        </AppShell>
    );
}
