import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Portfolio, Holding, PortfolioMeta } from '@/types';

const COLL = 'portfolios';

/** Firestore는 undefined 값을 허용하지 않으므로 저장 전 제거 */
function sanitize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data, (_, v) => v === undefined ? null : v));
}

function recalcTotals(holdings: Holding[]) {
  const totalCurrentValue = holdings.reduce((s, h) => s + (h.currentValue ?? 0), 0);
  const totalInvested     = holdings.reduce((s, h) => s + (h.investedValue ?? 0), 0);
  const totalPnl          = totalCurrentValue - totalInvested;
  const totalReturnPct    = totalInvested !== 0 ? (totalPnl / totalInvested) * 100 : 0;
  return { totalCurrentValue, totalInvested, totalPnl, totalReturnPct };
}

export async function listPortfolios(): Promise<PortfolioMeta[]> {
  const snap = await getDocs(collection(db, COLL));
  return snap.docs
    .map(d => ({
      id:                d.id,
      name:              d.data().name || '이름 없음',
      createdAt:         d.data().createdAt || '',
      totalCurrentValue: d.data().totalCurrentValue || 0,
      totalReturnPct:    d.data().totalReturnPct || 0,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createPortfolio(name: string): Promise<string> {
  const ref = await addDoc(collection(db, COLL), {
    name,
    holdings: [],
    totalCurrentValue: 0,
    totalInvested: 0,
    totalPnl: 0,
    totalReturnPct: 0,
    uploadedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export function subscribePortfolio(id: string, cb: (p: Portfolio | null) => void): () => void {
  return onSnapshot(doc(db, COLL, id), snap => {
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Portfolio) : null);
  });
}

export function subscribeAllPortfolios(cb: (list: Portfolio[]) => void): () => void {
  return onSnapshot(collection(db, COLL), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Portfolio)));
  });
}

export async function savePortfolio(id: string, data: Omit<Portfolio, 'id'>): Promise<void> {
  await setDoc(doc(db, COLL, id), sanitize(data), { merge: true });
}

export async function updateHolding(portfolioId: string, symbol: string, updates: Partial<Holding>): Promise<void> {
  const ref  = doc(db, COLL, portfolioId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const portfolio = snap.data() as Portfolio;
  const holdings  = portfolio.holdings.map(h => {
    if (h.symbol !== symbol) return h;
    const merged = { ...h, ...updates };
    merged.investedValue = merged.avgPurchasePrice * merged.quantity;
    merged.currentValue  = merged.currentPrice     * merged.quantity;
    merged.pnl           = merged.currentValue - merged.investedValue;
    merged.returnPct     = merged.investedValue !== 0 ? (merged.pnl / merged.investedValue) * 100 : 0;
    return merged;
  });

  await updateDoc(ref, sanitize({ holdings, ...recalcTotals(holdings) }));
}

/** 체크박스로 선택한 종목들 일괄 삭제 */
export async function deleteHoldings(portfolioId: string, symbols: string[]): Promise<void> {
  const ref  = doc(db, COLL, portfolioId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const portfolio = snap.data() as Portfolio;
  const remaining = portfolio.holdings.filter(h => !symbols.includes(h.symbol));

  await updateDoc(ref, sanitize({ holdings: remaining, ...recalcTotals(remaining) }));
}

export async function deletePortfolio(id: string): Promise<void> {
  await deleteDoc(doc(db, COLL, id));
}

export async function saveHoldings(
  portfolioId: string,
  holdings: Holding[],
  name?: string,
): Promise<void> {
  const update: Record<string, unknown> = {
    holdings,
    ...recalcTotals(holdings),
    uploadedAt: new Date().toISOString(),
  };
  if (name) update.name = name;

  // sanitize로 undefined 제거 후 저장
  await setDoc(doc(db, COLL, portfolioId), sanitize(update), { merge: true });
}
