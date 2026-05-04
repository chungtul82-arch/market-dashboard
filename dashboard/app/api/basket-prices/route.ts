import { NextResponse } from 'next/server';

const HEADERS = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };

async function fetchPrice(symbol: string) {
  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=7d`,
      { headers: HEADERS, next: { revalidate: 300 } },
    );
    if (!res.ok) return null;

    const data   = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta      = result.meta ?? {};
    const closes    = (result.indicators?.quote?.[0]?.close ?? []) as (number | null)[];
    const validClose = closes.filter((v): v is number => v !== null);

    const price     = meta.regularMarketPrice ?? 0;
    const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
    const change    = price - prevClose;

    return {
      price:     Math.round(price * 100) / 100,
      prevClose: Math.round(prevClose * 100) / 100,
      change:    Math.round(change * 100) / 100,
      changePct: prevClose ? Math.round((change / prevClose) * 10000) / 100 : 0,
      history:   validClose.slice(-5).map(v => Math.round(v * 100) / 100),
      name:      meta.shortName || meta.longName || symbol,
      isOpen:    meta.marketState === 'REGULAR',
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get('symbols') || '').split(',').filter(Boolean).slice(0, 40);

  if (symbols.length === 0) return NextResponse.json({});

  const settled = await Promise.allSettled(
    symbols.map(s => fetchPrice(s).then(d => [s, d] as [string, Awaited<ReturnType<typeof fetchPrice>>])),
  );

  const out: Record<string, NonNullable<Awaited<ReturnType<typeof fetchPrice>>>> = {};
  settled.forEach(r => {
    if (r.status === 'fulfilled' && r.value[1]) out[r.value[0]] = r.value[1];
  });

  return NextResponse.json(out);
}
