'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { SpotInsightCard } from './SpotInsightCard';
import { deleteSpotEntry } from '@/lib/spotFirebase';
import type { SpotEntry } from '@/types/spot';
import { cn } from '@/lib/utils';

interface Props { entries: SpotEntry[] }

const JUDGE_COLOR: Record<string, string> = {
  상승: 'text-up', 하락: 'text-down', 보합: 'text-neutral', 횡보: 'text-neutral',
};

export function SpotHistory({ entries }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm('이 기록을 삭제하시겠습니까?')) return;
    await deleteSpotEntry(id);
    if (expanded === id) setExpanded(null);
  }

  if (entries.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <p className="text-muted-foreground text-sm">아직 분석 기록이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-muted-foreground">
          날짜별 히스토리 <span className="text-muted-foreground/50">({entries.length}건)</span>
        </h2>
      </div>

      <div className="divide-y divide-border">
        {entries.map(entry => {
          const id       = entry.id ?? entry.date;
          const isOpen   = expanded === id;
          const analysis = entry.analysis;

          return (
            <div key={id}>
              {/* 헤더 행 */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpanded(isOpen ? null : id)}
              >
                {isOpen
                  ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                }

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{entry.date}</span>
                    <span className="text-xs text-muted-foreground">{entry.time}</span>
                    {analysis && (
                      <>
                        <span className={cn('text-xs font-bold', JUDGE_COLOR[analysis.market_judge])}>
                          {analysis.market_judge}
                        </span>
                        {analysis.target_index && (
                          <span className="text-xs text-muted-foreground/60">{analysis.target_index}</span>
                        )}
                      </>
                    )}
                  </div>
                  {analysis && (
                    <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{analysis.insight}</p>
                  )}
                </div>

                <button
                  className="text-muted-foreground hover:text-down p-1 shrink-0"
                  onClick={e => handleDelete(e, id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 상세 내용 */}
              {isOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-border/50 bg-muted/10">
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-1">원문</p>
                    <pre className="text-xs text-foreground/70 bg-muted/50 rounded-lg px-3 py-2 whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {entry.content}
                    </pre>
                  </div>
                  {analysis && <SpotInsightCard analysis={analysis} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
