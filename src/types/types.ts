import { Timestamp } from 'firebase/firestore';
import { EnvelopeClassId } from '@/lib/constants';

export interface Month {
    id: string; // YYYY-MM
    createdAt: Timestamp;
}

export interface Envelope {
    id: string;
    name: string;
    initialAmount: number;
    carryOver?: number; // Report du mois précédent (+ ou -)
}

export interface Expense {
    id: string;
    envelopeName: string;
    amount: number;
    date: Timestamp;
    note?: string;
}

export interface EnvelopeWithStats extends Envelope {
    spent: number;
    remaining: number;
    percentage: number;
    carryOver: number;
    adjustment: number;
}

export interface Subscription {
    id: string;
    name: string;
    amount: number;
    frequency: 'monthly' | 'yearly';
    startDate: Timestamp;
    category: EnvelopeClassId;
    active: boolean;
    note?: string;
}
