import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ScreenerData } from '@/types/screener';

export function subscribeScreener(cb: (data: ScreenerData | null) => void): () => void {
  return onSnapshot(doc(db, 'screener', 'latest'), snap => {
    cb(snap.exists() ? (snap.data() as ScreenerData) : null);
  });
}
