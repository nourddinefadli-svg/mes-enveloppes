'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Navigation() {
    const pathname = usePathname();
    const { t } = useLanguage();

    const navItems = [
        { href: '/dashboard', icon: '📊', label: t('nav.dashboard') },
        { href: '/add-expense', icon: '➕', label: t('nav.expense') },
        { href: '/history', icon: '📋', label: t('nav.history') },
        { href: '/projects', icon: '🚀', label: t('nav.projects') },
        { href: '/couchonne', icon: '🐷', label: t('nav.couchonne') },
        { href: '/init-month', icon: '📅', label: t('nav.month') },
    ];

    return (
        <nav className="bottom-nav">
            {navItems.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                >
                    <span className="nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                </Link>
            ))}
        </nav>
    );
}
