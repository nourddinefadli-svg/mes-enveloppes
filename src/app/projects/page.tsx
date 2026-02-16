'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';
import { getProjects, addProject, updateProject, deleteProject, getTotalSavings, injectSavings, getManualInjection } from '@/services/firestore';
import { Project } from '@/types/types';
import { useLanguage } from '@/contexts/LanguageContext';

const PRIORITY_COLORS: Record<Project['priority'], string> = {
    high: 'var(--danger)',
    medium: 'var(--warning)',
    low: 'var(--success)'
};

export default function ProjectsPage() {
    const { user } = useAuth();
    const { t, isRTL } = useLanguage();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isInjectModalOpen, setIsInjectModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [realSavings, setRealSavings] = useState(0);
    const [manualInjection, setManualInjection] = useState(0);
    const [injectAmount, setInjectAmount] = useState('3000');

    // Form state
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [priority, setPriority] = useState<Project['priority']>('medium');
    const [note, setNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const PRIORITY_LABELS: Record<Project['priority'], string> = {
        high: t('projects.priorityHigh'),
        medium: t('projects.priorityMedium'),
        low: t('projects.priorityLow')
    };

    const loadProjects = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [data, savings, injection] = await Promise.all([
                getProjects(user.uid),
                getTotalSavings(user.uid),
                getManualInjection(user.uid)
            ]);
            setProjects(data);
            setRealSavings(savings.real);
            setManualInjection(injection);
            if (injection > 0) setInjectAmount(injection.toString());
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
        if (!user || !confirm(t('projects.confirmDelete'))) return;
        try {
            await deleteProject(user.uid, id);
            loadProjects();
        } catch (error) {
            console.error('Error deleting project:', error);
        }
    };

    const handleInject = async () => {
        if (!user || !injectAmount) return;
        setIsSaving(true);
        try {
            await injectSavings(user.uid, parseFloat(injectAmount));
            setIsInjectModalOpen(false);
            loadProjects();
        } catch (error) {
            console.error('Error injecting savings:', error);
        } finally {
            setIsSaving(false);
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

    const totalBudget = realSavings + manualInjection;

    const sortedProjects = [...projects].sort((a, b) => {
        const aAffordable = totalBudget >= a.amount;
        const bAffordable = totalBudget >= b.amount;
        if (aAffordable && !bAffordable) return -1;
        if (!aAffordable && bAffordable) return 1;

        const aDate = a.date.toMillis();
        const bDate = b.date.toMillis();
        if (aDate !== bDate) return aDate - bDate;

        const priorityScore = { high: 3, medium: 2, low: 1 };
        return priorityScore[b.priority] - priorityScore[a.priority];
    });

    return (
        <AppShell>
            <div className="sticky-mobile-summary">
                <div className="summary-grid" style={{ marginBottom: '2rem' }}>
                    <div className="glass-card summary-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <div className="summary-label">{t('projects.availableBudget')}</div>
                            <div className="summary-value positive">
                                {totalBudget.toLocaleString('fr-FR')} {t('common.currency')}
                            </div>
                            <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                                {t('projects.budgetBreakdown').replace('{savings}', realSavings.toLocaleString('fr-FR')).replace('{injection}', manualInjection.toLocaleString('fr-FR'))}
                            </div>
                        </div>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setIsInjectModalOpen(true)}
                            style={{ fontSize: '0.7rem' }}
                        >
                            💉 {manualInjection > 0 ? t('projects.modifyInjectionBtn') : t('projects.injectSavingsBtn')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="page-header" style={{ marginTop: '1rem' }}>
                <div>
                    <h1 className="page-title">{t('projects.title')}</h1>
                    <p className="page-subtitle">{t('projects.subtitle')}</p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                    {t('projects.newProjectBtn')}
                </button>
            </div>

            {loading ? (
                <div className="loading-container">
                    <div className="spinner" />
                </div>
            ) : sortedProjects.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">🎯</div>
                    <p className="empty-text">{t('projects.noProjects')}</p>
                </div>
            ) : (
                <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                    {sortedProjects.map((p) => {
                        const isAffordable = totalBudget >= p.amount;
                        return (
                            <div
                                key={p.id}
                                className={`glass-card status-card project-card ${p.status === 'completed' ? 'exhausted' : ''} ${isAffordable ? 'is-affordable' : 'is-locked'}`}
                                style={{ position: 'relative', overflow: 'hidden' }}
                            >
                                {p.status === 'completed' && <div style={{ position: 'absolute', top: 10, right: isRTL ? 'auto' : 10, left: isRTL ? 10 : 'auto', fontSize: '1.5rem' }}>✅</div>}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div>
                                        <span className="expense-category" style={{ backgroundColor: `${PRIORITY_COLORS[p.priority]}20`, color: PRIORITY_COLORS[p.priority], border: `1px solid ${PRIORITY_COLORS[p.priority]}40` }}>
                                            {PRIORITY_LABELS[p.priority]}
                                        </span>
                                        <h3 style={{ fontSize: '1.25rem', marginTop: '0.5rem', opacity: p.status === 'completed' ? 0.6 : 1, textAlign: isRTL ? 'right' : 'left' }}>{p.title}</h3>
                                    </div>
                                    <div style={{ textAlign: isRTL ? 'left' : 'right' }}>
                                        <div className="summary-value" style={{ fontSize: '1.4rem', color: p.status === 'completed' ? 'var(--text-muted)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: isRTL ? 'flex-start' : 'flex-end', gap: '0.5rem', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                                            <span className="padlock-icon">{isAffordable ? '🔓' : '🔒'}</span>
                                            {p.amount.toLocaleString('fr-FR')} {t('common.currency')}
                                        </div>
                                        <div className="expense-date">{p.date.toDate().toLocaleDateString('fr-FR')}</div>
                                    </div>
                                </div>

                                {p.note && <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontStyle: 'italic', textAlign: isRTL ? 'right' : 'left' }}>"{p.note}"</p>}

                                <div className="expense-actions" style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-glass)', justifyContent: isRTL ? 'flex-start' : 'flex-end' }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => toggleStatus(p)}>
                                        {p.status === 'completed' ? t('projects.reopen') : t('projects.complete')}
                                    </button>
                                    <button className="btn btn-secondary btn-sm" onClick={() => handleOpenModal(p)}>
                                        {t('common.edit')}
                                    </button>
                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>
                                        {t('common.delete')}
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
                            <h2 className="modal-title">{editingProject ? t('common.edit') : t('projects.newProject')}</h2>
                            <button className="btn-icon" onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSave} className="auth-form">
                            <div className="form-group">
                                <label className="form-label">{t('projects.formTitle')}</label>
                                <input className="form-input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="..." required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('projects.targetAmount')} ({t('common.currency')})</label>
                                <input className="form-input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('projects.deadline')}</label>
                                <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('projects.priority')}</label>
                                <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value as any)}>
                                    <option value="high">{t('projects.priorityHigh')}</option>
                                    <option value="medium">{t('projects.priorityMedium')}</option>
                                    <option value="low">{t('projects.priorityLow')}</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('dashboard.note')}</label>
                                <textarea className="form-textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="..." rows={3} />
                            </div>
                            <button className="btn btn-primary" type="submit" disabled={isSaving}>
                                {isSaving ? t('common.loading') : editingProject ? t('common.edit') : t('common.add')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {isInjectModalOpen && (
                <div className="modal-overlay">
                    <div className="glass-card modal-content" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">{t('projects.injectSavingsBtn')}</h2>
                            <button className="btn-icon" onClick={() => setIsInjectModalOpen(false)}>✕</button>
                        </div>
                        <div className="auth-form">
                            <div className="form-group">
                                <label className="form-label">{t('projects.targetAmount')} ({t('common.currency')})</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    value={injectAmount}
                                    onChange={(e) => setInjectAmount(e.target.value)}
                                    placeholder="ex: 3000"
                                />
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                    {t('projects.injectHelp')}
                                </p>
                            </div>
                            <button className="btn btn-primary" onClick={handleInject} disabled={isSaving}>
                                {isSaving ? t('common.loading') : t('common.save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppShell>
    );
}
