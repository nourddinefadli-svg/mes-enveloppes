import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    where,
    Timestamp,
    serverTimestamp,
} from 'firebase/firestore';
import { getDbInstance } from '@/lib/firebase';
import { Month, Envelope, Expense } from '@/types/types';
import { ENVELOPE_CLASSES, EnvelopeClassId } from '@/lib/constants';

// ===================== MONTHS =====================

export async function createMonth(uid: string, monthId: string): Promise<void> {
    const monthRef = doc(getDbInstance(), 'users', uid, 'months', monthId);
    const monthSnap = await getDoc(monthRef);
    if (!monthSnap.exists()) {
        await setDoc(monthRef, { createdAt: serverTimestamp() });
    }
}

export async function getMonth(uid: string, monthId: string): Promise<Month | null> {
    const monthRef = doc(getDbInstance(), 'users', uid, 'months', monthId);
    const snap = await getDoc(monthRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Month;
}

export async function getMonths(uid: string): Promise<Month[]> {
    const monthsRef = collection(getDbInstance(), 'users', uid, 'months');
    const q = query(monthsRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Month));
}

// ===================== ENVELOPES =====================

export async function initializeEnvelopes(
    uid: string,
    monthId: string,
    amounts: Record<EnvelopeClassId, number>
): Promise<void> {
    await createMonth(uid, monthId);

    for (const cls of ENVELOPE_CLASSES) {
        const envelopeRef = doc(getDbInstance(), 'users', uid, 'months', monthId, 'envelopes', cls.id);
        await setDoc(envelopeRef, {
            name: cls.id,
            initialAmount: amounts[cls.id] || 0,
        });
    }
}

export async function getEnvelopes(uid: string, monthId: string): Promise<Envelope[]> {
    const envelopesRef = collection(getDbInstance(), 'users', uid, 'months', monthId, 'envelopes');
    const snap = await getDocs(envelopesRef);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Envelope));
}

export async function getEnvelopesForPreviousMonth(
    uid: string,
    currentMonthId: string
): Promise<Record<EnvelopeClassId, number> | null> {
    const [year, month] = currentMonthId.split('-').map(Number);
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth < 1) {
        prevMonth = 12;
        prevYear -= 1;
    }
    const prevMonthId = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

    const envelopes = await getEnvelopes(uid, prevMonthId);
    if (envelopes.length === 0) return null;

    const amounts: Record<string, number> = {};
    for (const env of envelopes) {
        amounts[env.name] = env.initialAmount;
    }
    return amounts as Record<EnvelopeClassId, number>;
}

// ===================== EXPENSES =====================

export async function addExpense(
    uid: string,
    monthId: string,
    expense: { envelopeName: string; amount: number; date: Date; note?: string }
): Promise<string> {
    const expensesRef = collection(getDbInstance(), 'users', uid, 'months', monthId, 'expenses');
    const docRef = await addDoc(expensesRef, {
        envelopeName: expense.envelopeName,
        amount: expense.amount,
        date: Timestamp.fromDate(expense.date),
        note: expense.note || '',
    });
    return docRef.id;
}

export async function getExpenses(
    uid: string,
    monthId: string,
    envelopeFilter?: string
): Promise<Expense[]> {
    const expensesRef = collection(getDbInstance(), 'users', uid, 'months', monthId, 'expenses');
    let q;
    if (envelopeFilter) {
        q = query(expensesRef, where('envelopeName', '==', envelopeFilter), orderBy('date', 'desc'));
    } else {
        q = query(expensesRef, orderBy('date', 'desc'));
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));
}

export async function updateExpense(
    uid: string,
    monthId: string,
    expenseId: string,
    data: Partial<{ envelopeName: string; amount: number; date: Date; note: string }>
): Promise<void> {
    const expenseRef = doc(getDbInstance(), 'users', uid, 'months', monthId, 'expenses', expenseId);
    const updateData: Record<string, unknown> = { ...data };
    if (data.date) {
        updateData.date = Timestamp.fromDate(data.date);
    }
    await updateDoc(expenseRef, updateData);
}

export async function deleteExpense(
    uid: string,
    monthId: string,
    expenseId: string
): Promise<void> {
    const expenseRef = doc(getDbInstance(), 'users', uid, 'months', monthId, 'expenses', expenseId);
    await deleteDoc(expenseRef);
}
