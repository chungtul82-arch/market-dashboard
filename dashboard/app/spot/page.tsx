'use client';

import { useEffect, useState } from 'react';
import { SpotInputPanel }  from '@/components/spot/SpotInputPanel';
import { SpotHistory }     from '@/components/spot/SpotHistory';
import { BasketMonitor }   from '@/components/spot/BasketMonitor';
import { getBasketStocks, subscribeSpotHistory } from '@/lib/spotFirebase';
import type { BasketStock, SpotEntry } from '@/types/spot';

export default function SpotPage() {
  const [basketStocks, setBasketStocks] = useState<BasketStock[]>([]);
  const [history,      setHistory]      = useState<SpotEntry[]>([]);

  useEffect(() => {
    getBasketStocks().then(setBasketStocks);
    const unsub = subscribeSpotHistory(setHistory);
    return () => unsub();
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl md:text-2xl font-bold">🔍 스팟 시황</h1>
          <p className="text-xs text-muted-foreground mt-0.5">박병창 스팟 시황 AI 분석 & 바스켓 모니터링</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 좌측 — 바스켓 모니터링 */}
          <div className="lg:col-span-1">
            <BasketMonitor />
          </div>

          {/* 우측 — 입력 + 히스토리 */}
          <div className="lg:col-span-2 space-y-5">
            <SpotInputPanel
              basketStocks={basketStocks}
              onSaved={() => getBasketStocks().then(setBasketStocks)}
            />
            <SpotHistory entries={history} />
          </div>
        </div>
      </div>
    </main>
  );
}
