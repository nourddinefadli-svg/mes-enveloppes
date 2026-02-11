'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';
import { getCouchonnes, saveCouchonne, deleteCouchonne } from '@/services/firestore';
import { Couchonne } from '@/types/types';
import { CURRENCY } from '@/lib/constants';

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 2, 1];

export default function CouchonnePage() {
    const { user } = useAuth();
    const [couchonnes, setCouchonnes] = useState<Couchonne[]>([]);
    const [activeCouch, setActiveCouch] = useState<Couchonne | null>(null);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // Creation state
    const [targetAmount, setTargetAmount] = useState('10000');
    const [isSaving, setIsSaving] = useState(false);

    const loadData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await getCouchonnes(user.uid);
            setCouchonnes(data);
            if (data.length > 0) {
                setActiveCouch(data[0]);
            }
        } catch (error) {
            console.error('Error loading Couchonnes:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCreate = async () => {
        if (!user) return;
        const target = parseFloat(targetAmount);
        if (isNaN(target) || target <= 0) return;

        setIsSaving(true);
        try {
            // Génération des billets
            let remaining = target;
            const generated: number[] = [];
            while (remaining > 0) {
                const available = DENOMINATIONS.filter(d => d <= remaining);
                if (available.length === 0) break;
                // On privilégie un mélange
                const randIndex = Math.floor(Math.random() * Math.min(available.length, 3));
                const picked = available[randIndex];
                generated.push(picked);
                remaining -= picked;
            }

            const newCouch: Omit<Couchonne, 'createdAt'> = {
                id: crypto.randomUUID(),
                targetAmount: target,
                denominations: generated.sort((a, b) => b - a),
                checkedIndices: []
            };

            await saveCouchonne(user.uid, newCouch);
            setIsCreating(false);
            loadData();
        } catch (error) {
            console.error('Error creating Couchonne:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleBubble = async (index: number) => {
        if (!user || !activeCouch) return;

        const newIndices = activeCouch.checkedIndices.includes(index)
            ? activeCouch.checkedIndices.filter(i => i !== index)
            : [...activeCouch.checkedIndices, index];

        const updatedCouch = { ...activeCouch, checkedIndices: newIndices };
        setActiveCouch(updatedCouch); // Optimistic UI

        try {
            await saveCouchonne(user.uid, updatedCouch);
        } catch (error) {
            console.error('Error updating bubble:', error);
            loadData(); // Revert on error
        }
    };

    const handleDelete = async (id: string) => {
        if (!user || !confirm('Supprimer cette Couchonne définitivement ?')) return;
        try {
            await deleteCouchonne(user.uid, id);
            if (activeCouch?.id === id) setActiveCouch(null);
            loadData();
        } catch (error) {
            console.error('Error deleting Couchonne:', error);
        }
    };

    const currentTotal = activeCouch ? activeCouch.checkedIndices.reduce((sum, idx) => sum + activeCouch.denominations[idx], 0) : 0;
    const progress = activeCouch ? (currentTotal / activeCouch.targetAmount) * 100 : 0;

    return (
        <AppShell>
            <div className="page-header">
                <div>
                    <h1 className="page-title">La Couchonne 🐷</h1>
                    <p className="page-subtitle">Petites économies, grands projets</p>
                </div>
                {!activeCouch && !loading && (
                    <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
                        🎯 Nouveau Défi
                    </button>
                )}
            </div>

            {loading ? (
                <div className="loading-container"><div className="spinner" /></div>
            ) : isCreating ? (
                <div className="glass-card" style={{ maxWidth: '500px', margin: '2rem auto', padding: '2rem' }}>
                    <h2 style={{ marginBottom: '1.5rem' }}>Démarrer un défi</h2>
                    <div className="form-group">
                        <label className="form-label">Montant souhaité ({CURRENCY})</label>
                        <input
                            className="form-input"
                            type="number"
                            value={targetAmount}
                            onChange={(e) => setTargetAmount(e.target.value)}
                            placeholder="ex: 10000"
                        />
                        <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.5rem' }}>
                            L'application va générer une liste de billets à cocher pour atteindre cet objectif.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                        <button className="btn btn-secondary" onClick={() => setIsCreating(false)}>Annuler</button>
                        <button className="btn btn-primary" onClick={handleCreate} disabled={isSaving}>
                            {isSaving ? 'Génération...' : 'Lancer le défi !'}
                        </button>
                    </div>
                </div>
            ) : !activeCouch ? (
                <div className="empty-state">
                    <div className="empty-icon">🐷</div>
                    <p className="empty-text">Vous n'avez pas encore de Couchonne active.</p>
                    <button className="btn btn-primary" onClick={() => setIsCreating(true)} style={{ marginTop: '1rem' }}>
                        Créer ma première Couchonne
                    </button>
                </div>
            ) : (
                <div className="couchonne-container">
                    <div className="summary-grid" style={{ marginBottom: '2rem' }}>
                        <div className="glass-card summary-card">
                            <div className="summary-label">Objectif</div>
                            <div className="summary-value" style={{ color: 'var(--text-primary)' }}>
                                {activeCouch.targetAmount.toLocaleString('fr-FR')} {CURRENCY}
                            </div>
                        </div>
                        <div className="glass-card summary-card">
                            <div className="summary-label">Collecté</div>
                            <div className="summary-value positive">
                                {currentTotal.toLocaleString('fr-FR')} {CURRENCY}
                            </div>
                        </div>
                        <div className="glass-card summary-card">
                            <div className="summary-label">Progression</div>
                            <div className="summary-value" style={{ color: 'var(--warning)' }}>
                                {Math.floor(progress)}%
                            </div>
                        </div>
                    </div>

                    <div className="glass-card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                        <div style={{ height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%',
                                width: `${progress}%`,
                                background: 'linear-gradient(90deg, var(--primary), var(--success))',
                                transition: 'width 0.5s ease'
                            }} />
                        </div>
                    </div>

                    <div className="bubble-grid">
                        {activeCouch.denominations.map((val, idx) => {
                            const isChecked = activeCouch.checkedIndices.includes(idx);
                            return (
                                <div
                                    key={idx}
                                    className={`bubble ${isChecked ? 'checked' : ''}`}
                                    onClick={() => toggleBubble(idx)}
                                >
                                    {val}
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ marginTop: '3rem', textAlign: 'center' }}>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(activeCouch.id)}>
                            Abandonner le défi
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
                .bubble-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
                    gap: 12px;
                    padding: 1rem;
                }
                .bubble {
                    aspect-ratio: 1;
                    border-radius: 50%;
                    border: 2px dashed rgba(255,255,255,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.9rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    user-select: none;
                    background: rgba(255,255,255,0.05);
                }
                .bubble:hover {
                    transform: scale(1.1);
                    border-color: var(--primary);
                    background: rgba(var(--primary-rgb), 0.1);
                }
                .bubble.checked {
                    background: var(--success);
                    border-style: solid;
                    border-color: white;
                    color: white;
                    transform: scale(0.95);
                    box-shadow: 0 0 15px rgba(var(--success-rgb), 0.4);
                    text-decoration: line-through;
                    opacity: 0.8;
                }
                .bubble.checked:after {
                    content: '✓';
                    position: absolute;
                    font-size: 1.5rem;
                    opacity: 0.3;
                }
                @media (max-width: 480px) {
                    .bubble-grid {
                        grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
                        gap: 8px;
                    }
                    .bubble {
                        font-size: 0.8rem;
                    }
                }
            `}</style>
        </AppShell>
    );
}
