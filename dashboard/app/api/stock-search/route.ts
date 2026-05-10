import { NextResponse } from 'next/server';

const H = { 'User-Agent': 'Mozilla/5.0 (compatible; MarketDash/1.0)', Accept: 'application/json' };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  if (!q.trim()) return NextResponse.json([]);

  try {
    const url =
      `https://query2.finance.yahoo.com/v1/finance/search` +
      `?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&listsCount=0&lang=ko&region=KR`;

    const res = await fetch(url, { headers: H, next: { revalidate: 30 } });
    if (!res.ok) return NextResponse.json([]);

    const data = await res.json();
    const results = (data?.quotes ?? [])
      .filter((q: { quoteType?: string }) => ['EQUITY', 'ETF'].includes(q.quoteType ?? ''))
      .map((q: { symbol: string; shortname?: string; longname?: string; exchDisp?: string }) => ({
        symbol: q.symbol,
        name:   q.shortname || q.longname || q.symbol,
        market: q.exchDisp ?? '',
      }))
      .slice(0, 8);

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
