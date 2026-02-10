'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';
import { getMonths, getEnvelopes, getExpenses, getCumulativeEnvelopes } from '@/services/firestore';
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
    const [isCurrentMonth, setIsCurrentMonth] = useState(true);

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

                // Formule: Restant = (Budget Initial + Report) - Dépensé
                const remaining = (initial + carryOver) - spent;

                // Pourcentage basé sur (Budget Initial + Report)
                const totalAvailable = initial + carryOver;
                const percentage = totalAvailable > 0
                    ? Math.max(0, Math.round((remaining / totalAvailable) * 100))
                    : 0;

                return {
                    id: envelope?.id || cls.id, // Use actual envelope ID if available, otherwise class ID
                    name: cls.id,
                    initialAmount: initial,
                    spent,
                    carryOver,
                    remaining,
                    percentage
                };
            });

            // Sort by ENVELOPE_CLASSES order (already done by mapping ENVELOPE_CLASSES)
            // const classOrder: string[] = ENVELOPE_CLASSES.map((c) => c.id);
            // envelopeStats.sort((a, b) => classOrder.indexOf(a.name) - classOrder.indexOf(b.name));

            setEnvelopes(envelopeStats);
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

    const getEnvelopeInfo = (name: string) => {
        return ENVELOPE_CLASSES.find((c) => c.id === name) || { label: name, icon: '📦' };
    };

    const handleLogout = async () => {
        await logout();
        router.push('/login');
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
                            <div className="summary-label">Total Disponible</div>
                            <div className="summary-value positive">{totalAvailable.toLocaleString('fr-FR')} {CURRENCY}</div>
                            <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                Budget: {totalBudget.toLocaleString('fr-FR')}
                                {totalCarryOver !== 0 && ` | Report: ${totalCarryOver > 0 ? '+' : ''}${totalCarryOver.toLocaleString('fr-FR')}`}
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
                                <div key={env.id} className={`glass-card envelope-card status-${status}`}>
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
        </AppShell>
    );
}
