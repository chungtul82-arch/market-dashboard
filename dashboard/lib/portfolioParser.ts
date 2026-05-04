import type { Holding, Portfolio } from '@/types';

function detectDelimiter(firstLine: string): string {
  const tabCount   = (firstLine.match(/\t/g)   || []).length;
  const commaCount = (firstLine.match(/,/g)    || []).length;
  return tabCount >= commaCount ? '\t' : ',';
}

function splitLine(line: string, delim: string): string[] {
  if (delim === ',') {
    // 쉼표 구분 + 따옴표 안의 쉼표 보호
    const result: string[] = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  }
  return line.split('\t').map(v => v.trim());
}

export function parsePortfolioCSV(raw: string): Portfolio {
  // BOM 제거 및 줄바꿈 정규화
  const text  = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').filter(l => l.trim());

  if (lines.length < 2) throw new Error('CSV 데이터가 부족합니다.');

  const delim   = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delim).map(h => h.replace(/"/g, '').trim());

  // 컬럼 인덱스 탐색 (대소문자 무관)
  function col(names: string[]): number {
    for (const name of names) {
      const idx = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  }

  const iSymbol   = col(['Symbol', 'Ticker']);
  const iCurPrice = col(['Current Price', 'Price', 'Last Price']);
  const iChange   = col(['Change', 'Price Change']);
  const iQty      = col(['Quantity', 'Shares', 'Qty']);
  const iPurchase = col(['Purchase Price', 'Avg Cost', 'Cost Basis', 'Average Cost']);

  if (iSymbol === -1) throw new Error(`Symbol 컬럼을 찾을 수 없습니다. 헤더: ${headers.join(', ')}`);

  const rows = lines.slice(1).map(line => splitLine(line, delim));

  // 심볼별 그룹핑
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const symbol = row[iSymbol]?.replace(/"/g, '').trim();
    if (!symbol) continue;
    if (!grouped.has(symbol)) grouped.set(symbol, []);
    grouped.get(symbol)!.push(row);
  }

  const holdings: Holding[] = [];

  grouped.forEach((lots, symbol) => {
    const getNum = (row: string[], idx: number) =>
      idx >= 0 ? parseFloat(row[idx]?.replace(/"/g, '').trim() || '0') || 0 : 0;

    // 수량 0 제외
    const active = lots.filter(r => getNum(r, iQty) > 0);
    if (active.length === 0) return;

    const currentPrice   = getNum(active[0], iCurPrice);
    const dailyChange    = getNum(active[0], iChange);
    const prevPrice      = currentPrice - dailyChange;
    const dailyChangePct = prevPrice !== 0 ? (dailyChange / prevPrice) * 100 : 0;

    const totalQty  = active.reduce((s, r) => s + getNum(r, iQty), 0);
    const totalCost = active.reduce((s, r) => {
      const qty   = getNum(r, iQty);
      const price = getNum(r, iPurchase);
      return s + qty * price;
    }, 0);

    const avgPurchasePrice = totalQty > 0 ? totalCost / totalQty : 0;
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

  return {
    name: '',
    holdings,
    totalCurrentValue,
    totalInvested,
    totalPnl,
    totalReturnPct,
    uploadedAt: new Date().toISOString(),
  };
}
