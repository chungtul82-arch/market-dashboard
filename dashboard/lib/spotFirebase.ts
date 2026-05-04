import { doc, collection, setDoc, getDoc, getDocs, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { BasketStock, SpotEntry } from '@/types/spot';

const basketDoc  = () => doc(db, 'basket', 'stocks');
const spotColl   = () => collection(db, 'spot-history');
const spotDoc    = (id: string) => doc(db, 'spot-history', id);

// ── 바스켓 ─────────────────────────────────────────────
export async function getBasketStocks(): Promise<BasketStock[]> {
  const snap = await getDoc(basketDoc());
  return snap.exists() ? (snap.data()?.items ?? []) : [];
}

export async function saveBasketStocks(stocks: BasketStock[]): Promise<void> {
  await setDoc(basketDoc(), { items: stocks });
}

// ── 스팟 히스토리 ────────────────────────────────────
export async function saveSpotEntry(entry: SpotEntry): Promise<SpotEntry> {
  const id = entry.id ?? `${entry.date}T${entry.time.replace(':', '')}`;
  const data = { ...entry, id };
  await setDoc(spotDoc(id), data);
  return data;
}

export async function getSpotHistory(): Promise<SpotEntry[]> {
  const snap = await getDocs(spotColl());
  return snap.docs
    .map(d => d.data() as SpotEntry)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function subscribeSpotHistory(cb: (entries: SpotEntry[]) => void): () => void {
  return onSnapshot(spotColl(), snap => {
    const entries = snap.docs
      .map(d => d.data() as SpotEntry)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    cb(entries);
  });
}

export async function deleteSpotEntry(id: string): Promise<void> {
  await deleteDoc(spotDoc(id));
}
