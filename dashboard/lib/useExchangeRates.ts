'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface ExchangeRates {
  usd_krw: number;   // 1 USD = ? KRW
  cny_krw: number;   // 1 CNY = ? KRW
  updatedAt?: string;
}

export const DEFAULT_RATES: ExchangeRates = {
  usd_krw: 1380,
  cny_krw: 190,
};

export function useExchangeRates(): ExchangeRates {
  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_RATES);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'reports', 'latest'), snap => {
      if (!snap.exists()) return;
      const indices = snap.data()?.market_indices ?? {};
      setRates({
        usd_krw:   indices.usd_krw?.value ?? DEFAULT_RATES.usd_krw,
        cny_krw:   indices.cny_krw?.value ?? DEFAULT_RATES.cny_krw,
        updatedAt: snap.data()?.date,
      });
    });
    return () => unsub();
  }, []);

  return rates;
}

/** 현지 통화 금액 → 원화 변환 */
export function toKRW(
  amount: number,
  currency: 'KRW' | 'USD' | 'RMB' | undefined,
  rates: ExchangeRates,
): number {
  if (currency === 'USD') return amount * rates.usd_krw;
  if (currency === 'RMB') return amount * rates.cny_krw;
  return amount;
}

/** 통화 기호 */
export const CURRENCY_SYMBOL: Record<string, string> = {
  KRW: '₩',
  USD: '$',
  RMB: '¥',
};
