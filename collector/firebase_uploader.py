import math
import time
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))

import firebase_admin
from firebase_admin import credentials, firestore

from config import FIREBASE_CREDENTIAL_PATH, FIREBASE_PROJECT_ID

_COLLECTION = "reports"


def _init() -> None:
    if not firebase_admin._apps:
        cred = credentials.Certificate(FIREBASE_CREDENTIAL_PATH)
        firebase_admin.initialize_app(cred, {"projectId": FIREBASE_PROJECT_ID})


def _safe_float(value) -> float:
    try:
        v = float(value)
        return 0.0 if math.isnan(v) or math.isinf(v) else v
    except (TypeError, ValueError):
        return 0.0


def build_report_data(
    rs_df,
    signals: list[dict],
    foreign_data: dict | None = None,
    market_indices: dict | None = None,
) -> dict:
    """분석 결과 → Firestore 업로드용 dict."""
    today = datetime.now(KST).strftime("%Y-%m-%d")

    sectors: dict[str, dict] = {}
    for sector in rs_df.index:
        row = rs_df.loc[sector]
        entry: dict = {
            "return_5d":      _safe_float(row.get("return_5d")),
            "return_20d":     _safe_float(row.get("return_20d")),
            "return_60d":     _safe_float(row.get("return_60d")),
            "rs_score":       _safe_float(row.get("rs_score")),
            "pct_return_5d":  _safe_float(row.get("pct_return_5d")),
            "pct_return_20d": _safe_float(row.get("pct_return_20d")),
            "pct_return_60d": _safe_float(row.get("pct_return_60d")),
        }
        if foreign_data:
            entry["foreign_net_buy"] = _safe_float(foreign_data.get(sector, 0))
        sectors[sector] = entry

    sorted_5d = rs_df["return_5d"].dropna().sort_values(ascending=False)
    summary: dict = {
        "top_sector":    sorted_5d.index[0]  if len(sorted_5d) > 0 else "",
        "bottom_sector": sorted_5d.index[-1] if len(sorted_5d) > 0 else "",
        "signal_count":  len(signals),
    }
    if "코스피200" in rs_df.index:
        k5 = _safe_float(rs_df.loc["코스피200", "return_5d"])
        summary["market_trend"]    = "상승" if k5 > 0 else "하락"
        summary["kospi_return_5d"] = k5

    return {
        "date":            today,
        "updated_at":      firestore.SERVER_TIMESTAMP,
        "market_indices":  market_indices or {},
        "sectors":         sectors,
        "signals":         [
            {"sector": s["sector"], "signal": s["signal"], "value": _safe_float(s["value"])}
            for s in signals
        ],
        "summary": summary,
    }


def upload_report(data: dict, max_retries: int = 3) -> bool:
    """/reports/{오늘날짜} + /reports/latest 에 저장. 429 시 최대 3회 재시도."""
    _init()
    db    = firestore.client()
    today = data.get("date") or datetime.today().strftime("%Y-%m-%d")

    for attempt in range(max_retries):
        try:
            batch = db.batch()
            batch.set(db.collection(_COLLECTION).document("latest"), data)
            batch.set(db.collection(_COLLECTION).document(today),    data)
            batch.commit()
            print(f"  [OK] Firebase 업로드: {_COLLECTION}/latest + {_COLLECTION}/{today}")
            return True
        except Exception as exc:
            err_str = str(exc)
            if ("429" in err_str or "Quota" in err_str or "quota" in err_str) and attempt < max_retries - 1:
                wait = 30 * (attempt + 1)  # 30s, 60s
                print(f"  [WARN] Firebase 429 — {wait}초 후 재시도 ({attempt+1}/{max_retries})...")
                time.sleep(wait)
            else:
                print(f"  [ERROR] Firebase 업로드 실패: {exc}")
                return False
    return False
