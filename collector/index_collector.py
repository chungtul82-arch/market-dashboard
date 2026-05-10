"""
KRX 주요 인덱스 수익률 수집기
pykrx get_index_ohlcv_by_date 사용
Firebase /index-trends/latest 에 저장
"""
import os, time
from datetime import datetime, timedelta, timezone
import pandas as pd

KST = timezone(timedelta(hours=9))

WATCH_INDICES = {
    "코스피":               {"ticker": "1001", "market": "KOSPI"},
    "코스피200":            {"ticker": "1028", "market": "KOSPI"},
    "코스피200 IT":         {"ticker": "1155", "market": "KOSPI"},
    "코스피200 중공업":     {"ticker": "1152", "market": "KOSPI"},
    "코스피200 에너지화학": {"ticker": "1154", "market": "KOSPI"},
    "코스피200 금융":       {"ticker": "1156", "market": "KOSPI"},
    "코스피200 헬스케어":   {"ticker": "1160", "market": "KOSPI"},
    "코스닥":               {"ticker": "2001", "market": "KOSDAQ"},
    "코스닥150":            {"ticker": "2003", "market": "KOSDAQ"},
    "KRX300":               {"ticker": "5042", "market": "KRX"},
    "KRX 반도체":           {"ticker": "5300", "market": "KRX"},
    "KRX 헬스케어":         {"ticker": "5302", "market": "KRX"},
    "KRX 증권":             {"ticker": "5306", "market": "KRX"},
    "코리아밸류업":         {"ticker": "5043", "market": "KRX"},
    "코넥스":               {"ticker": "5381", "market": "KRX"},
}

INDEX_ETF_MAP = {
    "코스피200":            {"etf": "KODEX 200",            "ticker_ks": "069500.KS"},
    "코스피200 IT":         {"etf": "KODEX 200 IT",         "ticker_ks": "278530.KS"},
    "코스피200 중공업":     {"etf": "KODEX 200 중공업",     "ticker_ks": "140700.KS"},
    "코스피200 에너지화학": {"etf": "TIGER 에너지화학",     "ticker_ks": "139270.KS"},
    "코스피200 금융":       {"etf": "KODEX 은행",            "ticker_ks": "091170.KS"},
    "코스피200 헬스케어":   {"etf": "TIGER 헬스케어",        "ticker_ks": "143460.KS"},
    "코스닥150":            {"etf": "TIGER 코스닥150",       "ticker_ks": "232080.KS"},
    "KRX300":               {"etf": "TIGER KRX300",          "ticker_ks": "290080.KS"},
    "KRX 반도체":           {"etf": "KODEX 반도체",          "ticker_ks": "091160.KS"},
    "KRX 헬스케어":         {"etf": "TIGER 헬스케어",        "ticker_ks": "143460.KS"},
    "KRX 증권":             {"etf": "KODEX 증권",            "ticker_ks": "266390.KS"},
    "코리아밸류업":         {"etf": "KBRISE 코리아밸류업",   "ticker_ks": "395160.KS"},
}

# 인덱스 → 히트맵 섹터 매핑 (RS 조회용)
INDEX_TO_SECTOR = {
    "코스피200 IT":         "AI·반도체",
    "KRX 반도체":           "AI·반도체",
    "KRX 헬스케어":         "바이오",
    "코스피200 헬스케어":   "바이오",
    "코스피200 금융":       "증권·금융",
    "KRX 증권":             "증권·금융",
    "코스피200 중공업":     "중공업·조선",
    "코스피200 에너지화학": "소부장",
    "코스닥150":            "AI·반도체",
}


def _fetch_index(ticker: str, market: str, fromdate: str, todate: str) -> pd.Series | None:
    """pykrx로 인덱스 종가 시계열 반환."""
    try:
        from pykrx import stock as pstock
        df = pstock.get_index_ohlcv_by_date(fromdate, todate, ticker, market)
        if df is None or df.empty:
            return None
        close_col = next((c for c in df.columns if c in ("종가", "Close")), None)
        if close_col is None:
            return None
        return df[close_col].astype(float)
    except Exception as e:
        print(f"    [WARN] {ticker}({market}): {e}")
        return None


def _cum_ret(series: pd.Series, n: int) -> list[float]:
    """최근 n거래일 누적수익률 배열 (첫날=0 기준 %)."""
    tail = series.tail(n)
    if len(tail) < 2:
        return []
    base = float(tail.iloc[0])
    return [round((float(v) / base - 1) * 100, 2) for v in tail]


def _ret(series: pd.Series, n: int) -> float:
    """최근 n거래일 수익률 %."""
    if len(series) < n + 1:
        n = len(series) - 1
    if n <= 0:
        return 0.0
    return round((float(series.iloc[-1]) / float(series.iloc[-n - 1]) - 1) * 100, 2)


def calc_etf_signal(name: str, idx: dict, kospi_ret: dict, sector_rs: dict) -> str:
    rel_5d  = idx.get("rel_5d",  0)
    rel_20d = idx.get("rel_20d", 0)
    ret_20d = idx.get("ret_20d", 0)
    ret_5d  = idx.get("ret_5d",  0)
    ret_60d = idx.get("ret_60d", 0)

    sector = INDEX_TO_SECTOR.get(name, "")
    rs = sector_rs.get(sector, 50) if sector else 50

    # 이탈 경고
    if rel_20d <= -3.0 or (ret_20d < 0 and ret_60d < 0):
        return "exit"
    # 편입 검토
    if rel_5d >= 2.0 and rel_20d >= 3.0 and ret_20d > 0 and rs >= 60:
        return "buy"
    # 모니터링
    if (rel_5d >= 1.0 and rel_20d >= 1.5) or (ret_5d > 0 and ret_5d > ret_20d / 4):
        return "watch"
    return "hold"


def collect_index_data(db=None) -> list[dict]:
    today = datetime.now(KST)
    todate   = today.strftime("%Y%m%d")
    fromdate = (today - timedelta(days=365)).strftime("%Y%m%d")

    # 섹터 RS 로드 (있으면)
    sector_rs: dict[str, float] = {}
    if db:
        try:
            doc = db.collection("reports").document("latest").get()
            if doc.exists:
                sector_rs = {k: v.get("rs_score", 50)
                             for k, v in doc.to_dict().get("sectors", {}).items()}
                print(f"  섹터 RS {len(sector_rs)}개 로드")
        except Exception as e:
            print(f"  [WARN] 섹터 RS 로드 실패: {e}")

    # 코스피 기준 수익률 먼저 수집
    kospi_series = _fetch_index("1001", "KOSPI", fromdate, todate)
    kospi_ret = {}
    if kospi_series is not None:
        for n, k in [(5, "5d"), (20, "20d"), (60, "60d"), (120, "120d")]:
            kospi_ret[k] = _ret(kospi_series, n)
    print(f"  코스피 수익률: {kospi_ret}")

    results: list[dict] = []
    for name, cfg in WATCH_INDICES.items():
        ticker = cfg["ticker"]
        market = cfg["market"]
        try:
            series = _fetch_index(ticker, market, fromdate, todate)
            if series is None or len(series) < 5:
                print(f"  [WARN] {name}: 데이터 없음")
                continue

            r5   = _ret(series, 5)
            r20  = _ret(series, 20)
            r60  = _ret(series, 60)
            r120 = _ret(series, 120)
            r250 = _ret(series, 250)

            rel5  = round(r5  - kospi_ret.get("5d",  0), 2)
            rel20 = round(r20 - kospi_ret.get("20d", 0), 2)

            idx = {
                "name":     name,
                "ticker":   ticker,
                "ret_5d":   r5,
                "ret_20d":  r20,
                "ret_60d":  r60,
                "ret_120d": r120,
                "ret_250d": r250,
                "rel_5d":   rel5,
                "rel_20d":  rel20,
                "prices_5d":   _cum_ret(series, 5),
                "prices_20d":  _cum_ret(series, 20),
                "prices_60d":  _cum_ret(series, 60),
                "prices_120d": _cum_ret(series, 120),
            }
            etf = INDEX_ETF_MAP.get(name, {})
            idx["etf_name"]   = etf.get("etf", "")
            idx["etf_ticker"] = etf.get("ticker_ks", "")
            idx["signal"]     = calc_etf_signal(name, idx, kospi_ret, sector_rs)

            results.append(idx)
            print(f"  {name}: 5d={r5:+.1f}% 20d={r20:+.1f}% rel20d={rel20:+.1f}% → {idx['signal']}")
            time.sleep(0.3)
        except Exception as e:
            print(f"  [ERROR] {name}: {e}")

    buys = [r for r in results if r["signal"] == "buy"]
    print(f"  [OK] 인덱스 {len(results)}개 수집 — 편입검토 {len(buys)}개")
    return results


def save_to_firebase(db, indices: list[dict]) -> None:
    today = datetime.now(KST).strftime("%Y-%m-%d")
    data = {
        "updated_at": datetime.now(KST).isoformat(),
        "date":       today,
        "indices":    indices,
    }
    db.collection("index-trends").document("latest").set(data)
    db.collection("index-trends").document(today).set(data)
    print(f"  [OK] Firebase 저장: /index-trends/{today} ({len(indices)}개)")


def main():
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    from firebase_uploader import _init as firebase_init
    from firebase_admin import firestore

    firebase_init()
    db = firestore.client()

    print("=== 인덱스 추세 수집 시작 ===")
    indices = collect_index_data(db)
    if indices:
        save_to_firebase(db, indices)
    print("=== 완료 ===")


if __name__ == "__main__":
    main()
