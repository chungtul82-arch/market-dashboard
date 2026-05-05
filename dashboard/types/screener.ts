export type ScreenerGrade = 'A' | 'B';
export type BuyPattern = 'B1' | 'B2' | 'B3' | null;

export interface ScreenerStock {
  ticker: string;
  name: string;
  market: 'KOSPI' | 'KOSDAQ';
  sector_krx: string;
  sector_mapped: string;

  current_price: number;
  change_pct: number;
  volume: number;
  volume_ratio: number;

  ma5: number;
  ma20: number;
  ma60: number | null;
  ma_alignment: boolean;

  high_52w: number;
  high_52w_ratio: number;
  near_52w_high: boolean;

  foreign_buy_streak: number;
  institution_buy_streak: number;

  buy_pattern: BuyPattern;
  sector_strength: number;

  score_a: number;
  score_b: number;
  score_c: number;
  score_d: number;
  total_score: number;
  grade: ScreenerGrade;

  signals: string[];
  price_history: number[];
}

export interface ScreenerData {
  date: string;
  updated_at: string;
  total_scanned: number;
  grade_a_count: number;
  grade_b_count: number;
  results: ScreenerStock[];
}

export interface ScreenerFilter {
  grade: 'ALL' | 'A' | 'B';
  market: 'ALL' | 'KOSPI' | 'KOSDAQ';
  sector: string;
  pattern: 'ALL' | 'B1' | 'B2' | 'B3' | 'none';
  sortBy: 'total_score' | 'change_pct' | 'volume_ratio' | 'sector_strength';
}
