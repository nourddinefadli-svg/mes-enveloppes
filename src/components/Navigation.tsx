'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
    { href: '/dashboard', icon: '📊', label: 'Dashboard' },
    { href: '/add-expense', icon: '➕', label: 'Dépense' },
    { href: '/history', icon: '📋', label: 'Historique' },
    { href: '/projects', icon: '🚀', label: 'Projets' },
    { href: '/init-month', icon: '📅', label: 'Mois' },
];

export default function Navigation() {
    const pathname = usePathname();

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
