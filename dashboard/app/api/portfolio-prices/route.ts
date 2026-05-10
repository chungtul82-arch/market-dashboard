import { NextResponse } from 'next/server';

const H = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };

async function fetchKRXPrice(symbol: string, market?: string) {
  const candidates =
    market === 'KOSDAQ' ? [`${symbol}.KQ`] :
    market === 'KOSPI'  ? [`${symbol}.KS`] :
    [`${symbol}.KS`, `${symbol}.KQ`];

  for (const sym of candidates) {
    try {
      const r = await fetch(
        `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`,
        { headers: H, next: { revalidate: 300 } },
      );
      if (!r.ok) continue;
      const d    = await r.json();
      const meta = d?.chart?.result?.[0]?.meta ?? {};
      const price = meta.regularMarketPrice ?? 0;
      if (!price) continue;
      const prev = meta.previousClose ?? meta.chartPreviousClose ?? price;
      return {
        price:     Math.round(price),
        changePct: prev ? Math.round(((price - prev) / prev) * 10000) / 100 : 0,
        name:      meta.shortName || meta.longName || symbol,
        market:    (sym.endsWith('.KQ') ? 'KOSDAQ' : 'KOSPI') as 'KOSPI' | 'KOSDAQ',
      };
    } catch { continue; }
  }
  return null;
}

async function fetchHistory(yfsym: string) {
  try {
    const r = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${yfsym}?interval=1d&range=1y`,
      { headers: H, next: { revalidate: 3600 } },
    );
    if (!r.ok) return null;
    const d   = await r.json();
    const res = d?.chart?.result?.[0];
    if (!res) return null;

    const ts:     number[]          = res.timestamp ?? [];
    const closes: (number | null)[] = res.indicators?.quote?.[0]?.close ?? [];

    const pts: { date: string; raw: number }[] = [];
    for (let i = 0; i < ts.length; i++) {
      if (closes[i] != null)
        pts.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), raw: closes[i]! });
    }
    if (!pts.length) return null;

    const base = pts[0].raw;
    return pts.map(p => ({ date: p.date, v: Math.round((p.raw / base) * 10000) / 100 }));
  } catch { return null; }
}

export async function POST(request: Request) {
  const { symbols = [], markets = {} } = await request.json();

  const [priceResults, kospi, nasdaq100] = await Promise.all([
    Promise.allSettled(
      (symbols as string[]).map(s =>
        fetchKRXPrice(s, (markets as Record<string, string>)[s]).then(d => [s, d] as const),
      ),
    ),
    fetchHistory('^KS11'),
    fetchHistory('^NDX'),
  ]);

  const prices: Record<string, NonNullable<Awaited<ReturnType<typeof fetchKRXPrice>>>> = {};
  priceResults.forEach(r => {
    if (r.status === 'fulfilled' && r.value[1]) prices[r.value[0]] = r.value[1];
  });

  return NextResponse.json({ prices, benchmarks: { kospi, nasdaq100 } });
}
