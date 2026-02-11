'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Language } from '@/dictionaries/translations';
import { ENVELOPE_CLASSES } from '@/lib/constants';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (path: string) => string;
    isRTL: boolean;
    formatMonth: (monthId: string) => string;
    formatEnvelopeName: (id: string, displayName?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>('fr');

    useEffect(() => {
        const saved = localStorage.getItem('app_language') as Language;
        if (saved && ['fr', 'ar', 'both'].includes(saved)) {
            setLanguageState(saved);
        }
    }, []);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('app_language', lang);
    };

    const t = (path: string): string => {
        const keys = path.split('.');
        let val: any = translations;
        for (const key of keys) {
            if (val[key]) {
                val = val[key];
            } else {
                return path; // Fallback to key
            }
        }

        if (language === 'both') {
            return `${val.fr} / ${val.ar}`;
        }
        return val[language] || val.fr;
    };

    const isRTL = language === 'ar';

    const formatMonth = (monthId: string): string => {
        const [year, month] = monthId.split('-');
        const monthName = t(`months.${month}`);
        return isRTL ? `${monthName} ${year}` : `${monthName} ${year}`;
    };

    const formatEnvelopeName = (id: string, displayName?: string): string => {
        if (!displayName) return t(`envelopes.${id}`);

        const envClass = ENVELOPE_CLASSES.find(c => c.id === id);
        const trans = (translations.envelopes as any)[id];

        const standardLabels = [
            envClass?.label,
            trans?.fr,
            trans?.ar
        ].filter(Boolean);

        const isStandard = standardLabels.some(l => l === displayName);

        return isStandard ? t(`envelopes.${id}`) : displayName;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, isRTL, formatMonth, formatEnvelopeName }}>
            <div dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'rtl-mode' : ''}>
                {children}
            </div>
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
