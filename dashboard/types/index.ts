export interface SectorData {
  return_5d: number;
  return_20d: number;
  return_60d: number;
  rs_score: number;
  pct_return_5d: number;
  pct_return_20d: number;
  pct_return_60d: number;
  foreign_net_buy?: number;
}

export interface Signal {
  sector: string;
  signal: '강세 진입' | '이탈 경고' | '단기 과열' | '저점 반등';
  value: number;
}

export interface Summary {
  top_sector: string;
  bottom_sector: string;
  signal_count: number;
  market_trend?: '상승' | '하락';
  kospi_return_5d?: number;
}

export interface MarketIndex {
  value: number;
  change_pct: number;
  history: number[];
  label?: string;  // VIX: 공포 | 중립 | 탐욕
}

export interface MarketIndices {
  kospi?:   MarketIndex;
  kosdaq?:  MarketIndex;
  vix?:     MarketIndex;
  usd_krw?: MarketIndex;
  cny_krw?: MarketIndex;
  wti?:     MarketIndex;
  us10y?:   MarketIndex;
}

export interface TopVolumeStock {
  ticker:      string;
  name:        string;
  market:      string;
  close:       number;
  change_pct:  number;
  volume:      number;
  trade_value: number;
}

export interface Snapshot {
  date: string;
  updated_at: { seconds: number; nanoseconds: number } | null;
  market_indices?: MarketIndices;
  sectors: Record<string, SectorData>;
  signals: Signal[];
  summary?: Summary;
  top_volume?: TopVolumeStock[];
}

export interface Holding {
  symbol: string;
  name?: string;
  sector?: string;
  theme?: string;
  market?: 'KOSPI' | 'KOSDAQ';
  country?: string;
  currency?: 'KRW' | 'USD' | 'RMB';
  currentPrice: number;
  avgPurchasePrice: number;
  quantity: number;
  currentValue: number;
  investedValue: number;
  pnl: number;
  returnPct: number;
  dailyChange: number;
  dailyChangePct: number;
  addedDate?: string;
}

export interface Portfolio {
  id?: string;
  name: string;
  holdings: Holding[];
  totalCurrentValue: number;
  totalInvested: number;
  totalPnl: number;
  totalReturnPct: number;
  uploadedAt: string;
  createdAt?: string;
  pricesUpdatedAt?: string;
}

export interface PortfolioMeta {
  id: string;
  name: string;
  createdAt: string;
  totalCurrentValue: number;
  totalReturnPct: number;
}
