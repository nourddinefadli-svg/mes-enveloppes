'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';
import {
    getSubscriptions,
    addSubscription,
    deleteSubscription,
    toggleSubscriptionActive
} from '@/services/subscription';
import { ENVELOPE_CLASSES, CURRENCY } from '@/lib/constants';
import { Subscription } from '@/types/types';
import { Timestamp } from 'firebase/firestore';

export default function SubscriptionsPage() {
    const { user } = useAuth();
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [toast, setToast] = useState('');

    // Form state
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState(ENVELOPE_CLASSES[0].id);
    const [frequency, setFrequency] = useState<'monthly' | 'yearly'>('monthly');

    const loadData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await getSubscriptions(user.uid);
            setSubscriptions(data);
        } catch (err) {
            console.error('Failed to load subscriptions:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            showToast('Montant invalide.');
            return;
        }

        setAdding(true);
        try {
            await addSubscription(user.uid, {
                name: name.trim(),
                amount: amountNum,
                category: category as any,
                frequency,
                active: true,
                startDate: Timestamp.now(),
            });
            showToast('Abonnement ajouté !');
            setName('');
            setAmount('');
            loadData();
        } catch (err) {
            showToast('Erreur lors de l\'ajout.');
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!user || !confirm('Supprimer cet abonnement ?')) return;
        try {
            await deleteSubscription(user.uid, id);
            showToast('Abonnement supprimé.');
            loadData();
        } catch {
            showToast('Erreur de suppression.');
        }
    };

    const handleToggle = async (sub: Subscription) => {
        if (!user) return;
        try {
            await toggleSubscriptionActive(user.uid, sub.id, !sub.active);
            setSelectedMonthId(''); // Trigger refresh
            loadData();
        } catch {
            showToast('Erreur lors de la modification.');
        }
    };

    // Placeholder to satisfy the refresh logic if needed
    const [selectedMonthId, setSelectedMonthId] = useState('');

    const getCategoryInfo = (catId: string) => {
        return ENVELOPE_CLASSES.find(c => c.id === catId) || { label: catId, icon: '📦' };
    };

    return (
        <AppShell>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Mes Abonnements</h1>
                    <p className="page-subtitle">Gérez vos dépenses récurrentes</p>
                </div>
            </div>

            {/* Form */}
            <div className="glass-card" style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Ajouter un abonnement</h2>
                <form className="auth-form" onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">Nom</label>
                        <input
                            className="form-input"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="ex: Netflix"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Montant ({CURRENCY})</label>
                        <input
                            className="form-input"
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Catégorie</label>
                        <select
                            className="form-select"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                        >
                            {ENVELOPE_CLASSES.map(cls => (
                                <option key={cls.id} value={cls.id}>{cls.icon} {cls.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Fréquence</label>
                        <select
                            className="form-select"
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value as any)}
                        >
                            <option value="monthly">Mensuel</option>
                            <option value="yearly">Annuel</option>
                        </select>
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                        <button type="submit" className="btn btn-primary" disabled={adding} style={{ width: '100%' }}>
                            {adding ? '⏳ Ajout...' : '✓ Ajouter l\'abonnement'}
                        </button>
                    </div>
                </form>
            </div>

            {/* List */}
            {loading ? (
                <div className="loading-container">
                    <div className="spinner" />
                </div>
            ) : subscriptions.length === 0 ? (
                <div className="empty-state">
                    <p className="empty-text">Aucun abonnement enregistré.</p>
                </div>
            ) : (
                <div className="envelopes-grid">
                    {subscriptions.map(sub => {
                        const info = getCategoryInfo(sub.category);
                        return (
                            <div key={sub.id} className={`glass-card envelope-card ${!sub.active ? 'inactive' : ''}`} style={{ opacity: sub.active ? 1 : 0.6 }}>
                                <div className="envelope-header">
                                    <div className="subscription-title">
                                        <span className="envelope-icon">{info.icon}</span>
                                        <strong>{sub.name}</strong>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            className={`btn btn-sm ${sub.active ? 'btn-secondary' : 'btn-primary'}`}
                                            onClick={() => handleToggle(sub)}
                                        >
                                            {sub.active ? 'Désactiver' : 'Activer'}
                                        </button>
                                        <button
                                            className="btn btn-danger btn-sm btn-icon"
                                            onClick={() => handleDelete(sub.id)}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                <div className="envelope-remaining" style={{ fontSize: '1.5rem', margin: '1rem 0' }}>
                                    {sub.amount.toLocaleString('fr-FR')} {CURRENCY}
                                    <span style={{ fontSize: '0.8rem', opacity: 0.7, marginLeft: '0.5rem' }}>
                                        / {sub.frequency === 'monthly' ? 'mois' : 'an'}
                                    </span>
                                </div>
                                <div className="envelope-details">
                                    <span>Catégorie: {info.label}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {toast && <div className="toast">{toast}</div>}
        </AppShell>
    );
}
