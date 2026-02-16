'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';
import { getExpenses, getMonths, deleteExpense, updateExpense } from '@/services/firestore';
import { ENVELOPE_CLASSES, getCurrentMonthId } from '@/lib/constants';
import { Expense } from '@/types/types';
import { useLanguage } from '@/contexts/LanguageContext';

export default function HistoryPage() {
    const { user } = useAuth();
    const { t, isRTL, formatMonth } = useLanguage();
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthId());
    const [availableMonths, setAvailableMonths] = useState<string[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [filter, setFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState('');
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editNote, setEditNote] = useState('');
    const [editEnvelope, setEditEnvelope] = useState('');
    const [editDate, setEditDate] = useState('');
    const [saving, setSaving] = useState(false);

    const currentMonthId = getCurrentMonthId();
    const isCurrentMonth = selectedMonth === currentMonthId;

    const loadData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const months = await getMonths(user.uid);
            const monthIds = months.map((m) => m.id);
            if (!monthIds.includes(currentMonthId)) {
                monthIds.unshift(currentMonthId);
            }
            monthIds.sort().reverse();
            setAvailableMonths(monthIds);

            const exps = await getExpenses(user.uid, selectedMonth, filter || undefined);
            setExpenses(exps);
        } catch (err) {
            console.error('Failed to load history:', err);
        } finally {
            setLoading(false);
        }
    }, [user, selectedMonth, filter, currentMonthId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const handleDelete = async (expenseId: string) => {
        if (!user) return;
        if (!confirm(t('history.confirmDelete'))) return;
        try {
            await deleteExpense(user.uid, selectedMonth, expenseId);
            showToast(t('history.successDelete'));
            loadData();
        } catch {
            showToast(t('history.errorDelete'));
        }
    };

    const openEdit = (exp: Expense) => {
        setEditingExpense(exp);
        setEditAmount(String(exp.amount));
        setEditNote(exp.note || '');
        setEditEnvelope(exp.envelopeName);
        const d = exp.date.toDate();
        setEditDate(d.toISOString().split('T')[0]);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !editingExpense) return;
        const amountNum = parseFloat(editAmount);
        if (isNaN(amountNum) || amountNum <= 0) {
            showToast(t('common.error'));
            return;
        }
        setSaving(true);
        try {
            await updateExpense(user.uid, selectedMonth, editingExpense.id, {
                amount: amountNum,
                note: editNote.trim(),
                envelopeName: editEnvelope,
                date: new Date(editDate),
            });
            showToast(t('history.successUpdate'));
            setEditingExpense(null);
            loadData();
        } catch {
            showToast(t('history.errorUpdate'));
        } finally {
            setSaving(false);
        }
    };

    const getEnvelopeInfo = (name: string) => {
        const cls = ENVELOPE_CLASSES.find((c) => c.id === name);
        if (cls) {
            return { label: t(`envelopes.${cls.id}` as any), icon: cls.icon };
        }
        return { label: name, icon: '📦' };
    };

    const formatDate = (timestamp: { toDate: () => Date }) => {
        const d = timestamp.toDate();
        return d.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    return (
        <AppShell>
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('history.title')}</h1>
                    <p className="page-subtitle">
                        {expenses.length} {t('history.expensesCount')} — {formatMonth(selectedMonth)}
                    </p>
                </div>
            </div>

            <div className="filter-bar" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <select
                    className="form-select"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    style={{ minWidth: '180px', textAlign: isRTL ? 'right' : 'left' }}
                >
                    {availableMonths.map((m) => (
                        <option key={m} value={m}>{formatMonth(m)}</option>
                    ))}
                </select>
                <select
                    className="form-select"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    style={{ minWidth: '150px', textAlign: isRTL ? 'right' : 'left' }}
                >
                    <option value="">{t('history.allCategories')}</option>
                    {ENVELOPE_CLASSES.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                            {cls.icon} {t(`envelopes.${cls.id}` as any)}
                        </option>
                    ))}
                </select>
                {!isCurrentMonth && (
                    <span className="readonly-badge">🔒 {t('history.readOnly')}</span>
                )}
            </div>

            {loading ? (
                <div className="loading-container" style={{ minHeight: '30vh' }}>
                    <div className="spinner" />
                </div>
            ) : expenses.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <p className="empty-text">{t('history.noExpenses')}</p>
                </div>
            ) : (
                <div className="expense-list">
                    {expenses.map((exp) => {
                        const info = getEnvelopeInfo(exp.envelopeName);
                        return (
                            <div key={exp.id} className="glass-card expense-item">
                                <div className="expense-info">
                                    <div className="expense-category">
                                        <span>{info.icon}</span> <span>{info.label}</span>
                                    </div>
                                    {exp.note && <div className="expense-note">{exp.note}</div>}
                                    <div className="expense-date">{formatDate(exp.date)}</div>
                                </div>
                                <div className="expense-amount">
                                    -{exp.amount.toLocaleString('fr-FR')} {t('common.currency')}
                                </div>
                                {isCurrentMonth && (
                                    <div className="expense-actions">
                                        <button
                                            className="btn btn-secondary btn-icon"
                                            onClick={() => openEdit(exp)}
                                            title={t('common.edit')}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="btn btn-danger btn-icon"
                                            onClick={() => handleDelete(exp.id)}
                                            title={t('common.delete')}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Edit Modal */}
            {editingExpense && (
                <div className="modal-overlay" onClick={() => setEditingExpense(null)}>
                    <div className="glass-card modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                            <h2 className="modal-title">{t('history.editTitle')}</h2>
                            <button
                                className="btn btn-secondary btn-icon"
                                onClick={() => setEditingExpense(null)}
                            >
                                ✕
                            </button>
                        </div>
                        <form className="auth-form" onSubmit={handleEditSubmit}>
                            <div className="form-group">
                                <label className="form-label">📅 {t('history.date')}</label>
                                <input
                                    className="form-input"
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                    required
                                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">📂 {t('history.category')}</label>
                                <select
                                    className="form-select"
                                    value={editEnvelope}
                                    onChange={(e) => setEditEnvelope(e.target.value)}
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
                                <label className="form-label">💵 {t('history.amount')} ({t('common.currency')})</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    required
                                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">📝 {t('history.note')}</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={editNote}
                                    onChange={(e) => setEditNote(e.target.value)}
                                    placeholder={t('history.optional')}
                                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setEditingExpense(null)}
                                    style={{ flex: 1 }}
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={saving}
                                    style={{ flex: 2 }}
                                >
                                    {saving ? '⏳' : `✓ ${t('common.save')}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {toast && <div className="toast">{toast}</div>}
        </AppShell>
    );
}
