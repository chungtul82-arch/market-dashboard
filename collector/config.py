import os
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8301921027:AAElzWo9-1S1TcwjN6UrWJmotCRGO5czVA4")
TELEGRAM_CHAT_ID   = os.getenv("TELEGRAM_CHAT_ID", "")
DASHBOARD_URL      = os.getenv("DASHBOARD_URL", "")

FIREBASE_CREDENTIAL_PATH = os.getenv(
    "FIREBASE_CREDENTIAL_PATH",
    os.path.join(os.path.dirname(__file__), "firebase-key.json"),
)
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "stockinvest-6cea8")

# ── 섹터 데이터 소스 (KRX 인덱스 우선, 없으면 대표 ETF) ──────────────
#
# type="index" : pykrx get_index_ohlcv_by_date(ticker, market) 사용
# type="etf"   : yfinance download(tickers) 사용 (거래량 상위 대표 ETF 1개)

SECTOR_SOURCES: dict[str, dict] = {
    # ── KRX 공식 인덱스 기반 (8개) ─────────────────────────────────────
    "AI·반도체":      {"type": "index", "ticker": "5300", "market": "KRX",    "label": "KRX 반도체 지수"},
    "바이오":         {"type": "index", "ticker": "5302", "market": "KRX",    "label": "KRX 헬스케어 지수"},
    "증권·금융":      {"type": "index", "ticker": "1156", "market": "KOSPI",  "label": "코스피200 금융 지수"},
    "중공업·조선":    {"type": "index", "ticker": "1152", "market": "KOSPI",  "label": "코스피200 중공업 지수"},
    "화학":           {"type": "index", "ticker": "1154", "market": "KOSPI",  "label": "코스피200 에너지화학 지수"},
    "코스닥150":      {"type": "index", "ticker": "2003", "market": "KOSDAQ", "label": "코스닥150 지수"},
    "코리아밸류업":   {"type": "index", "ticker": "5043", "market": "KRX",    "label": "코리아밸류업 지수"},
    "코스피200":      {"type": "index", "ticker": "1028", "market": "KOSPI",  "label": "코스피200 지수"},

    # ── 대표 ETF 기반 (KRX 공식 인덱스 없음, 10개) ──────────────────────
    "방산":           {"type": "etf", "tickers": ["472160.KS"], "label": "TIGER 방산&우주"},
    "원자력":         {"type": "etf", "tickers": ["466920.KS"], "label": "KODEX 원자력"},
    "전력·전기":      {"type": "etf", "tickers": ["459580.KS"], "label": "TIGER 전력설비"},
    "2차전지":        {"type": "etf", "tickers": ["305720.KS"], "label": "KODEX 2차전지산업"},
    # 로봇·자동화: 395840.KS(TIGER 로봇&AI)가 Yahoo Finance·pykrx 미지원 → 잠정 제외
    # "로봇·자동화": {"type": "etf", "tickers": ["395840.KS"], "label": "TIGER 로봇&AI"},
    "재건·인프라":    {"type": "etf", "tickers": ["395290.KS"], "label": "TIGER 건설기계"},
    "소부장":         {"type": "etf", "tickers": ["395160.KS"], "label": "TIGER 소재소부장"},
    "게임·엔터":      {"type": "etf", "tickers": ["244660.KS"], "label": "KODEX 게임&엔터"},
    "자동차":         {"type": "etf", "tickers": ["091230.KS"], "label": "KODEX 자동차"},
    "철강·금속":      {"type": "etf", "tickers": ["091220.KS"], "label": "KODEX 철강"},
}

# 외국인 순매수 조회용 — ETF 기반 섹터만 (인덱스는 개별 종목 코드 없음)
SECTOR_ETFS: dict[str, list[str]] = {
    name: src["tickers"]
    for name, src in SECTOR_SOURCES.items()
    if src.get("type") == "etf"
}

# 섹터 레이블 (히트맵 모달 표시용)
SECTOR_LABELS: dict[str, str] = {
    name: src.get("label", name)
    for name, src in SECTOR_SOURCES.items()
}

PERIOD_SHORT = 5
PERIOD_MID   = 20
PERIOD_LONG  = 60
FETCH_DAYS   = 90
