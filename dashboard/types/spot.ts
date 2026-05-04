export type SpotAction = '홀딩' | '비중확대' | '비중축소' | '매수' | '매도';
export type MarketJudge = '상승' | '하락' | '보합' | '횡보';

export interface BasketStock {
  symbol: string;
  name: string;
  sector?: string;
  addedAt: string;
  comment?: string;
  commentDate?: string;
  action?: SpotAction;
}

export interface BasketPrice {
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  history: number[];
  name: string;
  isOpen: boolean;
}

export interface BasketAction {
  name: string;
  symbol: string;
  action: SpotAction;
  reason: string;
}

export interface CrossCheck {
  sector: string;
  match: boolean;
  detail: string;
}

export interface SpotAnalysis {
  insight: string;
  market_judge: MarketJudge;
  confidence: number;   // 1~5
  target_index: string;
  strong_sectors: string[];
  weak_sectors: string[];
  basket_actions: BasketAction[];
  risks: string[];
  cross_check: CrossCheck[];
}

export interface SpotEntry {
  id?: string;
  date: string;
  time: string;
  content: string;
  analysis?: SpotAnalysis;
  createdAt: string;
}
