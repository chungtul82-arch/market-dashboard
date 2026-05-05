'use client';

import type { ScreenerFilter as FilterState } from '@/types/screener';

interface Props {
  filter: FilterState;
  sectors: string[];
  onChange: (f: FilterState) => void;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
        active
          ? 'bg-[#6366f1]/15 text-[#6366f1] border-[#6366f1]/40'
          : 'bg-muted/40 text-muted-foreground border-transparent hover:border-border'
      }`}
    >
      {children}
    </button>
  );
}

export function ScreenerFilter({ filter, sectors, onChange }: Props) {
  const set = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    onChange({ ...filter, [k]: v });

  return (
    <div className="flex flex-col gap-3">
      {/* Grade */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground w-12 shrink-0">등급</span>
        {(['ALL', 'A', 'B'] as const).map(g => (
          <Chip key={g} active={filter.grade === g} onClick={() => set('grade', g)}>
            {g === 'ALL' ? '전체' : `${g}등급`}
          </Chip>
        ))}
      </div>

      {/* Market */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground w-12 shrink-0">시장</span>
        {(['ALL', 'KOSPI', 'KOSDAQ'] as const).map(m => (
          <Chip key={m} active={filter.market === m} onClick={() => set('market', m)}>
            {m === 'ALL' ? '전체' : m}
          </Chip>
        ))}
      </div>

      {/* Pattern */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground w-12 shrink-0">패턴</span>
        {(['ALL', 'B1', 'B2', 'B3', 'none'] as const).map(p => (
          <Chip key={p} active={filter.pattern === p} onClick={() => set('pattern', p)}>
            {p === 'ALL' ? '전체' : p === 'none' ? '패턴없음' : p}
          </Chip>
        ))}
      </div>

      {/* Sector */}
      {sectors.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground w-12 shrink-0">섹터</span>
          <Chip active={filter.sector === ''} onClick={() => set('sector', '')}>전체</Chip>
          {sectors.map(s => (
            <Chip key={s} active={filter.sector === s} onClick={() => set('sector', s)}>{s}</Chip>
          ))}
        </div>
      )}

      {/* Sort */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground w-12 shrink-0">정렬</span>
        {([
          ['total_score', '총점순'],
          ['change_pct', '등락률순'],
          ['volume_ratio', '거래량배율순'],
          ['sector_strength', '섹터강도순'],
        ] as const).map(([k, label]) => (
          <Chip key={k} active={filter.sortBy === k} onClick={() => set('sortBy', k)}>{label}</Chip>
        ))}
      </div>
    </div>
  );
}
