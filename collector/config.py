import os
from dotenv import load_dotenv

load_dotenv()  # collector/.env 파일에서 환경변수 읽기

# ── 텔레그램 ──────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8301921027:AAElzWo9-1S1TcwjN6UrWJmotCRGO5czVA4")
TELEGRAM_CHAT_ID   = os.getenv("TELEGRAM_CHAT_ID", "")   # @userinfobot 으로 확인

# ── Vercel 대시보드 URL ───────────────────────────────────
DASHBOARD_URL = os.getenv("DASHBOARD_URL", "")            # Vercel 배포 후 입력

# ── Firebase ──────────────────────────────────────────────
FIREBASE_CREDENTIAL_PATH = os.getenv(
    "FIREBASE_CREDENTIAL_PATH",
    os.path.join(os.path.dirname(__file__), "firebase-key.json"),
)
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "stockinvest-6cea8")

# ── 섹터 ETF ──────────────────────────────────────────────
SECTOR_ETFS = {
    # ── 테마·성장 섹터 ─────────────────────────────────
    "AI·반도체":      ["091160.KS", "266370.KS", "381170.KS"],
    "소부장":          ["395160.KS", "278540.KS"],
    "전력·전기":       ["459580.KS", "396500.KS"],
    "원자력":          ["466920.KS", "475050.KS"],
    "방산":            ["472160.KS", "329650.KS"],
    "중공업·조선":     ["139240.KS", "466940.KS"],
    "재건·인프라":     ["395290.KS"],
    "바이오":          ["244580.KS", "251340.KS"],
    "2차전지":         ["305720.KS", "364980.KS"],
    "로봇·자동화":     ["395840.KS", "462870.KS"],
    "게임·엔터":       ["244660.KS"],
    "K-뷰티":          ["459780.KS"],
    # ── 전통 산업 섹터 ─────────────────────────────────
    "자동차·모빌리티": ["091230.KS"],
    "금융·은행":       ["091170.KS", "140710.KS"],
    "증권·보험":       ["140700.KS"],
    "철강·금속":       ["091220.KS"],
    "화학":            ["099410.KS"],
    "헬스케어·의료":   ["266420.KS"],
    "음식료":          ["102110.KS"],
    "유통·소비재":     ["261220.KS"],
    # ── 에너지·유틸리티 ──────────────────────────────
    "수소·친환경":     ["394660.KS", "385510.KS"],
    "태양광·풍력":     ["322410.KS"],
    # ── 벤치마크 ─────────────────────────────────────
    "코스피200":       ["069500.KS"],
    "코스닥150":       ["229200.KS"],
}

PERIOD_SHORT = 5
PERIOD_MID   = 20
PERIOD_LONG  = 60
FETCH_DAYS   = 90
