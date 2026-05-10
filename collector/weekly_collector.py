"""
주간 수집기 — 매주 금요일 07:00 KST 실행
실행 순서:
1. 거장 포트폴리오 (SEC EDGAR 13F)
2. ETF 자금흐름
3. 뉴스 수집
4. AI 자동 진단 (Anthropic API)
5. 텔레그램 주간 리포트

사용법:
  python weekly_collector.py          # 전체 실행
  python weekly_collector.py --step guru   # 개별 단계
"""
import sys, os, json, traceback, argparse
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(__file__))

KST = timezone(timedelta(hours=9))


def run_guru(db):
    print("[1/4] 거장 포트폴리오 수집 중...")
    from guru_collector import fetch_all_gurus, save_to_firebase as save_guru
    data = fetch_all_gurus()
    if data:
        save_guru(db, data)
    return data


def run_money_flow(db):
    print("[2/4] ETF 자금흐름 수집 중...")
    from money_flow_collector import collect_all, save_to_firebase as save_flow
    data = collect_all()
    save_flow(db, data)
    return data


def run_news(db):
    print("[3/4] 뉴스 수집 중...")
    from news_collector import collect_news, save_to_firebase as save_news
    articles = collect_news()
    save_news(db, articles)
    return articles


def _call_claude(prompt: str, system: str, max_tokens: int = 3000) -> dict:
    """Anthropic HTTP API 직접 호출 (SDK 없이 requests만 사용)."""
    import requests as req
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY 환경변수 필요")
    r = req.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": "claude-sonnet-4-6",
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=60,
    )
    if not r.ok:
        raise RuntimeError(f"Claude API {r.status_code}: {r.text[:200]}")
    content = r.json().get("content", [{}])[0].get("text", "")
    import re
    m = re.search(r"\{[\s\S]*\}", content)
    if not m:
        raise ValueError("JSON 파싱 실패")
    return json.loads(m.group(0))


def run_auto_diagnosis(db, guru_data: dict, flow_data: dict, news_articles: list) -> dict | None:
    print("[4/4] AI 자동 진단 중...")
    try:
        # 포트폴리오 로드
        portfolios = db.collection("portfolios").stream()
        my_portfolio = None
        for p in portfolios:
            my_portfolio = p.to_dict()
            break
        if not my_portfolio:
            print("  [WARN] 포트폴리오 없음, 진단 건너뜀")
            return None

        holdings = my_portfolio.get("holdings", [])
        sector_weights: dict[str, float] = {}
        total_val = sum(h.get("currentValue", 0) for h in holdings)
        for h in holdings:
            sec = h.get("sector", "기타") or "기타"
            sector_weights[sec] = sector_weights.get(sec, 0) + (h.get("currentValue", 0) / total_val * 100 if total_val > 0 else 0)

        portfolio_summary = "\n".join(
            f"  - {sec}: {w:.1f}%" for sec, w in sorted(sector_weights.items(), key=lambda x: -x[1])
        )

        guru_summaries = ""
        for gname, gdata in guru_data.items():
            sw = gdata.get("sector_weights", {})
            top_sectors = ", ".join(f"{s} {w:.0f}%" for s, w in sorted(sw.items(), key=lambda x: -x[1])[:5])
            guru_summaries += f"\n- {gname} ({gdata.get('report_date', '')}): {top_sectors}"

        us_flows = "\n".join(
            f"  - {f['sector']}: {'+' if f['flow_direction']=='inflow' else '-'}{abs(f.get('price_7d_chg', 0)):.1f}% ({f['flow_direction']})"
            for f in flow_data.get("us_flows", [])[:8]
        )
        kr_flows = "\n".join(
            f"  - {f['sector']}: 외국인 {f.get('foreign_net_buy_5d', 0):+,}"
            for f in flow_data.get("kr_flows", [])
        )
        news_text = "\n".join(
            f"  - [{', '.join(a.get('themes', []))}] {a['title'][:60]} ({a.get('source', '')})"
            for a in news_articles[:10]
        )

        prompt = f"""## 내 포트폴리오 섹터 비중
{portfolio_summary}

## 투자 거장 포트폴리오 (최신 13F)
{guru_summaries}

## 글로벌 돈흐름 (최근 7일)
미국 ETF:
{us_flows}
한국 수급:
{kr_flows}

## 오늘의 주요 뉴스
{news_text}

위 정보를 종합해서 아래 JSON 형식으로만 분석하세요:
{{
  "overall_grade": "A",
  "overall_comment": "전체 포트폴리오 한줄 평가",
  "guru_comparison": [{{"guru": "워런 버핏", "alignment_score": 62, "common_themes": [], "my_excess": [], "guru_excess": [], "comment": ""}}],
  "money_flow_alignment": {{"score": 75, "aligned_sectors": [], "misaligned_sectors": [], "comment": ""}},
  "news_impact": [{{"theme": "AI·반도체", "sentiment": "positive", "impact_level": 2, "key_news": "", "action": "홀딩"}}],
  "rebalancing_suggestions": [{{"action": "유지", "theme": "", "reason": "", "priority": "low"}}],
  "risk_alerts": [{{"type": "concentration", "description": "", "severity": "low"}}],
  "strengths": [],
  "action_items": [],
  "one_line_summary": ""
}}"""

        system = "당신은 최고의 포트폴리오 분석 전문가입니다. 반드시 순수 JSON만 출력하세요."
        result = _call_claude(prompt, system, max_tokens=3000)

        now_str = datetime.now(KST).strftime("%Y-%m-%d_%H-%M")
        today   = datetime.now(KST).strftime("%Y-%m-%d")
        diagnosis = {
            **result,
            "date":      today,
            "time":      datetime.now(KST).strftime("%H:%M"),
            "created_at": datetime.now(KST).isoformat(),
        }
        db.collection("ai-diagnosis").document("latest").set(diagnosis)
        db.collection("ai-diagnosis").document(now_str).set(diagnosis)
        print(f"  [OK] AI 진단 저장: 등급 {result.get('overall_grade', '?')}")
        return diagnosis

    except Exception as e:
        print(f"  [ERROR] AI 진단 실패: {e}")
        return None


def send_weekly_telegram(diagnosis: dict | None, guru_count: int, flow_count: int, news_count: int):
    try:
        from telegram_bot import send_text
        grade = diagnosis.get("overall_grade", "?") if diagnosis else "?"
        summary = diagnosis.get("one_line_summary", "") if diagnosis else ""
        msg = (
            f"📊 <b>주간 포트폴리오 리포트</b>\n\n"
            f"🏆 종합 등급: <b>{grade}</b>\n"
            f"💬 {summary}\n\n"
            f"📈 거장 포트폴리오: {guru_count}명\n"
            f"💰 ETF 자금흐름: {flow_count}개 섹터\n"
            f"📰 뉴스: {news_count}건\n\n"
            f"🔗 /compare 페이지에서 상세 확인"
        )
        send_text(msg)
        print("  [OK] 텔레그램 전송 완료")
    except Exception as e:
        print(f"  [WARN] 텔레그램 실패: {e}")


def run_weekly_update():
    from firebase_uploader import _init as firebase_init
    from firebase_admin import firestore

    firebase_init()
    db = firestore.client()

    print("=" * 50)
    print(f"=== 주간 업데이트 시작: {datetime.now(KST).strftime('%Y-%m-%d %H:%M')} ===")
    print("=" * 50)

    guru_data = {}
    flow_data = {"us_flows": [], "kr_flows": []}
    news_articles = []

    try:
        guru_data = run_guru(db)
    except Exception:
        print(f"[ERROR] guru: {traceback.format_exc()[-300:]}")

    try:
        flow_data = run_money_flow(db)
    except Exception:
        print(f"[ERROR] flow: {traceback.format_exc()[-300:]}")

    try:
        news_articles = run_news(db)
    except Exception:
        print(f"[ERROR] news: {traceback.format_exc()[-300:]}")

    diagnosis = None
    try:
        diagnosis = run_auto_diagnosis(db, guru_data, flow_data, news_articles)
    except Exception:
        print(f"[ERROR] diagnosis: {traceback.format_exc()[-300:]}")

    send_weekly_telegram(
        diagnosis,
        guru_count=len(guru_data),
        flow_count=len(flow_data.get("us_flows", [])),
        news_count=len(news_articles),
    )

    print("=" * 50)
    print("=== 주간 업데이트 완료 ===")
    print("=" * 50)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--step", choices=["guru", "flow", "news", "diagnosis"], help="개별 단계만 실행")
    args = parser.parse_args()

    from firebase_uploader import _init as firebase_init
    from firebase_admin import firestore
    firebase_init()
    db = firestore.client()

    if args.step == "guru":
        run_guru(db)
    elif args.step == "flow":
        run_money_flow(db)
    elif args.step == "news":
        run_news(db)
    elif args.step == "diagnosis":
        from firebase_admin import firestore as fs
        guru_doc = db.collection("guru-portfolios").document("latest").get()
        flow_doc = db.collection("money-flow").document("latest").get()
        news_doc = db.collection("portfolio-news").document("latest").get()
        guru_data     = guru_doc.to_dict() if guru_doc.exists else {}
        flow_data     = flow_doc.to_dict() if flow_doc.exists else {}
        news_articles = (news_doc.to_dict() or {}).get("articles", [])
        run_auto_diagnosis(db, guru_data, flow_data, news_articles)
    else:
        run_weekly_update()


if __name__ == "__main__":
    main()
