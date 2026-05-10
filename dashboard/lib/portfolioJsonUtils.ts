import type { Holding } from '@/types';

interface RawHolding {
  symbol: string;
  quantity: number | string;
  avg_price: number | string;
  market?: 'KOSPI' | 'KOSDAQ';
}

function padCode(s: string) {
  return /^\d+$/.test(s) ? s.padStart(6, '0') : s;
}

/** 배열 또는 {holdings:[...]} 형식 모두 수용 */
export function parsePortfolioJson(raw: string): { name: string; holdings: Holding[] } {
  const parsed = JSON.parse(raw);

  const rawList: RawHolding[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.holdings)
    ? parsed.holdings
    : (() => { throw new Error('JSON 배열 또는 {"holdings":[...]} 형식이 필요합니다'); })();

  const name = (!Array.isArray(parsed) && parsed?.name?.trim()) || '내 포트폴리오';

  const holdings: Holding[] = rawList
    .filter(h => h.symbol && Number(h.quantity) > 0 && Number(h.avg_price) > 0)
    .map(h => {
      const code = padCode(String(h.symbol).trim());
      const qty  = Number(h.quantity);
      const avg  = Number(h.avg_price);
      return {
        symbol:           code,
        name:             code,
        quantity:         qty,
        avgPurchasePrice: avg,
        sector:           '',
        market:           h.market,
        currentPrice:     0,
        currentValue:     0,
        investedValue:    qty * avg,
        pnl:              0,
        returnPct:        0,
        dailyChange:      0,
        dailyChangePct:   0,
        addedDate:        new Date().toISOString().slice(0, 10),
      };
    });

  return { name, holdings };
}

export const PROMPT_TEMPLATE = `아래 계좌 잔고 데이터를 JSON 배열로 변환해줘.

출력 형식 (JSON 배열만, 마크다운·설명 없이):
[
  {"symbol": "005930", "quantity": 100, "avg_price": 68000},
  {"symbol": "000660", "quantity": 50,  "avg_price": 175000}
]

필드 규칙:
- symbol : 6자리 KRX 종목코드 (앞에 0 포함, 예 "005930")
- quantity: 보유 수량 (정수)
- avg_price: 매입평균가 원화 (정수, 소수점 제거)

계좌 잔고:
`;
