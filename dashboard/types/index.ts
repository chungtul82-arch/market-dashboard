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
  signal: '강세 진입' | '이탈 경고' | '단기 과열';
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
}

export interface Snapshot {
  date: string;
  updated_at: { seconds: number; nanoseconds: number } | null;
  market_indices?: MarketIndices;
  sectors: Record<string, SectorData>;
  signals: Signal[];
  summary?: Summary;
}
