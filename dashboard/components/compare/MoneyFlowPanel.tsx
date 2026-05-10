'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';

interface USFlow {
  sector: string; top_etf: string; flow_index: number;
  price_7d_chg: number; vol_ratio: number; flow_direction: string;
}
interface KRFlow {
  sector: string; foreign_net_buy_5d: number;
  institution_net_buy_5d: number; flow_direction: string;
}
interface Props {
  moneyFlow: { date?: string; us_flows?: USFlow[]; kr_flows?: KRFlow[] } | null;
  mySectorWeights: Record<string, number>;
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean; label?: string;
  payload?: { value: number; payload: USFlow }[];
}) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs space-y-1">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground">대표 ETF: {p.top_etf}</p>
      <p className={p.flow_direction === 'inflow' ? 'text-up' : 'text-down'}>
        7일 수익률: {p.price_7d_chg >= 0 ? '+' : ''}{p.price_7d_chg?.toFixed(2)}%
      </p>
      <p className="text-muted-foreground">거래량 비율: {p.vol_ratio?.toFixed(2)}x</p>
    </div>
  );
};

export function MoneyFlowPanel({ moneyFlow, mySectorWeights }: Props) {
  if (!moneyFlow) {
    return (
      <section className="bg-card rounded-xl border border-border p-6 space-y-3">
        <h2 className="text-base font-semibold">글로벌 돈흐름</h2>
        <p className="text-sm text-muted-foreground">수집기 실행 후 데이터가 표시됩니다.</p>
      </section>
    );
  }

  const usFlows  = moneyFlow.us_flows ?? [];
  const krFlows  = moneyFlow.kr_flows ?? [];
  const hasMyPos = (sector: string) => (mySectorWeights[sector] ?? 0) > 3;

  const chartData = [...usFlows]
    .sort((a, b) => b.flow_index - a.flow_index)
    .map(f => ({ ...f, name: f.sector.slice(0, 8) }));

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">글로벌 돈흐름</h2>

      {/* 미국 ETF 자금흐름 바 차트 */}
      {usFlows.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">미국 섹터 ETF 7일 흐름</p>
            {moneyFlow.date && (
              <p className="text-xs text-muted-foreground/60">기준: {moneyFlow.date}</p>
            )}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tickFormatter={v => `${v > 0 ? '+' : ''}${v.toFixed(0)}`}
                tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#aaa' }}
                axisLine={false} tickLine={false} width={70} />
              <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="flow_index" radius={[0, 3, 3, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i}
                    fill={entry.flow_direction === 'inflow' ? '#22c55e' : entry.flow_direction === 'outflow' ? '#ef4444' : '#888'}
                    opacity={hasMyPos(entry.sector) ? 1 : 0.45}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground/50 mt-1">
            ★ 내 보유 섹터: 진한 막대 / 미보유: 연한 막대
          </p>
        </div>
      )}

      {/* 수급 일치도 테이블 */}
      <div className="bg-card rounded-xl border border-border p-4 overflow-x-auto">
        <p className="text-sm font-semibold mb-3">미국 ETF 수급 vs 내 포트폴리오</p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-muted-foreground font-medium">섹터</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">ETF 흐름</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">7일 수익률</th>
              <th className="text-right py-2 px-3 text-muted-foreground font-medium">내 비중</th>
              <th className="text-center py-2 px-3 text-muted-foreground font-medium">일치도</th>
            </tr>
          </thead>
          <tbody>
            {usFlows.map(f => {
              const myWt   = mySectorWeights[f.sector] ?? 0;
              const isIn   = f.flow_direction === 'inflow';
              const isOut  = f.flow_direction === 'outflow';
              const hasPos = myWt > 1;

              let badge = '';
              let badgeCls = '';
              if (isIn && hasPos)     { badge = '✅ 일치';    badgeCls = 'text-green-400'; }
              else if (isOut && hasPos) { badge = '⚠️ 역행';  badgeCls = 'text-yellow-400'; }
              else if (isIn && !hasPos) { badge = '💡 기회?'; badgeCls = 'text-blue-400'; }
              else                      { badge = '−';        badgeCls = 'text-muted-foreground/40'; }

              return (
                <tr key={f.sector} className="border-t border-border hover:bg-muted/20">
                  <td className="py-2 px-3 text-foreground font-medium">
                    {f.sector}
                    {hasMyPos(f.sector) && <span className="ml-1 text-[#6366f1]">★</span>}
                  </td>
                  <td className={cn('py-2 px-3 text-right font-num', isIn ? 'text-up' : isOut ? 'text-down' : 'text-muted-foreground')}>
                    {isIn ? '↑ 유입' : isOut ? '↓ 유출' : '중립'}
                  </td>
                  <td className={cn('py-2 px-3 text-right font-num', (f.price_7d_chg ?? 0) >= 0 ? 'text-up' : 'text-down')}>
                    {(f.price_7d_chg ?? 0) >= 0 ? '+' : ''}{(f.price_7d_chg ?? 0).toFixed(2)}%
                  </td>
                  <td className="py-2 px-3 text-right font-num text-muted-foreground">
                    {myWt > 0 ? `${myWt.toFixed(1)}%` : '−'}
                  </td>
                  <td className={cn('py-2 px-3 text-center font-medium', badgeCls)}>{badge}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 한국 수급 */}
      {krFlows.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-sm font-semibold mb-3">한국 투자자 수급</p>
          <div className="space-y-2">
            {krFlows.map(f => (
              <div key={f.sector} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{f.sector}</span>
                <div className="flex gap-4">
                  <span className={cn('font-num text-xs', (f.foreign_net_buy_5d ?? 0) >= 0 ? 'text-up' : 'text-down')}>
                    외국인 {(f.foreign_net_buy_5d ?? 0) >= 0 ? '+' : ''}{((f.foreign_net_buy_5d ?? 0) / 1e8).toFixed(1)}억
                  </span>
                  <span className={cn('font-num text-xs', (f.institution_net_buy_5d ?? 0) >= 0 ? 'text-up' : 'text-down')}>
                    기관 {(f.institution_net_buy_5d ?? 0) >= 0 ? '+' : ''}{((f.institution_net_buy_5d ?? 0) / 1e8).toFixed(1)}억
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
