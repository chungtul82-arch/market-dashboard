import type { Holding } from '@/types';

interface RawHolding {
  symbol: string;
  name?: string;
  quantity: number | string;
  avg_price: number | string;
  sector?: string;
  theme?: string;
  market?: 'KOSPI' | 'KOSDAQ';
}

interface RawPortfolio {
  name?: string;
  holdings: RawHolding[];
}

export function parsePortfolioJson(raw: string): { name: string; holdings: Holding[] } {
  const parsed: RawPortfolio = JSON.parse(raw);
  if (!Array.isArray(parsed.holdings)) throw new Error('"holdings" 배열이 없습니다');

  const holdings: Holding[] = parsed.holdings
    .filter(h => h.symbol && Number(h.quantity) > 0 && Number(h.avg_price) > 0)
    .map(h => {
      const qty  = Number(h.quantity);
      const avg  = Number(h.avg_price);
      const invested = qty * avg;
      return {
        symbol:           String(h.symbol).trim(),
        name:             h.name?.trim() || String(h.symbol).trim(),
        quantity:         qty,
        avgPurchasePrice: avg,
        sector:           h.sector?.trim() ?? '',
        theme:            h.theme?.trim() ?? '',
        market:           h.market,
        currentPrice:     0,
        currentValue:     0,
        investedValue:    invested,
        pnl:              0,
        returnPct:        0,
        dailyChange:      0,
        dailyChangePct:   0,
        addedDate:        new Date().toISOString().slice(0, 10),
      };
    });

  return { name: parsed.name?.trim() || '내 포트폴리오', holdings };
}

export const PROMPT_TEMPLATE = `아래 JSON 형식으로 내 주식 포트폴리오를 만들어줘.

필수 필드:
- symbol: 종목코드 (예: "005930")
- quantity: 보유수량
- avg_price: 매입평단가 (원)

선택 필드:
- name: 종목명 (생략 시 자동조회)
- sector: 업종/섹터 (예: "AI·반도체", "바이오", "방산", "2차전지", "중공업·조선", "증권·금융")
- theme: 투자테마 (예: "AI반도체", "원자력", "K방산", "HBM")
- market: "KOSPI" 또는 "KOSDAQ"

출력 형식:
{
  "name": "포트폴리오 이름",
  "holdings": [
    {"symbol": "005930", "name": "삼성전자", "quantity": 100, "avg_price": 68000, "sector": "AI·반도체", "market": "KOSPI"},
    {"symbol": "000660", "name": "SK하이닉스", "quantity": 50, "avg_price": 175000, "sector": "AI·반도체", "market": "KOSPI"}
  ]
}

내 보유 종목:
[종목명/코드, 수량, 매입가를 여기에 붙여넣으세요]`;

export const JSON_TEMPLATE = `{
  "name": "내 포트폴리오",
  "holdings": [
    {
      "symbol": "005930",
      "name": "삼성전자",
      "quantity": 100,
      "avg_price": 68000,
      "sector": "AI·반도체",
      "market": "KOSPI"
    }
  ]
}`;
