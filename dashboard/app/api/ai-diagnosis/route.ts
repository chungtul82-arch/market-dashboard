import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

export const maxDuration = 60; // Vercel Pro: 최대 60초 허용

const SYSTEM = `당신은 포트폴리오 분석 전문가입니다. 반드시 순수 JSON만 출력하세요.`;

function buildPrompt(body: Record<string, unknown>): string {
  const { myPortfolio, guruPortfolios, moneyFlow, news } = body as {
    myPortfolio: { holdings?: { sector?: string; currentValue?: number; name?: string }[]; name?: string } | null;
    guruPortfolios: Record<string, { sector_weights?: Record<string, number>; report_date?: string }> | null;
    moneyFlow: { us_flows?: { sector: string; flow_direction: string; price_7d_chg?: number }[]; kr_flows?: { sector: string; foreign_net_buy_5d?: number }[] } | null;
    news: { title: string; themes?: string[]; source?: string }[] | null;
  };

  const holdings = myPortfolio?.holdings ?? [];
  const totalVal  = holdings.reduce((s, h) => s + (h.currentValue ?? 0), 0);
  const sectorMap: Record<string, number> = {};
  holdings.forEach(h => {
    const sec = h.sector || '기타';
    sectorMap[sec] = (sectorMap[sec] ?? 0) + (h.currentValue ?? 0);
  });
  const portfolioLines = Object.entries(sectorMap)
    .sort(([, a], [, b]) => b - a)
    .map(([sec, val]) => `${sec}:${totalVal > 0 ? ((val / totalVal) * 100).toFixed(0) : 0}%`)
    .join(', ') || '없음';

  const guruLines = guruPortfolios
    ? Object.entries(guruPortfolios).map(([name, g]) => {
        const top = Object.entries(g.sector_weights ?? {})
          .sort(([, a], [, b]) => b - a).slice(0, 3)
          .map(([s, w]) => `${s}${w.toFixed(0)}%`).join(',');
        return `${name}(${g.report_date ?? ''}):${top}`;
      }).join(' | ')
    : '없음';

  const usLines = (moneyFlow?.us_flows ?? []).slice(0, 6).map(f =>
    `${f.sector}:${f.flow_direction}(${f.price_7d_chg?.toFixed(1) ?? '?'}%)`
  ).join(', ') || '없음';

  const newsLines = (news ?? []).slice(0, 6).map(a =>
    `[${(a.themes ?? []).slice(0,2).join(',')}]${a.title.slice(0, 40)}`
  ).join(' / ') || '없음';

  return `내 포트폴리오(${myPortfolio?.name ?? ''}, ${holdings.length}종목): ${portfolioLines}

거장포트폴리오: ${guruLines}

글로벌ETF수급: ${usLines}

뉴스: ${newsLines}

JSON만 출력:
{"overall_grade":"A","overall_comment":"","guru_comparison":[{"guru":"","alignment_score":0,"common_themes":[],"my_excess":[],"guru_excess":[],"comment":""}],"money_flow_alignment":{"score":0,"aligned_sectors":[],"misaligned_sectors":[],"comment":""},"news_impact":[{"theme":"","sentiment":"positive","impact_level":1,"key_news":"","action":""}],"rebalancing_suggestions":[{"action":"","theme":"","reason":"","priority":"low"}],"risk_alerts":[{"type":"","description":"","severity":"low"}],"strengths":[],"action_items":[],"one_line_summary":""}`;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY가 Vercel 환경변수에 없습니다' }, { status: 500 });
  }

  try {
    const body   = await request.json();
    const client = new Anthropic({ apiKey });

    const msg = await client.messages.create({
      model:      'claude-haiku-4-5-20251001', // Haiku: 응답속도 빠름 (3~8초)
      max_tokens: 2000,
      system:     SYSTEM,
      messages:   [{ role: 'user', content: buildPrompt(body) }],
    });

    const raw = msg.content[0];
    if (raw.type !== 'text') throw new Error('Unexpected response type');

    const match = raw.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON 파싱 실패');
    const analysis = JSON.parse(match[0]);

    return NextResponse.json({ diagnosis: analysis });
  } catch (e) {
    console.error('[ai-diagnosis]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '진단 실패' },
      { status: 500 },
    );
  }
}
