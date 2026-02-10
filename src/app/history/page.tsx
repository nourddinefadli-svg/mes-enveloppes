'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';
import { getExpenses, getMonths, deleteExpense, updateExpense } from '@/services/firestore';
import { ENVELOPE_CLASSES, CURRENCY, getCurrentMonthId, formatMonthLabel } from '@/lib/constants';
import { Expense } from '@/types/types';

export default function HistoryPage() {
    const { user } = useAuth();
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
        if (!confirm('Supprimer cette dépense ?')) return;
        try {
            await deleteExpense(user.uid, selectedMonth, expenseId);
            showToast('Dépense supprimée.');
            loadData();
        } catch {
            showToast('Erreur de suppression.');
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
            showToast('Montant invalide.');
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
            showToast('Dépense modifiée.');
            setEditingExpense(null);
            loadData();
        } catch {
            showToast('Erreur de modification.');
        } finally {
            setSaving(false);
        }
    };

    const getEnvelopeInfo = (name: string) => {
        return ENVELOPE_CLASSES.find((c) => c.id === name) || { label: name, icon: '📦' };
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
                    <h1 className="page-title">Historique</h1>
                    <p className="page-subtitle">
                        {expenses.length} dépense{expenses.length !== 1 ? 's' : ''} — {formatMonthLabel(selectedMonth)}
                    </p>
                </div>
            </div>

            <div className="filter-bar">
                <select
                    className="form-select"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    style={{ minWidth: '180px' }}
                >
                    {availableMonths.map((m) => (
                        <option key={m} value={m}>{formatMonthLabel(m)}</option>
                    ))}
                </select>
                <select
                    className="form-select"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    style={{ minWidth: '150px' }}
                >
                    <option value="">Toutes les classes</option>
                    {ENVELOPE_CLASSES.map((cls) => (
                        <option key={cls.id} value={cls.id}>{cls.icon} {cls.label}</option>
                    ))}
                </select>
                {!isCurrentMonth && (
                    <span className="readonly-badge">🔒 Lecture seule</span>
                )}
            </div>

            {loading ? (
                <div className="loading-container" style={{ minHeight: '30vh' }}>
                    <div className="spinner" />
                </div>
            ) : expenses.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <p className="empty-text">Aucune dépense trouvée.</p>
                </div>
            ) : (
                <div className="expense-list">
                    {expenses.map((exp) => {
                        const info = getEnvelopeInfo(exp.envelopeName);
                        return (
                            <div key={exp.id} className="glass-card expense-item">
                                <div className="expense-info">
                                    <div className="expense-category">
                                        {info.icon} {info.label}
                                    </div>
                                    {exp.note && <div className="expense-note">{exp.note}</div>}
                                    <div className="expense-date">{formatDate(exp.date)}</div>
                                </div>
                                <div className="expense-amount">
                                    -{exp.amount.toLocaleString('fr-FR')} {CURRENCY}
                                </div>
                                {isCurrentMonth && (
                                    <div className="expense-actions">
                                        <button
                                            className="btn btn-secondary btn-icon"
                                            onClick={() => openEdit(exp)}
                                            title="Modifier"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="btn btn-danger btn-icon"
                                            onClick={() => handleDelete(exp.id)}
                                            title="Supprimer"
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
                        <div className="modal-header">
                            <h2 className="modal-title">Modifier la dépense</h2>
                            <button
                                className="btn btn-secondary btn-icon"
                                onClick={() => setEditingExpense(null)}
                            >
                                ✕
                            </button>
                        </div>
                        <form className="auth-form" onSubmit={handleEditSubmit}>
                            <div className="form-group">
                                <label className="form-label">📅 Date</label>
                                <input
                                    className="form-input"
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">📂 Classe</label>
                                <select
                                    className="form-select"
                                    value={editEnvelope}
                                    onChange={(e) => setEditEnvelope(e.target.value)}
                                >
                                    {ENVELOPE_CLASSES.map((cls) => (
                                        <option key={cls.id} value={cls.id}>
                                            {cls.icon} {cls.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">💵 Montant ({CURRENCY})</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">📝 Note</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={editNote}
                                    onChange={(e) => setEditNote(e.target.value)}
                                    placeholder="Optionnelle"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setEditingExpense(null)}
                                    style={{ flex: 1 }}
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={saving}
                                    style={{ flex: 2 }}
                                >
                                    {saving ? '⏳' : '✓ Enregistrer'}
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
