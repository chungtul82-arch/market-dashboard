import type { ScreenerStock } from '@/types/screener';
import { PatternBadge } from './PatternBadge';

function Sparkline({ prices }: { prices: number[] }) {
  if (prices.length < 2) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 60, h = 28, pad = 2;
  const pts = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const last = prices[prices.length - 1];
  const first = prices[0];
  const rising = last >= first;
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={pts} fill="none" stroke={rising ? '#34d399' : '#f87171'} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-4">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium w-4 text-right">{value}</span>
    </div>
  );
}

export function StockCard({ stock }: { stock: ScreenerStock }) {
  const gradeA = stock.grade === 'A';
  const chgPos = stock.change_pct >= 0;

  return (
    <div className={`rounded-xl border bg-card p-4 flex flex-col gap-3 hover:border-[#6366f1]/40 transition-colors ${gradeA ? 'border-emerald-500/40' : 'border-border'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${gradeA ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}
            >
              {stock.grade}등급
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{stock.market}</span>
            <PatternBadge pattern={stock.buy_pattern} />
          </div>
          <p className="mt-1 font-semibold text-sm text-foreground truncate">{stock.name}</p>
          <p className="text-xs text-muted-foreground">{stock.ticker} · {stock.sector_mapped || stock.sector_krx}</p>
        </div>
        <Sparkline prices={stock.price_history} />
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold">{stock.current_price.toLocaleString()}원</span>
        <span className={`text-sm font-medium ${chgPos ? 'text-emerald-400' : 'text-red-400'}`}>
          {chgPos ? '+' : ''}{stock.change_pct.toFixed(2)}%
        </span>
        <span className="text-xs text-muted-foreground ml-auto">거래량 {stock.volume_ratio.toFixed(1)}배</span>
      </div>

      {/* Score bars */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs text-muted-foreground">총점</span>
          <span className="text-sm font-bold text-[#6366f1]">{stock.total_score}점</span>
        </div>
        <ScoreBar label="A" value={stock.score_a} max={6} color="bg-violet-500" />
        <ScoreBar label="B" value={stock.score_b} max={3} color="bg-blue-500" />
        <ScoreBar label="C" value={stock.score_c} max={4} color="bg-emerald-500" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-4">D</span>
          <span className={`text-xs font-medium ${stock.score_d > 0 ? 'text-emerald-400' : stock.score_d < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
            {stock.score_d > 0 ? '+' : ''}{stock.score_d} (섹터강도 {stock.sector_strength})
          </span>
        </div>
      </div>

      {/* Signals */}
      {stock.signals.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
          {stock.signals.map(s => (
            <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">{s}</span>
          ))}
        </div>
      )}

      {/* MA info */}
      <div className="grid grid-cols-3 gap-1 text-center text-xs text-muted-foreground border-t border-border pt-2">
        <div>
          <div className="font-medium text-foreground">{stock.ma5.toLocaleString()}</div>
          <div>MA5</div>
        </div>
        <div>
          <div className="font-medium text-foreground">{stock.ma20.toLocaleString()}</div>
          <div>MA20</div>
        </div>
        <div>
          <div className="font-medium text-foreground">{stock.ma60?.toLocaleString() ?? '-'}</div>
          <div>MA60</div>
        </div>
      </div>
    </div>
  );
}
