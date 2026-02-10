'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';
import { getMonths, getEnvelopes, getExpenses } from '@/services/firestore';
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

            // Load envelopes for selected month
            const envs = await getEnvelopes(user.uid, selectedMonth);
            if (envs.length === 0) {
                // No envelopes for this month, redirect to init
                if (selectedMonth === currentMonthId) {
                    router.push('/init-month');
                    return;
                }
                setEnvelopes([]);
                setLoading(false);
                return;
            }

            // Load expenses for selected month
            const expenses = await getExpenses(user.uid, selectedMonth);

            // Calculate stats
            const envelopeStats: EnvelopeWithStats[] = envs.map((env: Envelope) => {
                const envExpenses = expenses.filter((exp: Expense) => exp.envelopeName === env.name);
                const spent = envExpenses.reduce((sum: number, exp: Expense) => sum + exp.amount, 0);
                const remaining = env.initialAmount - spent;
                const percentage = env.initialAmount > 0
                    ? Math.max(0, Math.round((remaining / env.initialAmount) * 100))
                    : 0;
                return { ...env, spent, remaining, percentage };
            });

            // Sort by ENVELOPE_CLASSES order
            const classOrder: string[] = ENVELOPE_CLASSES.map((c) => c.id);
            envelopeStats.sort((a, b) => classOrder.indexOf(a.name) - classOrder.indexOf(b.name));

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

    const totalInitial = envelopes.reduce((s, e) => s + e.initialAmount, 0);
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
                            <div className="summary-label">Total Initial</div>
                            <div className="summary-value positive">{totalInitial.toLocaleString('fr-FR')} {CURRENCY}</div>
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
                                    <div className="envelope-amounts">
                                        <span>Initial: {env.initialAmount.toLocaleString('fr-FR')} {CURRENCY}</span>
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
