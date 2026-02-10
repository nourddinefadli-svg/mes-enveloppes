'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';
import { getMonths, getEnvelopes, getExpenses, getCumulativeEnvelopes, addExpense, getTotalSavings } from '@/services/firestore';
import { ENVELOPE_CLASSES, CURRENCY, getCurrentMonthId, formatMonthLabel } from '@/lib/constants';
import { EnvelopeWithStats, Envelope, Expense } from '@/types/types';
import { useRouter } from 'next/navigation';

function getStatus(percentage: number): string {
    if (percentage <= 0) return 'exhausted';
    if (percentage < 10) return 'critical';
    if (percentage < 30) return 'warning';
    return 'normal';
}

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthId());
    const [availableMonths, setAvailableMonths] = useState<string[]>([]);
    const [envelopes, setEnvelopes] = useState<EnvelopeWithStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalSavings, setTotalSavings] = useState(0);
    const [isCurrentMonth, setIsCurrentMonth] = useState(true);

    // Quick Add Modal State
    const [quickAddEnvelope, setQuickAddEnvelope] = useState<string | null>(null);
    const [quickAmount, setQuickAmount] = useState('');
    const [quickDate, setQuickDate] = useState(new Date().toISOString().split('T')[0]);
    const [quickNote, setQuickNote] = useState('');
    const [quickSaving, setQuickSaving] = useState(false);
    const [toast, setToast] = useState('');

    const currentMonthId = getCurrentMonthId();

    const loadData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Load available months
            const months = await getMonths(user.uid);
            const monthIds = months.map((m) => m.id);
            if (!monthIds.includes(currentMonthId)) {
                monthIds.unshift(currentMonthId);
            }
            monthIds.sort().reverse();
            setAvailableMonths(monthIds);

            // Load cumulative stats for selected month
            const cumulativeData = await getCumulativeEnvelopes(user.uid, selectedMonth);

            // Si aucune enveloppe n'existe pour ce mois, on vérifie si on doit rediriger
            const envs = await getEnvelopes(user.uid, selectedMonth);
            if (envs.length === 0) {
                if (selectedMonth === currentMonthId) {
                    router.push('/init-month');
                    return;
                }
                setEnvelopes([]);
                setLoading(false);
                return;
            }

            // Calculate stats based on cumulative data
            const envelopeStats: EnvelopeWithStats[] = ENVELOPE_CLASSES.map((cls) => {
                const data = cumulativeData[cls.id];
                const envelope = envs.find(e => e.name === cls.id);

                const initial = data?.initial || 0;
                const spent = data?.spent || 0;
                const carryOver = data?.carryOver || 0;
                const adjustment = data?.adjustment || 0;

                // On affiche le dépassement (négatif) pour les enveloppes normales
                // Mais pour l'épargne, on affiche le montant après déduction
                const isSavings = cls.id === 'epargne';
                const remaining = isSavings
                    ? (initial + carryOver + adjustment) - spent
                    : (initial + carryOver) - spent;

                // Pourcentage basé sur le montant disponible initial (budget + report)
                const totalAvailable = initial + carryOver;
                const percentage = totalAvailable > 0
                    ? Math.round((remaining / totalAvailable) * 100)
                    : 0;

                return {
                    id: envelope?.id || cls.id,
                    name: cls.id,
                    initialAmount: initial,
                    spent,
                    carryOver,
                    remaining,
                    percentage,
                    adjustment
                };
            });

            // Sort by ENVELOPE_CLASSES order (already done by mapping ENVELOPE_CLASSES)
            // const classOrder: string[] = ENVELOPE_CLASSES.map((c) => c.id);
            // envelopeStats.sort((a, b) => classOrder.indexOf(a.name) - classOrder.indexOf(b.name));

            setEnvelopes(envelopeStats);
            // Load total savings (all months)
            const totalS = await getTotalSavings(user.uid);
            setTotalSavings(totalS);

            setIsCurrentMonth(selectedMonth === currentMonthId);
        } catch (err) {
            console.error('Failed to load dashboard:', err);
        } finally {
            setLoading(false);
        }
    }, [user, selectedMonth, currentMonthId, router]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const totalBudget = envelopes.reduce((s, e) => s + e.initialAmount, 0);
    const totalCarryOver = envelopes.reduce((s, e) => s + e.carryOver, 0);
    const totalAvailable = totalBudget + totalCarryOver;
    const totalSpent = envelopes.reduce((s, e) => s + e.spent, 0);
    const totalRemaining = envelopes.reduce((s, e) => s + e.remaining, 0);

    // Countdown logic
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const diffTime = nextMonth.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const nextMonthLabel = formatMonthLabel(`${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`);

    const getEnvelopeInfo = (name: string) => {
        return ENVELOPE_CLASSES.find((c) => c.id === name) || { label: name, icon: '📦' };
    };

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const handleQuickAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !quickAddEnvelope) return;

        const amountNum = parseFloat(quickAmount);
        if (isNaN(amountNum) || amountNum <= 0) {
            showToast('Montant invalide.');
            return;
        }

        setQuickSaving(true);
        try {
            await addExpense(user.uid, selectedMonth, {
                envelopeName: quickAddEnvelope,
                amount: amountNum,
                date: new Date(quickDate),
                note: quickNote.trim() || undefined,
            });
            showToast('Dépense ajoutée !');
            setQuickAddEnvelope(null);
            setQuickAmount('');
            setQuickNote('');
            loadData();
        } catch {
            showToast('Erreur lors de l\'ajout.');
        } finally {
            setQuickSaving(false);
        }
    };

    return (
        <AppShell>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">{formatMonthLabel(selectedMonth)}</p>
                </div>
                <div className="month-selector">
                    <select
                        className="form-select"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                    >
                        {availableMonths.map((m) => (
                            <option key={m} value={m}>{formatMonthLabel(m)}</option>
                        ))}
                    </select>
                    {!isCurrentMonth && (
                        <span className="readonly-badge">🔒 Lecture seule</span>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                        Déconnexion
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-container" style={{ minHeight: '50vh' }}>
                    <div className="spinner" />
                </div>
            ) : envelopes.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <p className="empty-text">Aucune enveloppe pour ce mois.</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="summary-grid">
                        <div className="glass-card summary-card">
                            <div className="summary-label">Prochain Mois (restant)</div>
                            <div className={`summary-value ${daysRemaining < 15 ? 'positive' : 'spending'}`}>
                                {daysRemaining} Jours
                            </div>
                            <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                Avant le 1er {nextMonthLabel}
                            </div>
                        </div>
                        <div className="glass-card summary-card">
                            <div className="summary-label">Total d'Épargne</div>
                            <div className="summary-value positive">{totalSavings.toLocaleString('fr-FR')} {CURRENCY}</div>
                            <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                Cumul des anciens mois
                            </div>
                        </div>
                        <div className="glass-card summary-card">
                            <div className="summary-label">Total Dépensé</div>
                            <div className="summary-value spending">{totalSpent.toLocaleString('fr-FR')} {CURRENCY}</div>
                        </div>
                        <div className="glass-card summary-card">
                            <div className="summary-label">Total Restant</div>
                            <div className="summary-value remaining">{totalRemaining.toLocaleString('fr-FR')} {CURRENCY}</div>
                        </div>
                    </div>

                    {/* Envelope Cards */}
                    <div className="envelopes-grid">
                        {envelopes.map((env) => {
                            const info = getEnvelopeInfo(env.name);
                            const status = getStatus(env.percentage);
                            return (
                                <div
                                    key={env.id}
                                    className={`glass-card envelope-card status-${status} clickable`}
                                    onClick={() => isCurrentMonth && setQuickAddEnvelope(env.name)}
                                >
                                    <div className="envelope-header">
                                        <div className="envelope-name">
                                            <span className="envelope-icon">{info.icon}</span>
                                            {info.label}
                                        </div>
                                        <span className={`envelope-percentage ${status}`}>
                                            {env.percentage}%
                                        </span>
                                    </div>
                                    <div className={`envelope-remaining ${env.remaining < 0 ? 'negative' : ''}`}>
                                        {env.remaining.toLocaleString('fr-FR')} {CURRENCY}
                                    </div>
                                    <div className="envelope-details">
                                        <span>Initial: {env.initialAmount.toLocaleString('fr-FR')} {CURRENCY}</span>
                                        {env.carryOver !== 0 && (
                                            <span style={{ color: env.carryOver > 0 ? '#4ade80' : '#f87171', marginLeft: '0.5rem' }}>
                                                {env.carryOver > 0 ? '+' : ''}{env.carryOver.toLocaleString('fr-FR')} (Report)
                                            </span>
                                        )}
                                        <span>Dépensé: {env.spent.toLocaleString('fr-FR')} {CURRENCY}</span>
                                    </div>
                                    <div className="progress-bar">
                                        <div
                                            className={`progress-fill ${status}`}
                                            style={{ width: `${Math.max(0, env.percentage)}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Quick Add Modal */}
            {quickAddEnvelope && (
                <div className="modal-overlay" onClick={() => setQuickAddEnvelope(null)}>
                    <div className="glass-card modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {getEnvelopeInfo(quickAddEnvelope).icon} {getEnvelopeInfo(quickAddEnvelope).label}
                            </h2>
                            <button
                                className="btn btn-secondary btn-icon"
                                onClick={() => setQuickAddEnvelope(null)}
                            >
                                ✕
                            </button>
                        </div>
                        <p style={{ opacity: 0.7, marginBottom: '1rem', fontSize: '0.9rem' }}>Ajouter une dépense rapide</p>
                        <form className="auth-form" onSubmit={handleQuickAdd}>
                            <div className="form-group">
                                <label className="form-label">📅 Date</label>
                                <input
                                    className="form-input"
                                    type="date"
                                    value={quickDate}
                                    onChange={(e) => setQuickDate(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">💵 Montant ({CURRENCY})</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={quickAmount}
                                    onChange={(e) => setQuickAmount(e.target.value)}
                                    placeholder="0.00"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">📝 Note (optionnelle)</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={quickNote}
                                    onChange={(e) => setQuickNote(e.target.value)}
                                    placeholder="Ex: Baguette..."
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setQuickAddEnvelope(null)}
                                    style={{ flex: 1 }}
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={quickSaving}
                                    style={{ flex: 2 }}
                                >
                                    {quickSaving ? '⏳' : '✓ Ajouter'}
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
