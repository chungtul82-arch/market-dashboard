import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const SYSTEM = `당신은 한국 주식시장 전문 애널리스트입니다.
박병창 투자전략가의 스팟 시황 텍스트를 분석하여 핵심 정보를 추출합니다.
응답은 반드시 유효한 JSON 형식으로만 해주세요. 마크다운 코드블록 없이 JSON만 출력하세요.`;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다. Vercel 환경변수를 확인해 주세요.' },
      { status: 500 },
    );
  }

  try {
    const client = new Anthropic({ apiKey });

    const { text, basketStocks = [] } = await request.json();
    if (!text?.trim()) return NextResponse.json({ error: '텍스트가 비어있습니다.' }, { status: 400 });

    const names = (basketStocks as { name?: string; symbol: string }[])
      .map(s => s.name || s.symbol).join(', ');

    const prompt = `${names ? `바스켓 종목: ${names}\n\n` : ''}스팟 시황 원문:\n${text}

아래 JSON 형식으로만 분석 결과를 반환하세요:
{
  "insight": "핵심 인사이트 1~2문장",
  "market_judge": "상승|하락|보합|횡보 중 하나",
  "confidence": 1~5 정수,
  "target_index": "목표 지수 범위 텍스트 (없으면 빈 문자열)",
  "strong_sectors": ["강세 섹터명"],
  "weak_sectors": ["약세/주의 섹터명"],
  "basket_actions": [
    {"name": "종목명", "symbol": "티커 또는 빈 문자열", "action": "홀딩|비중확대|비중축소|매수|매도 중 하나", "reason": "근거 한 줄"}
  ],
  "risks": ["리스크 항목"],
  "cross_check": [
    {"sector": "섹터명", "match": true 또는 false, "detail": "교차검증 설명"}
  ]
}`;

    const msg = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1500,
      system:     SYSTEM,
      messages:   [{ role: 'user', content: prompt }],
    });

    const raw = msg.content[0];
    if (raw.type !== 'text') throw new Error('Unexpected response type');

    const jsonMatch = raw.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON을 파싱할 수 없습니다');

    const analysis = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ analysis });
  } catch (err) {
    console.error('[analyze-spot]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '분석 실패' },
      { status: 500 },
    );
  }
}
