import {
    collection,
    doc,
    setDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    Timestamp,
} from 'firebase/firestore';
import { getDbInstance } from '@/lib/firebase';
import { Subscription } from '@/types/types';

const getSubscriptionsCollection = (uid: string) =>
    collection(getDbInstance(), 'users', uid, 'subscriptions');

export async function addSubscription(
    uid: string,
    subscription: Omit<Subscription, 'id'>
): Promise<string> {
    const subsRef = getSubscriptionsCollection(uid);
    const docRef = await addDoc(subsRef, {
        ...subscription,
        startDate: subscription.startDate || Timestamp.now(),
    });
    return docRef.id;
}

export async function getSubscriptions(uid: string): Promise<Subscription[]> {
    const subsRef = getSubscriptionsCollection(uid);
    const q = query(subsRef, orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subscription));
}

export async function updateSubscription(
    uid: string,
    subscriptionId: string,
    data: Partial<Omit<Subscription, 'id'>>
): Promise<void> {
    const subRef = doc(getDbInstance(), 'users', uid, 'subscriptions', subscriptionId);
    await updateDoc(subRef, data as any);
}

export async function deleteSubscription(
    uid: string,
    subscriptionId: string
): Promise<void> {
    const subRef = doc(getDbInstance(), 'users', uid, 'subscriptions', subscriptionId);
    await deleteDoc(subRef);
}

export async function toggleSubscriptionActive(
    uid: string,
    subscriptionId: string,
    active: boolean
): Promise<void> {
    const subRef = doc(getDbInstance(), 'users', uid, 'subscriptions', subscriptionId);
    await updateDoc(subRef, { active });
}
