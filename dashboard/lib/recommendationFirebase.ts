import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Recommendation } from '@/types/recommendation';

export async function saveRecommendation(rec: Recommendation): Promise<void> {
  const data = { ...rec, created_at: new Date().toISOString() };
  await Promise.all([
    setDoc(doc(db, 'recommendations', 'latest'), data),
    setDoc(doc(db, 'recommendations', rec.date), data),
  ]);
}

export async function getLatestRecommendation(): Promise<Recommendation | null> {
  const snap = await getDoc(doc(db, 'recommendations', 'latest'));
  return snap.exists() ? (snap.data() as Recommendation) : null;
}

export function subscribeRecommendation(cb: (rec: Recommendation | null) => void): () => void {
  return onSnapshot(doc(db, 'recommendations', 'latest'), snap => {
    cb(snap.exists() ? (snap.data() as Recommendation) : null);
  });
}
