'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';
import { addExpense } from '@/services/firestore';
import { ENVELOPE_CLASSES, getCurrentMonthId } from '@/lib/constants';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AddExpensePage() {
    const { user } = useAuth();
    const router = useRouter();
    const { t, isRTL } = useLanguage();
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
            showToast(t('addExpense.invalidAmount'));
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
            showToast(t('addExpense.success'));
            setTimeout(() => router.push('/dashboard'), 800);
        } catch {
            showToast(t('addExpense.error'));
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
                    <h1 className="page-title">{t('addExpense.title')}</h1>
                    <p className="page-subtitle">{t('addExpense.subtitle')}</p>
                </div>
            </div>

            <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="expense-date">📅 {t('addExpense.date')}</label>
                        <input
                            id="expense-date"
                            className="form-input"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                            style={{ textAlign: isRTL ? 'right' : 'left' }}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="expense-envelope">
                            {selectedEnvelope?.icon} {t('addExpense.category')}
                        </label>
                        <select
                            id="expense-envelope"
                            className="form-select"
                            value={envelopeName}
                            onChange={(e) => setEnvelopeName(e.target.value)}
                            style={{ textAlign: isRTL ? 'right' : 'left' }}
                        >
                            {ENVELOPE_CLASSES.map((cls) => (
                                <option key={cls.id} value={cls.id}>
                                    {cls.icon} {t(`envelopes.${cls.id}` as any)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="expense-amount">💵 {t('addExpense.amount')} ({t('common.currency')})</label>
                        <input
                            id="expense-amount"
                            className="form-input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={`${t('addExpense.amount')} (${t('common.currency')})`}
                            required
                            autoFocus
                            style={{ textAlign: isRTL ? 'right' : 'left' }}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="expense-note">📝 {t('addExpense.note')}</label>
                        <input
                            id="expense-note"
                            className="form-input"
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder={t('addExpense.notePlaceholder')}
                            style={{ textAlign: isRTL ? 'right' : 'left' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => router.back()}
                            style={{ flex: 1 }}
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                            style={{ flex: 2 }}
                        >
                            {loading ? `⏳ ${t('addExpense.adding')}` : `✓ ${t('addExpense.addBtn')}`}
                        </button>
                    </div>
                </form>
            </div>

            {toast && <div className="toast">{toast}</div>}
        </AppShell>
    );
}
