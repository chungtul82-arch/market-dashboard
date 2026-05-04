import { NextResponse } from 'next/server';

const SECTOR_MAP: Record<string, string> = {
  'Technology':               '기술·IT',
  'Healthcare':               '헬스케어',
  'Financials':               '금융',
  'Financial Services':       '금융서비스',
  'Consumer Discretionary':   '경기소비재',
  'Consumer Cyclical':        '경기소비재',
  'Consumer Staples':         '필수소비재',
  'Consumer Defensive':       '필수소비재',
  'Industrials':              '산업재',
  'Industrial Goods':         '산업재',
  'Energy':                   '에너지',
  'Materials':                '소재',
  'Basic Materials':          '소재',
  'Real Estate':              '부동산',
  'Utilities':                '유틸리티',
  'Communication Services':   '통신서비스',
  'Communication':            '통신서비스',
  'Defense':                  '방산',
  'Semiconductors':           '반도체',
};

async function fetchStockInfo(symbol: string): Promise<{ name: string; sector: string }> {
  const headers = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' };

  try {
    // 종목명 조회
    const chartRes = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      { headers, next: { revalidate: 3600 } },
    );
    const chartData = await chartRes.json();
    const meta      = chartData?.chart?.result?.[0]?.meta ?? {};
    const name      = meta.shortName || meta.longName || symbol;

    // 섹터 조회
    let sector = '기타';
    try {
      const profRes = await fetch(
        `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=assetProfile`,
        { headers, next: { revalidate: 86400 } },
      );
      if (profRes.ok) {
        const profData = await profRes.json();
        const profile  = profData?.quoteSummary?.result?.[0]?.assetProfile ?? {};
        const raw      = profile.sector || profile.industry || '';
        sector         = SECTOR_MAP[raw] || (raw ? raw : '기타');
      }
    } catch { /* 섹터 실패 시 기타 */ }

    return { name, sector };
  } catch {
    return { name: symbol, sector: '기타' };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get('symbols') || '').split(',').filter(Boolean).slice(0, 30);

  if (symbols.length === 0) return NextResponse.json({});

  const results = await Promise.allSettled(
    symbols.map(s => fetchStockInfo(s).then(info => [s, info] as [string, typeof info]))
  );

  const data: Record<string, { name: string; sector: string }> = {};
  results.forEach(r => {
    if (r.status === 'fulfilled') data[r.value[0]] = r.value[1];
  });

  return NextResponse.json(data);
}
