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
    "AI·반도체":   ["091160.KS", "266370.KS", "381170.KS"],
    "소부장":      ["395160.KS", "278540.KS"],
    "전력·전기":   ["459580.KS", "396500.KS"],
    "원자력":      ["466920.KS", "475050.KS"],
    "방산":        ["472130.KS", "425060.KS"],
    "중공업·조선": ["139240.KS", "466940.KS"],
    "재건·인프라": ["395290.KS"],
    "바이오":      ["244580.KS", "251340.KS"],
    "2차전지":     ["305720.KS", "364980.KS"],
    "코스피200":   ["069500.KS"],
}

PERIOD_SHORT = 5
PERIOD_MID   = 20
PERIOD_LONG  = 60
FETCH_DAYS   = 90
