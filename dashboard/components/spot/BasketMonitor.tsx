'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, RefreshCw, Search, X, ArrowUpDown } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { getBasketStocks, saveBasketStocks } from '@/lib/spotFirebase';
import type { BasketStock, BasketPrice } from '@/types/spot';
import { cn } from '@/lib/utils';

type SortKey = 'changePct' | 'name' | 'addedAt' | 'sector';

function isMarketOpen(): boolean {
  const now = new Date(Date.now() + 9 * 3600_000);
  const h = now.getUTCHours(), m = now.getUTCMinutes();
  const min = h * 60 + m;
  const dow = now.getUTCDay();
  return dow >= 1 && dow <= 5 && min >= 9 * 60 && min < 15 * 60 + 30;
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const chartData = data.map(v => ({ v }));
  return (
    <ResponsiveContainer width="100%" height={30}>
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="v" dot={false} strokeWidth={1.5}
              stroke={positive ? '#22c55e' : '#ef4444'} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function StockCard({
  stock, price, onRemove,
}: {
  stock: BasketStock;
  price?: BasketPrice;
  onRemove: () => void;
}) {
  const positive = (price?.changePct ?? 0) >= 0;
  const pct      = price?.changePct ?? 0;

  return (
    <div className="bg-card border border-border rounded-xl p-3 relative group">
      <button
        className="absolute top-2 right-2 text-muted-foreground/0 group-hover:text-muted-foreground/60 hover:text-down transition-colors"
        onClick={onRemove}
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start justify-between mb-1 pr-4">
        <div>
          <p className="font-medium text-foreground text-sm">{stock.name}</p>
          <p className="text-xs text-muted-foreground">{stock.symbol}</p>
        </div>
        {stock.sector && (
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{stock.sector}</span>
        )}
      </div>

      {price ? (
        <>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-lg font-bold font-num text-foreground">
              {price.price.toLocaleString()}
            </span>
            <span className={cn('text-sm font-num font-semibold', positive ? 'text-up' : 'text-down')}>
              {positive ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
            </span>
          </div>
          {price.history.length >= 2 && (
            <Sparkline data={price.history} positive={positive} />
          )}
        </>
      ) : (
        <div className="h-12 flex items-center">
          <div className="h-2 w-24 bg-muted animate-pulse rounded" />
        </div>
      )}

      {stock.comment && (
        <div className="mt-2 border-t border-border/50 pt-2">
          <p className="text-xs text-muted-foreground/70 italic">"{stock.comment}"</p>
          {stock.action && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded font-semibold',
                stock.action === '매수' || stock.action === '비중확대' ? 'bg-green-500/15 text-green-400' :
                stock.action === '매도' || stock.action === '비중축소' ? 'bg-red-500/15 text-red-400' :
                'bg-blue-500/15 text-blue-400',
              )}>
                {stock.action}
              </span>
              <span className="text-[10px] text-muted-foreground/50">{stock.commentDate}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 종목 검색
async function searchStocks(query: string): Promise<{ symbol: string; name: string }[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&lang=ko&region=KR`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    const data = await res.json();
    return (data?.quotes ?? [])
      .filter((q: { quoteType?: string }) => ['EQUITY', 'ETF'].includes(q.quoteType ?? ''))
      .map((q: { symbol: string; shortname?: string; longname?: string }) => ({
        symbol: q.symbol,
        name:   q.shortname || q.longname || q.symbol,
      }))
      .slice(0, 6);
  } catch { return []; }
}

export function BasketMonitor() {
  const [stocks,       setStocks]       = useState<BasketStock[]>([]);
  const [prices,       setPrices]       = useState<Record<string, BasketPrice>>({});
  const [sortKey,      setSortKey]      = useState<SortKey>('changePct');
  const [refreshing,   setRefreshing]   = useState(false);
  const [lastRefresh,  setLastRefresh]  = useState('');
  const [query,        setQuery]        = useState('');
  const [searchResult, setSearchResult] = useState<{ symbol: string; name: string }[]>([]);
  const [searching,    setSearching]    = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open = isMarketOpen();

  useEffect(() => { getBasketStocks().then(setStocks); }, []);

  const fetchPrices = useCallback(async (stks: BasketStock[]) => {
    if (stks.length === 0) return;
    setRefreshing(true);
    try {
      const symbols = stks.map(s => s.symbol).join(',');
      const res = await fetch(`/api/basket-prices?symbols=${symbols}`);
      const data = await res.json();
      setPrices(data);
      setLastRefresh(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
    } finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    fetchPrices(stocks);
    if (!open) return;
    const id = setInterval(() => fetchPrices(stocks), 5 * 60_000);
    return () => clearInterval(id);
  }, [stocks, open, fetchPrices]);

  // 검색 디바운스
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    if (!query.trim()) { setSearchResult([]); return; }
    setSearching(true);
    searchRef.current = setTimeout(async () => {
      const result = await searchStocks(query);
      setSearchResult(result);
      setSearching(false);
    }, 400);
  }, [query]);

  async function addStock(symbol: string, name: string) {
    if (stocks.find(s => s.symbol === symbol)) return;
    const updated = [...stocks, {
      symbol, name, addedAt: new Date().toISOString().slice(0, 10),
    }];
    setStocks(updated);
    await saveBasketStocks(updated);
    setQuery(''); setSearchResult([]);
    fetchPrices(updated);
  }

  async function removeStock(symbol: string) {
    const updated = stocks.filter(s => s.symbol !== symbol);
    setStocks(updated);
    await saveBasketStocks(updated);
  }

  const sorted = [...stocks].sort((a, b) => {
    if (sortKey === 'changePct') {
      return (prices[b.symbol]?.changePct ?? -999) - (prices[a.symbol]?.changePct ?? -999);
    }
    if (sortKey === 'name') return a.name.localeCompare(b.name);
    if (sortKey === 'sector') return (a.sector ?? '').localeCompare(b.sector ?? '');
    return b.addedAt.localeCompare(a.addedAt);
  });

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">바스켓 모니터링</h2>
          <p className="text-xs text-muted-foreground">
            {open ? '🟢 장중 · 5분 자동갱신' : '⚫ 장외 · 종가'}
            {lastRefresh && ` · ${lastRefresh}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="text-muted-foreground hover:text-foreground p-1"
            onClick={() => fetchPrices(stocks)}
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </button>
          <select
            className="text-xs bg-muted border border-border rounded px-2 py-1 text-muted-foreground"
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
          >
            <option value="changePct">등락률 순</option>
            <option value="name">종목명 순</option>
            <option value="addedAt">추가 순</option>
            <option value="sector">섹터별</option>
          </select>
        </div>
      </div>

      {/* 종목 검색 추가 */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="종목명 또는 티커 검색..."
              className="w-full bg-muted border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#6366f1]/50"
            />
          </div>
        </div>

        {/* 검색 결과 드롭다운 */}
        {(searchResult.length > 0 || searching) && (
          <div className="absolute top-full mt-1 left-0 right-0 z-20 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
            {searching && <p className="text-xs text-muted-foreground px-3 py-2">검색 중...</p>}
            {searchResult.map(r => (
              <button
                key={r.symbol}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center justify-between"
                onClick={() => addStock(r.symbol, r.name)}
              >
                <span className="text-foreground">{r.name}</span>
                <span className="text-xs text-muted-foreground font-num">{r.symbol}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 종목 카드 그리드 */}
      {sorted.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-6 text-center">
          <p className="text-muted-foreground text-sm">종목을 검색해서 바스켓에 추가하세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {sorted.map(stock => (
            <StockCard
              key={stock.symbol}
              stock={stock}
              price={prices[stock.symbol]}
              onRemove={() => removeStock(stock.symbol)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
