"""텔레그램 알림 전용 — 대시보드 링크 + 요약 발송."""
import requests
from config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DASHBOARD_URL


def _base() -> str:
    return f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"


def send_text(text: str) -> bool:
    """텍스트 메시지 발송 (에러 알림 포함 범용)."""
    if not TELEGRAM_CHAT_ID:
        print("  [WARN] CHAT_ID 미설정 — 텔레그램 발송 생략")
        return False
    try:
        resp = requests.post(
            f"{_base()}/sendMessage",
            data={"chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode": "HTML"},
            timeout=15,
        )
        resp.raise_for_status()
        return True
    except Exception as exc:
        print(f"  [ERROR] 텔레그램 발송 실패: {exc}")
        return False


def _fmt(value: float) -> str:
    pct = value * 100
    return f"{'+' if pct >= 0 else ''}{pct:.1f}%"


def send_daily_notification(report_data: dict) -> bool:
    """
    발송 내용:
    ─────────────────────────────────────────────
    📊 한국 섹터 히트맵 — 2026-05-03

    📈 코스피200 5일: +2.0%  (시장 상승)

    🟢 강세 TOP 3 (5일 수익률)
      • AI·반도체: +4.0%
      • 2차전지:   +5.4%
      • 소부장:    +3.1%

    🔴 약세 BOT 3
      • 바이오:     -1.1%
      • 재건·인프라: +1.7%
      • 원자력:     +2.3%

    ⚡ 순환매 신호 (4건)
      🟢 [강세 진입] 2차전지 (+5.4%)
      🟠 [단기 과열] 2차전지 (+5.4%)
      🟢 [강세 진입] AI·반도체 (+4.0%)

    🔗 대시보드 열기
    ─────────────────────────────────────────────
    """
    date    = report_data.get("date", "")
    sectors = report_data.get("sectors", {})
    signals = report_data.get("signals", [])
    summary = report_data.get("summary", {})

    lines = [f"📊 <b>한국 섹터 히트맵 — {date}</b>\n"]

    # ── 코스피200 ────────────────────────────────────
    trend = summary.get("market_trend", "")
    kospi = summary.get("kospi_return_5d")
    if kospi is not None:
        icon = "📈" if trend == "상승" else "📉"
        lines.append(f"{icon} 코스피200 5일: <b>{_fmt(kospi)}</b>  (시장 {trend})\n")

    # ── 강세 TOP 3 ───────────────────────────────────
    if sectors:
        sorted_5d = sorted(
            [(k, v.get("return_5d", 0)) for k, v in sectors.items()],
            key=lambda x: x[1], reverse=True,
        )
        lines.append("🟢 <b>강세 TOP 3</b> (5일 수익률)")
        for name, val in sorted_5d[:3]:
            lines.append(f"  • {name}: <b>{_fmt(val)}</b>")

        lines.append("\n🔴 <b>약세 BOT 3</b>")
        for name, val in sorted_5d[-3:]:
            lines.append(f"  • {name}: <b>{_fmt(val)}</b>")

    # ── 순환매 신호 ──────────────────────────────────
    if signals:
        ICONS = {"강세 진입": "🟢", "이탈 경고": "🔴", "단기 과열": "🟠"}
        lines.append(f"\n⚡ <b>순환매 신호</b> ({len(signals)}건)")
        for sig in signals[:6]:
            icon = ICONS.get(sig["signal"], "⚪")
            lines.append(f"  {icon} [{sig['signal']}] {sig['sector']} ({_fmt(sig['value'])})")
    else:
        lines.append("\n⚡ 순환매 신호 없음")

    # ── 대시보드 링크 ────────────────────────────────
    lines.append("")
    if DASHBOARD_URL:
        lines.append(f'🔗 <a href="{DASHBOARD_URL}">대시보드 열기</a>')
    else:
        lines.append("🔗 대시보드: config.py 의 DASHBOARD_URL 을 설정하세요")

    return send_text("\n".join(lines))
