import type { Holding, Portfolio } from '@/types';

export function parsePortfolioCSV(text: string): Portfolio {
  // 탭 또는 연속 공백으로 분리
  const lines = text.trim().split('\n').filter(l => l.trim());
  const headers = lines[0].split('\t').map(h => h.trim());

  const rows = lines.slice(1).map(line => {
    const values = line.split('\t').map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });

  // 심볼별 그룹핑
  const grouped = new Map<string, typeof rows>();
  rows.forEach(row => {
    const symbol = row['Symbol'];
    if (!symbol) return;
    if (!grouped.has(symbol)) grouped.set(symbol, []);
    grouped.get(symbol)!.push(row);
  });

  const holdings: Holding[] = [];

  grouped.forEach((lots, symbol) => {
    // 수량 0 제외
    const active = lots.filter(l => parseFloat(l['Quantity'] || '0') > 0);
    if (active.length === 0) return;

    const currentPrice    = parseFloat(active[0]['Current Price'] || '0');
    const dailyChange     = parseFloat(active[0]['Change'] || '0');
    const prevPrice       = currentPrice - dailyChange;
    const dailyChangePct  = prevPrice !== 0 ? (dailyChange / prevPrice) * 100 : 0;

    const totalQty  = active.reduce((s, l) => s + parseFloat(l['Quantity'] || '0'), 0);
    const totalCost = active.reduce((s, l) => {
      const qty   = parseFloat(l['Quantity'] || '0');
      const price = parseFloat(l['Purchase Price'] || '0');
      return s + qty * price;
    }, 0);

    const avgPurchasePrice = totalCost / totalQty;
    const currentValue     = currentPrice * totalQty;
    const investedValue    = avgPurchasePrice * totalQty;
    const pnl              = currentValue - investedValue;
    const returnPct        = investedValue !== 0 ? (pnl / investedValue) * 100 : 0;

    holdings.push({
      symbol,
      currentPrice,
      avgPurchasePrice,
      quantity: totalQty,
      currentValue,
      investedValue,
      pnl,
      returnPct,
      dailyChange,
      dailyChangePct,
    });
  });

  holdings.sort((a, b) => b.currentValue - a.currentValue);

  const totalCurrentValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalInvested     = holdings.reduce((s, h) => s + h.investedValue, 0);
  const totalPnl          = totalCurrentValue - totalInvested;
  const totalReturnPct    = totalInvested !== 0 ? (totalPnl / totalInvested) * 100 : 0;

  return { holdings, totalCurrentValue, totalInvested, totalPnl, totalReturnPct, uploadedAt: new Date().toISOString() };
}
