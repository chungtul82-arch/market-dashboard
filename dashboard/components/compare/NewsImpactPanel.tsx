'use client';

import { cn } from '@/lib/utils';

interface Article {
  title: string; source: string; url: string;
  published_at: string; themes: string[];
  sentiment?: 'positive' | 'negative' | 'neutral' | null;
}
interface Props {
  articles: Article[];
  mySectorWeights: Record<string, number>;
}

const EVENTS = [
  { date: '5/21', label: '엔비디아 실적', themes: ['AI·반도체'], impact: 'high' },
  { date: '5/28', label: '한국 CPI', themes: ['증권·금융'], impact: 'medium' },
  { date: '6/11', label: 'FOMC', themes: ['증권·금융', '금'], impact: 'high' },
  { date: '6/30', label: '분기말', themes: ['전체'], impact: 'medium' },
];

function timeAgo(isoStr: string): string {
  try {
    const diff = Date.now() - new Date(isoStr).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return `${Math.floor(diff / 60000)}분 전`;
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  } catch { return ''; }
}

function SentimentBadge({ sentiment, themes }: { sentiment?: string | null; themes: string[] }) {
  if (sentiment === 'positive') return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">✅ 긍정</span>
  );
  if (sentiment === 'negative') return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">⚠️ 부정</span>
  );
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">➡️ 중립</span>
  );
}

function ImpactDots({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3].map(i => (
        <span key={i} className={cn('text-xs', i <= level ? 'text-[#6366f1]' : 'text-muted-foreground/30')}>●</span>
      ))}
    </div>
  );
}

export function NewsImpactPanel({ articles, mySectorWeights }: Props) {
  // 테마별 그룹화
  const themeGroups: Record<string, Article[]> = {};
  articles.forEach(a => {
    (a.themes ?? ['기타']).forEach(t => {
      if (!themeGroups[t]) themeGroups[t] = [];
      if (!themeGroups[t].find(x => x.title === a.title)) themeGroups[t].push(a);
    });
  });

  // 내 보유 섹터 우선 정렬
  const sortedThemes = Object.keys(themeGroups).sort((a, b) => {
    const wa = mySectorWeights[a] ?? 0;
    const wb = mySectorWeights[b] ?? 0;
    return wb - wa;
  });

  const hasData = articles.length > 0;

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold">뉴스 영향 분석</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 뉴스 카드 */}
        <div className="lg:col-span-2 space-y-3">
          {!hasData ? (
            <div className="bg-card rounded-xl border border-border p-6">
              <p className="text-sm text-muted-foreground">뉴스 수집기 실행 후 데이터가 표시됩니다.</p>
            </div>
          ) : (
            sortedThemes.slice(0, 6).map(theme => {
              const myWt   = mySectorWeights[theme] ?? 0;
              const arts   = themeGroups[theme].slice(0, 2);
              const sentiment = arts[0]?.sentiment;
              const cardBg = sentiment === 'positive' ? 'border-green-800/40 bg-green-950/20'
                           : sentiment === 'negative' ? 'border-red-800/40 bg-red-950/20'
                           : 'border-border';
              return (
                <div key={theme} className={cn('rounded-xl border p-4 space-y-2', cardBg)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <SentimentBadge sentiment={sentiment} themes={[theme]} />
                      <span className="text-sm font-semibold text-foreground">{theme}</span>
                      {myWt > 0 && (
                        <span className="text-xs text-[#6366f1]">내 비중 {myWt.toFixed(1)}%</span>
                      )}
                    </div>
                    <ImpactDots level={myWt > 20 ? 3 : myWt > 8 ? 2 : 1} />
                  </div>
                  {arts.map((a, i) => (
                    <div key={i} className="text-sm">
                      <a href={a.url} target="_blank" rel="noopener noreferrer"
                         className="text-foreground hover:text-[#6366f1] transition-colors line-clamp-2">
                        {a.title}
                      </a>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.source} · {timeAgo(a.published_at)}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* 이벤트 캘린더 */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">주요 이벤트 캘린더</p>
          <div className="space-y-2">
            {EVENTS.map(ev => {
              const isMyTheme = ev.themes.some(t => (mySectorWeights[t] ?? 0) > 0 || t === '전체');
              return (
                <div key={ev.date + ev.label}
                     className={cn('flex gap-3 p-2 rounded-lg',
                       isMyTheme ? 'bg-[#6366f1]/10 border border-[#6366f1]/20' : 'bg-muted/30')}>
                  <div className="shrink-0 w-10 text-center">
                    <p className="text-xs font-bold text-[#6366f1]">{ev.date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground font-medium">{ev.label}</p>
                    <p className="text-xs text-muted-foreground">{ev.themes.join(' · ')}</p>
                  </div>
                  <div className="ml-auto shrink-0">
                    <span className={cn('text-xs',
                      ev.impact === 'high' ? 'text-red-400' : 'text-yellow-400')}>
                      {ev.impact === 'high' ? '🔴' : '🟡'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground/50">★ 보라 = 내 보유 섹터 관련 이벤트</p>
        </div>
      </div>
    </section>
  );
}
