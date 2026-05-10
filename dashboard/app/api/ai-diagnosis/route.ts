import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const SYSTEM = `당신은 최고의 포트폴리오 분석 전문가입니다.
투자 거장들의 포트폴리오, 글로벌 자금 흐름, 시장 뉴스를 바탕으로
개인 투자자의 포트폴리오를 객관적으로 진단합니다.
반드시 순수 JSON만 출력하세요. 마크다운 없이.`;

function buildPrompt(body: Record<string, unknown>): string {
  const { myPortfolio, guruPortfolios, moneyFlow, news } = body as {
    myPortfolio: { holdings?: { sector?: string; currentValue?: number; name?: string }[]; name?: string } | null;
    guruPortfolios: Record<string, { sector_weights?: Record<string, number>; report_date?: string }> | null;
    moneyFlow: { us_flows?: { sector: string; flow_direction: string; price_7d_chg?: number }[]; kr_flows?: { sector: string; foreign_net_buy_5d?: number }[] } | null;
    news: { title: string; themes?: string[]; source?: string }[] | null;
  };

  // 내 포트폴리오 섹터 비중
  const holdings = myPortfolio?.holdings ?? [];
  const totalVal = holdings.reduce((s, h) => s + (h.currentValue ?? 0), 0);
  const sectorMap: Record<string, number> = {};
  holdings.forEach(h => {
    const sec = h.sector || '기타';
    sectorMap[sec] = (sectorMap[sec] ?? 0) + (h.currentValue ?? 0);
  });
  const portfolioLines = Object.entries(sectorMap)
    .sort(([, a], [, b]) => b - a)
    .map(([sec, val]) => `  - ${sec}: ${totalVal > 0 ? ((val / totalVal) * 100).toFixed(1) : 0}%`)
    .join('\n') || '  (데이터 없음)';

  // 거장 요약
  const guruLines = guruPortfolios
    ? Object.entries(guruPortfolios).map(([name, g]) => {
        const top = Object.entries(g.sector_weights ?? {})
          .sort(([, a], [, b]) => b - a).slice(0, 4)
          .map(([s, w]) => `${s} ${w.toFixed(0)}%`).join(', ');
        return `- ${name} (${g.report_date ?? ''}): ${top}`;
      }).join('\n')
    : '  (데이터 없음)';

  // 자금흐름 요약
  const usLines = (moneyFlow?.us_flows ?? []).slice(0, 8).map(f =>
    `  - ${f.sector}: ${f.flow_direction} (7d ${f.price_7d_chg?.toFixed(1) ?? '?'}%)`
  ).join('\n') || '  (데이터 없음)';
  const krLines = (moneyFlow?.kr_flows ?? []).map(f =>
    `  - ${f.sector}: 외국인 ${(f.foreign_net_buy_5d ?? 0) > 0 ? '+' : ''}${f.foreign_net_buy_5d?.toLocaleString() ?? '?'}`
  ).join('\n') || '  (데이터 없음)';

  // 뉴스 요약
  const newsLines = (news ?? []).slice(0, 10).map(a =>
    `  - [${(a.themes ?? []).join(',')}] ${a.title.slice(0, 60)} (${a.source ?? ''})`
  ).join('\n') || '  (데이터 없음)';

  return `## 내 포트폴리오 (${myPortfolio?.name ?? ''})
총 ${holdings.length}개 종목, 섹터 비중:
${portfolioLines}

## 투자 거장 포트폴리오 (최신 13F)
${guruLines}

## 글로벌 돈흐름 (최근 7일)
미국 ETF:
${usLines}
한국 수급:
${krLines}

## 오늘의 주요 뉴스
${newsLines}

위 정보를 종합해서 아래 JSON 형식으로만 분석:
{
  "overall_grade": "A",
  "overall_comment": "전체 포트폴리오 한줄 평가",
  "guru_comparison": [
    {"guru": "워런 버핏", "alignment_score": 62, "common_themes": ["공통테마"], "my_excess": ["내가더많은섹터"], "guru_excess": ["거장더많은섹터"], "comment": "비교인사이트"}
  ],
  "money_flow_alignment": {"score": 75, "aligned_sectors": [], "misaligned_sectors": [], "comment": ""},
  "news_impact": [
    {"theme": "AI·반도체", "sentiment": "positive", "impact_level": 2, "key_news": "핵심뉴스", "action": "홀딩"}
  ],
  "rebalancing_suggestions": [
    {"action": "확대", "theme": "섹터명", "reason": "근거", "priority": "high"}
  ],
  "risk_alerts": [
    {"type": "concentration", "description": "리스크설명", "severity": "medium"}
  ],
  "strengths": ["강점1", "강점2"],
  "action_items": ["액션1", "액션2"],
  "one_line_summary": "오늘의핵심한줄"
}`;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY 미설정' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const client = new Anthropic({ apiKey });

    const msg = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 3000,
      system:     SYSTEM,
      messages:   [{ role: 'user', content: buildPrompt(body) }],
    });

    const raw = msg.content[0];
    if (raw.type !== 'text') throw new Error('Unexpected response type');

    const match = raw.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON 파싱 실패');
    const analysis = JSON.parse(match[0]);

    const now     = new Date();
    const kst     = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dateStr = kst.toISOString().slice(0, 10);
    const timeStr = kst.toISOString().slice(11, 16).replace(':', '-');
    const docId   = `${dateStr}_${timeStr}`;

    const diagnosis = {
      ...analysis,
      date:       dateStr,
      time:       kst.toISOString().slice(11, 16),
      created_at: kst.toISOString(),
    };

    await Promise.all([
      setDoc(doc(db, 'ai-diagnosis', 'latest'), diagnosis),
      setDoc(doc(db, 'ai-diagnosis', docId),    diagnosis),
    ]);

    return NextResponse.json({ diagnosis });
  } catch (e) {
    console.error('[ai-diagnosis]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '진단 실패' },
      { status: 500 },
    );
  }
}
