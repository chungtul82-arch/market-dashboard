import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Portfolio } from '@/types';

export async function savePortfolio(portfolio: Portfolio): Promise<void> {
  await setDoc(doc(db, 'portfolio', 'latest'), portfolio);
}

export function subscribePortfolio(cb: (p: Portfolio | null) => void): () => void {
  return onSnapshot(doc(db, 'portfolio', 'latest'), snap => {
    cb(snap.exists() ? (snap.data() as Portfolio) : null);
  });
}
