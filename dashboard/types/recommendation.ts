export type MarketPhase = '초기상승' | '상승' | '고점경계' | '하락' | '바닥' | '회복';
export type AllocationDirection = '확대' | '신규' | '유지' | '축소' | '제외';
export type StockAction = '매수' | '홀딩' | '매도';

export interface SectorAllocation {
  sector: string;
  weight: number;
  direction: AllocationDirection;
  reason: string;
}

export interface StockPick {
  name: string;
  symbol: string;
  sector: string;
  action: StockAction;
  reason: string;
}

export interface Recommendation {
  date: string;
  market_phase: MarketPhase;
  confidence: number;
  rationale: string;
  sector_allocation: SectorAllocation[];
  stock_picks: StockPick[];
  risks: string[];
  created_at?: string;
}
