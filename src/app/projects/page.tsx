'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';
import { getProjects, addProject, updateProject, deleteProject, getTotalSavings } from '@/services/firestore';
import { Project } from '@/types/types';
import { CURRENCY } from '@/lib/constants';

const PRIORITY_LABELS: Record<Project['priority'], string> = {
    high: 'Haute',
    medium: 'Moyenne',
    low: 'Basse'
};

const PRIORITY_COLORS: Record<Project['priority'], string> = {
    high: 'var(--danger)',
    medium: 'var(--warning)',
    low: 'var(--success)'
};

export default function ProjectsPage() {
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [realSavings, setRealSavings] = useState(0);

    // Form state
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [priority, setPriority] = useState<Project['priority']>('medium');
    const [note, setNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const loadProjects = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [data, savings] = await Promise.all([
                getProjects(user.uid),
                getTotalSavings(user.uid)
            ]);
            setProjects(data);
            setRealSavings(savings.real);
        } catch (error) {
            console.error('Error loading projects:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    const handleOpenModal = (p?: Project) => {
        if (p) {
            setEditingProject(p);
            setTitle(p.title);
            setAmount(p.amount.toString());
            setDate(p.date.toDate().toISOString().split('T')[0]);
            setPriority(p.priority);
            setNote(p.note || '');
        } else {
            setEditingProject(null);
            setTitle('');
            setAmount('');
            setDate(new Date().toISOString().split('T')[0]);
            setPriority('medium');
            setNote('');
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setIsSaving(true);
        const projectData = {
            title,
            amount: parseFloat(amount),
            date: new Date(date) as any,
            priority,
            status: editingProject ? editingProject.status : 'pending',
            note: note.trim()
        };

        try {
            if (editingProject) {
                await updateProject(user.uid, editingProject.id, projectData);
            } else {
                await addProject(user.uid, projectData as any);
            }
            setIsModalOpen(false);
            loadProjects();
        } catch (error) {
            console.error('Error saving project:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!user || !confirm('Supprimer ce projet ?')) return;
        try {
            await deleteProject(user.uid, id);
            loadProjects();
        } catch (error) {
            console.error('Error deleting project:', error);
        }
    };

    const toggleStatus = async (p: Project) => {
        if (!user) return;
        const newStatus = p.status === 'completed' ? 'pending' : 'completed';
        try {
            await updateProject(user.uid, p.id, { status: newStatus });
            loadProjects();
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const sortedProjects = [...projects].sort((a, b) => {
        // 1. Availability (Affordable first)
        const aAffordable = realSavings >= a.amount;
        const bAffordable = realSavings >= b.amount;
        if (aAffordable && !bAffordable) return -1;
        if (!aAffordable && bAffordable) return 1;

        // 2. Date (Closest first)
        const aDate = a.date.toMillis();
        const bDate = b.date.toMillis();
        if (aDate !== bDate) return aDate - bDate;

        // 3. Priority (High > Medium > Low)
        const priorityScore = { high: 3, medium: 2, low: 1 };
        return priorityScore[b.priority] - priorityScore[a.priority];
    });

    return (
        <AppShell>
            <div className="sticky-mobile-summary">
                <div className="summary-grid" style={{ marginBottom: '2rem' }}>
                    <div className="glass-card summary-card">
                        <div className="summary-label">Budget Disponible</div>
                        <div className="summary-value positive">
                            {realSavings.toLocaleString('fr-FR')} {CURRENCY}
                        </div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                            Épargne réelle cumulée
                        </div>
                    </div>
                </div>
            </div>

            <div className="page-header" style={{ marginTop: '1rem' }}>
                <div>
                    <h1 className="page-title">Mes Projets</h1>
                    <p className="page-subtitle">Dépenses futures et investissements</p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                    🚀 Nouveau Projet
                </button>
            </div>

            {loading ? (
                <div className="loading-container">
                    <div className="spinner" />
                </div>
            ) : sortedProjects.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">🎯</div>
                    <p className="empty-text">Aucun projet en vue. Planifiez votre prochain achat !</p>
                </div>
            ) : (
                <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                    {sortedProjects.map((p) => {
                        const isAffordable = realSavings >= p.amount;
                        return (
                            <div
                                key={p.id}
                                className={`glass-card status-card project-card ${p.status === 'completed' ? 'exhausted' : ''} ${isAffordable ? 'is-affordable' : 'is-locked'}`}
                                style={{ position: 'relative', overflow: 'hidden' }}
                            >
                                {p.status === 'completed' && <div style={{ position: 'absolute', top: 10, right: 10, fontSize: '1.5rem' }}>✅</div>}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div>
                                        <span className="expense-category" style={{ backgroundColor: `${PRIORITY_COLORS[p.priority]}20`, color: PRIORITY_COLORS[p.priority], border: `1px solid ${PRIORITY_COLORS[p.priority]}40` }}>
                                            {PRIORITY_LABELS[p.priority]}
                                        </span>
                                        <h3 style={{ fontSize: '1.25rem', marginTop: '0.5rem', opacity: p.status === 'completed' ? 0.6 : 1 }}>{p.title}</h3>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div className="summary-value" style={{ fontSize: '1.4rem', color: p.status === 'completed' ? 'var(--text-muted)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                            <span className="padlock-icon">{isAffordable ? '🔓' : '🔒'}</span>
                                            {p.amount.toLocaleString('fr-FR')} {CURRENCY}
                                        </div>
                                        <div className="expense-date">{p.date.toDate().toLocaleDateString('fr-FR')}</div>
                                    </div>
                                </div>

                                {p.note && <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontStyle: 'italic' }}>"{p.note}"</p>}

                                <div className="expense-actions" style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-glass)', justifyContent: 'flex-end' }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => toggleStatus(p)}>
                                        {p.status === 'completed' ? 'Réouvrir' : 'Terminer'}
                                    </button>
                                    <button className="btn btn-secondary btn-sm" onClick={() => handleOpenModal(p)}>
                                        Modifier
                                    </button>
                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>
                                        Suppr.
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="glass-card modal-content">
                        <div className="modal-header">
                            <h2 className="modal-title">{editingProject ? 'Modifier le Projet' : 'Nouveau Projet'}</h2>
                            <button className="btn-icon" onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSave} className="auth-form">
                            <div className="form-group">
                                <label className="form-label">Titre</label>
                                <input className="form-input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex: Nouveau PC Gamer" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Montant ({CURRENCY})</label>
                                <input className="form-input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Date cible</label>
                                <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Priorité</label>
                                <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value as any)}>
                                    <option value="high">Haute priority</option>
                                    <option value="medium">Moyenne</option>
                                    <option value="low">Basse</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Note (optionnel)</label>
                                <textarea className="form-textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Détails, liens, etc." rows={3} />
                            </div>
                            <button className="btn btn-primary" type="submit" disabled={isSaving}>
                                {isSaving ? 'Enregistrement...' : editingProject ? 'Mettre à jour' : 'Créer le Projet'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </AppShell>
    );
}
