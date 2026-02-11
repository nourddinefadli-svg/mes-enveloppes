import { Timestamp } from 'firebase/firestore';
import { EnvelopeClassId } from '@/lib/constants';

export interface Month {
    id: string; // YYYY-MM
    createdAt: Timestamp;
}

export interface Envelope {
    id: string;
    name: string;
    displayName?: string;
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
    displayName?: string;
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

export interface Project {
    id: string;
    title: string;
    amount: number;
    date: Timestamp;
    priority: 'high' | 'medium' | 'low';
    status: 'pending' | 'completed' | 'cancelled';
    note?: string;
}

export interface Couchonne {
    id: string;
    name: string;
    targetAmount: number;
    denominations: number[]; // Tous les billets/pièces générés
    checkedIndices: number[]; // Indices des ronds cochés
    createdAt: Timestamp;
}
