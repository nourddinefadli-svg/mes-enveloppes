'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';
import { getMonths, getEnvelopes, getExpenses, getCumulativeEnvelopes, addExpense, getTotalSavings, updateEnvelopeName } from '@/services/firestore';
import { ENVELOPE_CLASSES, CURRENCY, getCurrentMonthId, SPIRITUAL_QUOTES } from '@/lib/constants';
import { EnvelopeWithStats, Envelope, Expense } from '@/types/types';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

function getStatus(percentage: number): string {
    if (percentage <= 0) return 'exhausted';
    if (percentage < 10) return 'critical';
    if (percentage < 30) return 'warning';
    return 'normal';
}

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const { t, formatMonth, formatEnvelopeName, isRTL } = useLanguage();
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthId());
    const [availableMonths, setAvailableMonths] = useState<string[]>([]);
    const [envelopes, setEnvelopes] = useState<EnvelopeWithStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalSavings, setTotalSavings] = useState<{ real: number; potential: number }>({ real: 0, potential: 0 });
    const [randomQuote, setRandomQuote] = useState('');
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
                    ? Math.floor((remaining / totalAvailable) * 100)
                    : 0;

                return {
                    id: envelope?.id || cls.id,
                    name: cls.id,
                    displayName: formatEnvelopeName(cls.id, data?.displayName),
                    initialAmount: initial,
                    spent,
                    carryOver,
                    remaining,
                    percentage,
                    adjustment
                };
            });

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
    }, [user, selectedMonth, currentMonthId, router, t]);

    useEffect(() => {
        loadData();
        // Pick random quote once per session
        const randomIndex = Math.floor(Math.random() * SPIRITUAL_QUOTES.length);
        setRandomQuote(SPIRITUAL_QUOTES[randomIndex]);
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
    const nextMonthId = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
    const nextMonthFormatted = formatMonth(nextMonthId);

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
            showToast(t('common.error'));
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
            showToast(t('common.success'));
            setQuickAddEnvelope(null);
            setQuickAmount('');
            setQuickNote('');
            loadData();
        } catch {
            showToast(t('common.error'));
        } finally {
            setQuickSaving(false);
        }
    };

    return (
        <AppShell>
            {randomQuote && (
                <div className="spiritual-header glass-card">
                    <p className="arabic-text">{randomQuote}</p>
                </div>
            )}
            <div className="page-header">
                <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    <h1 className="page-title">{t('dashboard.title')}</h1>
                    <p className="page-subtitle">{formatMonth(selectedMonth)}</p>
                </div>
                <div className="month-selector" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <select
                        className="form-select"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        style={{ textAlign: isRTL ? 'right' : 'left' }}
                    >
                        {availableMonths.map((m) => (
                            <option key={m} value={m}>{formatMonth(m)}</option>
                        ))}
                    </select>
                    {!isCurrentMonth && (
                        <span className="readonly-badge">🔒 {t('history.readOnly')}</span>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                        {t('common.logout')}
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
                    <p className="empty-text">{t('dashboard.noEnvelopes')}</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="summary-grid">
                        <div className="glass-card summary-card" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            <div className="summary-label">{t('dashboard.nextMonth')}</div>
                            <div className={`summary-value ${daysRemaining < 15 ? 'positive' : 'spending'}`} style={{ direction: 'ltr' }}>
                                {daysRemaining.toLocaleString('fr-FR')} {t('dashboard.daysRemaining')}
                            </div>
                            <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                {t('dashboard.beforeFirst')} {nextMonthFormatted}
                            </div>
                        </div>
                        <div className="glass-card summary-card" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            <div className="summary-label">{t('dashboard.totalSavings')}</div>
                            <div className="summary-value positive" style={{ direction: 'ltr' }}>
                                {totalSavings.real.toLocaleString('fr-FR')} {t('common.currency')}
                            </div>
                            <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                {isCurrentMonth ? (
                                    <>{t('dashboard.potentialSavings')} : <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold', direction: 'ltr', display: 'inline-block' }}>{totalSavings.potential.toLocaleString('fr-FR')} {t('common.currency')}</span></>
                                ) : (
                                    t('dashboard.pastMonthsCumul')
                                )}
                            </div>
                        </div>
                        <div className="glass-card summary-card" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            <div className="summary-label">{t('dashboard.totalSpent')}</div>
                            <div className="summary-value spending" style={{ direction: 'ltr' }}>{totalSpent.toLocaleString('fr-FR')} {t('common.currency')}</div>
                        </div>
                        <div className="glass-card summary-card" style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            <div className="summary-label">{t('dashboard.totalRemaining')}</div>
                            <div className="summary-value remaining" style={{ direction: 'ltr' }}>{totalRemaining.toLocaleString('fr-FR')} {t('common.currency')}</div>
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
                                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                                >
                                    <div className="envelope-header" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                                        <div className="envelope-name" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                                            <span className="envelope-icon">{info.icon}</span>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: 700 }}>{env.displayName}</span>
                                                <span style={{ fontSize: '0.65rem', opacity: 0.5, textTransform: 'uppercase' }}>{t(`envelopes.${env.name}` as any)}</span>
                                            </div>
                                        </div>
                                        <span className={`envelope-percentage ${status}`} style={{ direction: 'ltr' }}>
                                            {env.percentage.toLocaleString('fr-FR')}% <span style={{ fontSize: '0.7rem', fontWeight: 500, opacity: 0.7 }}>{t('dashboard.remaining')}</span>
                                        </span>
                                    </div>
                                    <div className={`envelope-remaining ${env.remaining < 0 ? 'negative' : ''}`} style={{ direction: 'ltr' }}>
                                        {env.remaining.toLocaleString('fr-FR')} {t('common.currency')}
                                    </div>
                                    <div className="envelope-details" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                                        {env.carryOver !== 0 && (
                                            <span style={{ color: env.carryOver > 0 ? '#4ade80' : '#f87171', direction: 'ltr' }}>
                                                {env.carryOver > 0 ? '+' : ''}{env.carryOver.toLocaleString('fr-FR')} ({t('dashboard.carryOver')})
                                            </span>
                                        )}
                                        {env.spent > 0 && (
                                            <span style={{ color: 'var(--danger)', direction: 'ltr' }}>{t('dashboard.spent')}: {env.spent.toLocaleString('fr-FR')} {t('common.currency')}</span>
                                        )}
                                    </div>
                                    <div className="progress-bar">
                                        <div
                                            className={`progress-fill ${status}`}
                                            style={{
                                                width: `${Math.max(0, env.percentage)}%`,
                                                right: isRTL ? 0 : 'auto',
                                                left: isRTL ? 'auto' : 0
                                            }}
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
                        <div className="modal-header" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                            <h2 className="modal-title">
                                {getEnvelopeInfo(quickAddEnvelope).icon} {envelopes.find(e => e.name === quickAddEnvelope)?.displayName || t(`envelopes.${quickAddEnvelope}` as any)}
                            </h2>
                            <button
                                className="btn btn-secondary btn-icon"
                                onClick={() => setQuickAddEnvelope(null)}
                            >
                                ✕
                            </button>
                        </div>
                        <p style={{ opacity: 0.7, marginBottom: '1rem', fontSize: '0.9rem', textAlign: isRTL ? 'right' : 'left' }}>{t('dashboard.quickAdd')}</p>
                        <form className="auth-form" onSubmit={handleQuickAdd}>
                            <div className="form-group">
                                <label className="form-label" style={{ textAlign: isRTL ? 'right' : 'left', display: 'block' }}>📅 {t('dashboard.date')}</label>
                                <input
                                    className="form-input"
                                    type="date"
                                    value={quickDate}
                                    onChange={(e) => setQuickDate(e.target.value)}
                                    required
                                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ textAlign: isRTL ? 'right' : 'left', display: 'block' }}>💵 {t('dashboard.amount')} ({t('common.currency')})</label>
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
                                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ textAlign: isRTL ? 'right' : 'left', display: 'block' }}>📝 {t('dashboard.note')}</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={quickNote}
                                    onChange={(e) => setQuickNote(e.target.value)}
                                    placeholder={t('dashboard.note')}
                                    style={{ textAlign: isRTL ? 'right' : 'left' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setQuickAddEnvelope(null)}
                                    style={{ flex: 1 }}
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={quickSaving}
                                    style={{ flex: 2 }}
                                >
                                    {quickSaving ? '⏳' : `✓ ${t('common.add')}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {toast && <div className="toast">{toast}</div>}

            <style jsx>{`
                .toast {
                    position: fixed;
                    bottom: 6rem;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--accent-primary);
                    color: white;
                    padding: 0.8rem 1.5rem;
                    border-radius: var(--radius-lg);
                    z-index: 1000;
                    animation: slideUp 0.3s ease;
                }
            `}</style>
        </AppShell>
    );
}
