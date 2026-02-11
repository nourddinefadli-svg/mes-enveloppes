export const ENVELOPE_CLASSES = [
    { id: 'loyer', label: 'Loyer', icon: '🏠' },
    { id: 'carburant', label: 'Carburant', icon: '⛽' },
    { id: 'ravitaillement', label: 'Ravitaillement', icon: '🛒' },
    { id: 'loisir', label: 'Loisir', icon: '🎮' },
    { id: 'sport', label: 'Sport', icon: '🏋️' },
    { id: 'sadaqa', label: 'Sadaqa', icon: '🤲' },
    { id: 'epargne', label: 'Épargne', icon: '💰' },
    { id: 'imprevus', label: 'Imprévus', icon: '⚡' },
    { id: 'bebe', label: 'Bébé', icon: '👶' },
    { id: 'abonnements', label: 'Abonnements', icon: '💳' },
] as const;

export type EnvelopeClassId = typeof ENVELOPE_CLASSES[number]['id'];

export const CURRENCY = 'DH';

export function getCurrentMonthId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

export function formatMonthLabel(monthId: string): string {
    const [year, month] = monthId.split('-');
    const months = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
    ];
    return `${months[parseInt(month, 10) - 1]} ${year}`;
}

export const SPIRITUAL_QUOTES = [
    "اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ",
    "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ",
    "لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",
    "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
    "رَبِّ اجْعَلْنِي مُقِيمَ الصَّلَاةِ وَمِنْ ذُرِّيَّتِي رَبَّنَا وَتَقَبَّلْ دُعَاءِ",
    "اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ، وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ",
    "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ ، سُبْحَانَ اللَّهِ الْعَظِيمِ",
    "إِنَّ مَعَ الْعُسْرِ يُسْرًا",
    "وَفِي السَّمَاءِ رِزْقُكُمْ وَمَا تُوعَدُونَ"
];
