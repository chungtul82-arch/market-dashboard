import type { BuyPattern } from '@/types/screener';

const PATTERNS: Record<NonNullable<BuyPattern>, { label: string; desc: string; color: string }> = {
  B1: { label: 'B1 눌림', desc: '5일선 눌림 매수 타이밍', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  B2: { label: 'B2 양봉', desc: '눌림 후 거래량 양봉', color: 'bg-green-500/15 text-green-400 border-green-500/30' },
  B3: { label: 'B3 반등', desc: '20일선 이탈 후 회복', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
};

export function PatternBadge({ pattern }: { pattern: BuyPattern }) {
  if (!pattern) return null;
  const p = PATTERNS[pattern];
  return (
    <span
      title={p.desc}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${p.color}`}
    >
      {p.label}
    </span>
  );
}
