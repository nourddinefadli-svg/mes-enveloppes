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
    const [effects, setEffects] = useState<{ id: string, x: number, y: number, isMajor: boolean }[]>([]);

    // Creation state
    const [targetAmount, setTargetAmount] = useState('10000');
    const [couchonneName, setCouchonneName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Renaming state
    const [isRenaming, setIsRenaming] = useState(false);
    const [renamingValue, setRenamingValue] = useState('');

    const loadData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await getCouchonnes(user.uid);
            setCouchonnes(data);
            if (data.length > 0) {
                // Only update the active one if we already had one selected (e.g., after an update)
                // If it's the initial load (prev is null), we keep it null to show the overview list
                setActiveCouch(prev => {
                    if (!prev) return null;
                    const exists = data.find(c => c.id === prev.id);
                    return exists || null;
                });
            } else {
                setActiveCouch(null);
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
        const name = couchonneName.trim() || `Défi ${couchonnes.length + 1}`;
        if (isNaN(target) || target <= 0) return;
        if (couchonnes.length >= 3) {
            alert('Vous ne pouvez pas avoir plus de 3 Couchonnes actives.');
            return;
        }

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
                name: name,
                targetAmount: target,
                denominations: generated.sort((a, b) => b - a),
                checkedIndices: []
            };

            await saveCouchonne(user.uid, newCouch);
            setActiveCouch(newCouch as Couchonne);
            setIsCreating(false);
            loadData();
        } catch (error) {
            console.error('Error creating Couchonne:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const triggerEffect = (e: React.MouseEvent, val: number) => {
        const isMajor = val >= 50;

        // Vibration (Haptique)
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(isMajor ? [40, 20, 40] : 20);
        }

        // Particules (Visuel)
        const id = Math.random().toString(36).substring(7);
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        setEffects(prev => [...prev, { id, x, y, isMajor }]);
        setTimeout(() => {
            setEffects(prev => prev.filter(eff => eff.id !== id));
        }, 800);
    };

    const handleRename = async () => {
        if (!user || !activeCouch || !renamingValue.trim()) return;
        setIsSaving(true);
        try {
            const updated = { ...activeCouch, name: renamingValue.trim() };
            await saveCouchonne(user.uid, updated);
            setActiveCouch(updated);
            setCouchonnes(prev => prev.map(c => c.id === updated.id ? updated : c));
            setIsRenaming(false);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleBubble = async (e: React.MouseEvent, index: number) => {
        if (!user || !activeCouch) return;

        const val = activeCouch.denominations[index];
        const isCurrentlyChecked = activeCouch.checkedIndices.includes(index);

        // Trigger effect ONLY when checking (not unchecking)
        if (!isCurrentlyChecked) {
            triggerEffect(e, val);
        }

        const newIndices = isCurrentlyChecked
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
                {!loading && couchonnes.length < 3 && !isCreating && (
                    <button className="btn btn-primary" onClick={() => {
                        setCouchonneName('');
                        setTargetAmount('10000');
                        setIsCreating(true);
                    }}>
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
                        <label className="form-label">Nom du défi</label>
                        <input
                            className="form-input"
                            type="text"
                            value={couchonneName}
                            onChange={(e) => setCouchonneName(e.target.value)}
                            placeholder="ex: Voyage, Nouveau Mac..."
                        />
                    </div>
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
                <div className="couchonne-dashboard">
                    <div className="cards-grid">
                        {couchonnes.map((c) => {
                            const total = c.checkedIndices.reduce((sum, idx) => sum + c.denominations[idx], 0);
                            const prog = (total / c.targetAmount) * 100;
                            return (
                                <div
                                    key={c.id}
                                    className="sublime-card"
                                    onClick={() => setActiveCouch(c)}
                                >
                                    <div className="card-header">
                                        <span className="card-name">{c.name}</span>
                                        <span className="card-percent">{Math.floor(prog)}%</span>
                                    </div>
                                    <div className="card-main">
                                        <div className="card-amount" style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                            <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{total.toLocaleString('fr-FR')}</span>
                                            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>/ {c.targetAmount.toLocaleString('fr-FR')} {CURRENCY}</span>
                                        </div>
                                        <div className="card-progress-bar">
                                            <div className="progress-fill" style={{ width: `${prog}%` }} />
                                        </div>
                                    </div>
                                    <div className="card-footer">
                                        <span>{c.denominations.length - c.checkedIndices.length} bulles restantes</span>
                                        <span className="card-arrow">→</span>
                                    </div>
                                </div>
                            );
                        })}
                        {couchonnes.length < 3 && (
                            <div className="add-card" onClick={() => setIsCreating(true)}>
                                <div className="add-icon">+</div>
                                <div className="add-text">Nouveau défi</div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="couchonne-detail">
                    <button className="back-btn" onClick={() => setActiveCouch(null)}>
                        ← Retour aux défis
                    </button>

                    <div className="detail-header glass-card">
                        <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                            {isRenaming ? (
                                <div className="rename-form">
                                    <input
                                        className="form-input"
                                        value={renamingValue}
                                        onChange={(e) => setRenamingValue(e.target.value)}
                                        autoFocus
                                        onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                                    />
                                    <div className="rename-actions">
                                        <button className="btn btn-primary btn-sm" onClick={handleRename}>✓</button>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setIsRenaming(false)}>✕</button>
                                    </div>
                                </div>
                            ) : (
                                <h2 className="detail-title" style={{ marginBottom: 0 }}>
                                    {activeCouch.name}
                                    <button
                                        className="edit-btn"
                                        onClick={() => {
                                            setRenamingValue(activeCouch.name);
                                            setIsRenaming(true);
                                        }}
                                        title="Modifier le nom"
                                    >
                                        ✏️
                                    </button>
                                </h2>
                            )}
                        </div>
                        <div className="detail-stats">
                            <div className="stat-item">
                                <span className="stat-label">Objectif</span>
                                <div className="stat-value-container">
                                    <span className="stat-value">{activeCouch.targetAmount.toLocaleString('fr-FR')}</span>
                                    <span className="stat-currency">{CURRENCY}</span>
                                </div>
                            </div>
                            <div className="stat-divider" />
                            <div className="stat-item">
                                <span className="stat-label">Collecté</span>
                                <div className="stat-value-container">
                                    <span className="stat-value positive">{currentTotal.toLocaleString('fr-FR')}</span>
                                    <span className="stat-currency">{CURRENCY}</span>
                                </div>
                            </div>
                            <div className="stat-divider" />
                            <div className="stat-item">
                                <span className="stat-label">Progression</span>
                                <div className="stat-value-container">
                                    <span className="stat-value warning">{Math.floor(progress)}%</span>
                                </div>
                            </div>
                        </div>
                        <div className="detail-progress-wrapper">
                            <div className="detail-progress-bar">
                                <div className="detail-progress-fill" style={{ width: `${progress}%` }} />
                            </div>
                        </div>
                    </div>

                    <div className="bubble-grid">
                        {activeCouch.denominations.map((val, idx) => {
                            const isChecked = activeCouch.checkedIndices.includes(idx);
                            return (
                                <div
                                    key={idx}
                                    className={`bubble ${isChecked ? 'checked' : ''}`}
                                    onClick={(e) => toggleBubble(e, idx)}
                                >
                                    {val}
                                </div>
                            );
                        })}
                    </div>

                    {/* Effets de particules */}
                    {effects.map(eff => (
                        <div
                            key={eff.id}
                            className={`particle-container ${eff.isMajor ? 'major' : 'minor'}`}
                            style={{ left: eff.x, top: eff.y }}
                        >
                            {[...Array(eff.isMajor ? 12 : 6)].map((_, i) => (
                                <div key={i} className="particle" style={{ '--angle': `${i * (360 / (eff.isMajor ? 12 : 6))}deg` } as any} />
                            ))}
                        </div>
                    ))}

                    <div style={{ marginTop: '3rem', textAlign: 'center' }}>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(activeCouch.id)}>
                            Abandonner le défi "{activeCouch.name}"
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
                .cards-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1.5rem;
                    padding: 1rem 0;
                }
                .sublime-card {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    padding: 1.5rem;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    flex-direction: column;
                    gap: 1.2rem;
                    position: relative;
                    overflow: hidden;
                }
                .sublime-card:hover {
                    transform: translateY(-5px);
                    background: rgba(255, 255, 255, 0.08);
                    border-color: var(--accent-primary);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                }
                .sublime-card::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: linear-gradient(135deg, transparent, rgba(129, 140, 248, 0.05));
                    pointer-events: none;
                }
                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .card-name {
                    font-size: 1.2rem;
                    font-weight: 700;
                    color: white;
                }
                .card-percent {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--warning);
                    background: rgba(251, 191, 36, 0.1);
                    padding: 2px 8px;
                    border-radius: 10px;
                }
                .card-amount {
                    font-size: 0.85rem;
                    opacity: 0.7;
                    margin-bottom: 0.5rem;
                }
                .card-progress-bar {
                    height: 8px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                    overflow: hidden;
                    box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
                }
                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, var(--accent-primary), var(--success));
                    transition: width 0.6s ease;
                    box-shadow: 0 0 10px rgba(129, 140, 248, 0.5);
                }
                .card-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 0.8rem;
                    opacity: 0.6;
                    margin-top: auto;
                }
                .card-arrow {
                    font-size: 1.2rem;
                    transition: transform 0.3s ease;
                }
                .sublime-card:hover .card-arrow {
                    transform: translateX(5px);
                    color: var(--accent-primary);
                }
                .add-card {
                    border: 2px dashed rgba(255,255,255,0.1);
                    border-radius: 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 1rem;
                    cursor: pointer;
                    min-height: 180px;
                    transition: all 0.3s ease;
                    opacity: 0.7;
                }
                .add-card:hover {
                    opacity: 1;
                    border-color: var(--accent-primary);
                    background: rgba(129, 140, 248, 0.05);
                }
                .add-icon {
                    font-size: 2.5rem;
                    font-weight: 200;
                }
                .back-btn {
                    background: none;
                    border: none;
                    color: var(--accent-primary);
                    cursor: pointer;
                    font-size: 0.9rem;
                    margin-bottom: 1.5rem;
                    padding: 0;
                }
                .detail-header {
                    padding: 2rem;
                    margin-bottom: 2rem;
                }
                .detail-title {
                    font-size: 1.8rem;
                    text-align: center;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 1rem;
                }
                .edit-btn {
                    background: none;
                    border: none;
                    font-size: 1.1rem;
                    cursor: pointer;
                    opacity: 0.4;
                    transition: opacity 0.2s;
                    padding: 4px;
                }
                .edit-btn:hover {
                    opacity: 1;
                }
                .rename-form {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.8rem;
                }
                .rename-actions {
                    display: flex;
                    gap: 0.5rem;
                }
                .rename-form .form-input {
                    text-align: center;
                    font-size: 1.4rem;
                    font-weight: 700;
                    background: rgba(255,255,255,0.05);
                    border-bottom: 2px solid var(--accent-primary);
                }
                .detail-stats {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 2rem;
                    margin-bottom: 2rem;
                }
                .stat-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .stat-label {
                    font-size: 0.8rem;
                    opacity: 0.6;
                    margin-bottom: 0.4rem;
                }
                .stat-value {
                    font-size: 1.4rem;
                    font-weight: 800;
                    line-height: 1;
                }
                .stat-value-container {
                    display: flex;
                    align-items: baseline;
                    gap: 4px;
                }
                .stat-currency {
                    font-size: 0.8rem;
                    opacity: 0.6;
                    font-weight: 600;
                }
                .stat-divider {
                    width: 1px;
                    height: 30px;
                    background: rgba(255,255,255,0.1);
                }
                .detail-progress-wrapper {
                    max-width: 600px;
                    margin: 0 auto;
                }
                .detail-progress-bar {
                    height: 12px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                    overflow: hidden;
                    box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
                }
                .detail-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, var(--accent-primary), var(--success));
                    transition: width 0.6s ease;
                    box-shadow: 0 0 15px rgba(129, 140, 248, 0.5);
                }
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
                    border-color: var(--accent-primary);
                    background: rgba(129, 140, 248, 0.1);
                }
                .bubble.checked {
                    background: var(--success);
                    border-style: solid;
                    border-color: white;
                    color: white;
                    transform: scale(0.95);
                    box-shadow: 0 0 15px rgba(52, 211, 153, 0.4);
                    text-decoration: line-through;
                    opacity: 0.8;
                }
                .bubble.checked:after {
                    content: '✓';
                    position: absolute;
                    font-size: 1.5rem;
                    opacity: 0.3;
                }

                /* Particules */
                .particle-container {
                    position: fixed;
                    pointer-events: none;
                    z-index: 1000;
                }
                .particle {
                    position: absolute;
                    border-radius: 50%;
                    transform: translate(-50%, -50%);
                    animation-timing-function: cubic-bezier(0.1, 0.5, 0.3, 1);
                    animation-fill-mode: forwards;
                }
                @keyframes particle-burst-major {
                    0% {
                        transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0);
                        opacity: 1;
                        scale: 1;
                    }
                    100% {
                        transform: translate(-50%, -50%) rotate(var(--angle)) translateY(80px);
                        opacity: 0;
                        scale: 0.2;
                    }
                }
                @keyframes particle-burst-minor {
                    0% {
                        transform: translate(-50%, -50%) rotate(var(--angle)) translateY(0);
                        opacity: 1;
                        scale: 0.8;
                    }
                    100% {
                        transform: translate(-50%, -50%) rotate(var(--angle)) translateY(40px);
                        opacity: 0;
                        scale: 0.2;
                    }
                }
                .major .particle {
                    width: 10px;
                    height: 10px;
                    background: #fbbf24;
                    box-shadow: 0 0 15px #fbbf24, 0 0 30px rgba(251, 191, 36, 0.4);
                    animation-name: particle-burst-major;
                    animation-duration: 0.8s;
                }
                .minor .particle {
                    width: 6px;
                    height: 6px;
                    background: #34d399;
                    box-shadow: 0 0 10px #34d399;
                    animation-name: particle-burst-minor;
                    animation-duration: 0.5s;
                }
                @media (max-width: 600px) {
                    .detail-stats {
                        gap: 1rem;
                        flex-wrap: wrap;
                    }
                    .stat-divider {
                        display: none;
                    }
                    .stat-item {
                        background: rgba(255,255,255,0.03);
                        padding: 0.8rem;
                        border-radius: 12px;
                        flex: 1;
                        min-width: 100px;
                    }
                }
                @media (max-width: 480px) {
                    .bubble-grid {
                        grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
                        gap: 8px;
                    }
                    .bubble {
                        font-size: 0.8rem;
                    }
                    .detail-title {
                        font-size: 1.4rem;
                    }
                }
            `}</style>
        </AppShell>
    );
}
