'use client';

import { useState } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';

interface GuruHolding {
  ticker: string; name: string; value_usd: number;
  weight_pct: number; sector: string; change_type: string;
}
interface GuruPortfolio {
  guru: string; report_date: string; total_value_usd: number;
  sector_weights: Record<string, number>;
  holdings: GuruHolding[];
}
interface Props {
  guruPortfolios: Record<string, GuruPortfolio> | null;
  mySectorWeights: Record<string, number>;
}

const RADAR_SECTORS = [
  'AI·반도체', '바이오', '증권·금융', '소비재', '소부장',
  '중공업·조선', '전력·원자력', '미디어·통신', '필수소비재', '기타',
];

const GRADE_COLOR: Record<string, string> = {
  '80+': 'text-green-400', '60~80': 'text-yellow-400', '~60': 'text-muted-foreground',
};

function alignmentColor(score: number) {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-muted-foreground';
}

function alignmentBg(score: number) {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  return 'bg-muted-foreground/40';
}

function calcAlignment(myWeights: Record<string, number>, guruWeights: Record<string, number>): number {
  const allSectors = new Set([...Object.keys(myWeights), ...Object.keys(guruWeights)]);
  let diff = 0;
  allSectors.forEach(s => {
    diff += Math.abs((myWeights[s] ?? 0) - (guruWeights[s] ?? 0));
  });
  return Math.max(0, Math.round(100 - diff / 2));
}

const CHANGE_ICON: Record<string, string> = {
  increased: '▲', decreased: '▼', new: '★', unchanged: '−',
};
const CHANGE_COLOR: Record<string, string> = {
  increased: 'text-up', decreased: 'text-down', new: 'text-blue-400', unchanged: 'text-muted-foreground',
};

export function GuruComparison({ guruPortfolios, mySectorWeights }: Props) {
  const gurus = guruPortfolios ? Object.values(guruPortfolios) : [];
  const [selectedGuru, setSelectedGuru] = useState(gurus[0]?.guru ?? '');

  const selected = gurus.find(g => g.guru === selectedGuru);

  // 레이더 데이터
  const radarData = RADAR_SECTORS.map(sector => ({
    sector,
    내포트폴리오: Math.round(mySectorWeights[sector] ?? 0),
    [selectedGuru ?? '거장']: Math.round(selected?.sector_weights?.[sector] ?? 0),
  }));

  // 최근 변화 집계
  const recentChanges = gurus.map(g => {
    const holdings = g.holdings ?? [];
    const increased = holdings.filter(h => h.change_type === 'increased').map(h => h.sector || h.name).slice(0, 2).join(', ') || '−';
    const decreased = holdings.filter(h => h.change_type === 'decreased').map(h => h.sector || h.name).slice(0, 2).join(', ') || '−';
    const newPos    = holdings.filter(h => h.change_type === 'new').map(h => h.name).slice(0, 2).join(', ') || '−';
    return { guru: g.guru, increased, decreased, new: newPos };
  });

  if (!guruPortfolios || gurus.length === 0) {
    return (
      <section className="bg-card rounded-xl border border-border p-6 space-y-3">
        <h2 className="text-base font-semibold">거장 포트폴리오 비교</h2>
        <p className="text-sm text-muted-foreground">
          매주 금요일 수집기가 실행되면 데이터가 표시됩니다.<br />
          GitHub Actions → <code>주간 포트폴리오 비교 데이터 수집</code> 워크플로우를 수동 실행해 주세요.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">거장 포트폴리오 비교</h2>

      {/* 레이더 차트 */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">섹터 비중 비교</p>
          <select
            className="text-xs bg-muted border border-border rounded px-2 py-1 text-foreground"
            value={selectedGuru}
            onChange={e => setSelectedGuru(e.target.value)}
          >
            {gurus.map(g => <option key={g.guru} value={g.guru}>{g.guru}</option>)}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="rgba(255,255,255,0.1)" />
            <PolarAngleAxis dataKey="sector" tick={{ fontSize: 11, fill: '#888' }} />
            <PolarRadiusAxis angle={90} domain={[0, 40]} tick={{ fontSize: 9, fill: '#555' }} />
            <Radar name="내 포트폴리오" dataKey="내포트폴리오" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
            <Radar name={selectedGuru} dataKey={selectedGuru} stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
            <Legend formatter={v => <span className="text-xs text-muted-foreground">{v}</span>} />
            <Tooltip
              formatter={(v, name) => [`${v}%`, name]}
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* 거장별 비교 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {gurus.map(g => {
          const score = calcAlignment(mySectorWeights, g.sector_weights ?? {});
          const myExcess   = RADAR_SECTORS.filter(s => (mySectorWeights[s] ?? 0) > (g.sector_weights?.[s] ?? 0) + 5);
          const guruExcess = RADAR_SECTORS.filter(s => (g.sector_weights?.[s] ?? 0) > (mySectorWeights[s] ?? 0) + 5);
          const common     = RADAR_SECTORS.filter(s => (mySectorWeights[s] ?? 0) > 5 && (g.sector_weights?.[s] ?? 0) > 5);

          return (
            <div key={g.guru} className="bg-card rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{g.guru}</p>
                <div className="text-right">
                  <p className={cn('text-lg font-bold font-num', alignmentColor(score))}>{score}점</p>
                  <p className="text-xs text-muted-foreground/60">일치도</p>
                </div>
              </div>

              {/* 일치도 바 */}
              <div className="w-full bg-muted rounded-full h-1.5">
                <div className={cn('h-1.5 rounded-full transition-all', alignmentBg(score))}
                     style={{ width: `${score}%` }} />
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                {common.length > 0 && (
                  <p>🤝 <span className="text-foreground">공통:</span> {common.slice(0, 3).join(', ')}</p>
                )}
                {myExcess.length > 0 && (
                  <p>📈 <span className="text-foreground">내가 더 많음:</span> {myExcess.slice(0, 2).join(', ')}</p>
                )}
                {guruExcess.length > 0 && (
                  <p>📉 <span className="text-foreground">{g.guru.split(' ')[0]}이 더 많음:</span> {guruExcess.slice(0, 2).join(', ')}</p>
                )}
              </div>

              {/* 상위 보유종목 */}
              {g.holdings && g.holdings.length > 0 && (
                <div className="border-t border-border pt-2 space-y-1">
                  {g.holdings.slice(0, 3).map(h => (
                    <div key={h.ticker || h.name} className="flex items-center justify-between text-xs">
                      <span className="text-foreground font-medium">{h.ticker || h.name.slice(0, 15)}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{h.weight_pct.toFixed(1)}%</span>
                        <span className={cn('font-num', CHANGE_COLOR[h.change_type] ?? 'text-muted-foreground')}>
                          {CHANGE_ICON[h.change_type] ?? ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground/50">최신 13F: {g.report_date}</p>
            </div>
          );
        })}
      </div>

      {/* 최근 변화 테이블 */}
      {recentChanges.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4 overflow-x-auto">
          <p className="text-sm font-semibold mb-3">최근 포지션 변화</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 px-3 text-muted-foreground font-medium">거장</th>
                <th className="text-left py-1.5 px-3 text-up font-medium">▲ 늘린 것</th>
                <th className="text-left py-1.5 px-3 text-down font-medium">▼ 줄인 것</th>
                <th className="text-left py-1.5 px-3 text-blue-400 font-medium">★ 신규</th>
              </tr>
            </thead>
            <tbody>
              {recentChanges.map(r => (
                <tr key={r.guru} className="border-t border-border">
                  <td className="py-2 px-3 font-medium text-foreground">{r.guru.split(' ')[0]}</td>
                  <td className="py-2 px-3 text-up">{r.increased}</td>
                  <td className="py-2 px-3 text-down">{r.decreased}</td>
                  <td className="py-2 px-3 text-blue-400">{r.new}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
