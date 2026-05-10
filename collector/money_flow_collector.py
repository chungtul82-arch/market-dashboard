"""
ETF 자금 유입/유출 수집기
미국 섹터 ETF (yfinance) + 한국 외국인/기관 수급 (pykrx)
Firebase /money-flow/latest 에 저장
"""
import os
from datetime import datetime, timedelta, timezone
import pandas as pd

KST = timezone(timedelta(hours=9))

US_SECTOR_ETFS = {
    "AI·반도체":    ["SOXX", "SMH", "AIQ"],
    "전력·인프라":  ["XLU", "GRID", "ICLN"],
    "방산":         ["ITA", "XAR"],
    "바이오":       ["XBI", "IBB"],
    "증권·금융":    ["XLF", "KBE"],
    "에너지":       ["XLE", "XOP"],
    "원자력":       ["NLR", "URA"],
    "로봇·AI":      ["ROBO", "ARKQ"],
    "금":           ["GLD", "IAU"],
    "소비재":       ["XLY", "XLP"],
    "미디어·통신":  ["XLC"],
    "소부장":       ["XLB"],
}

# 한국 섹터 ETF → 섹터 매핑 (config.py SECTOR_ETFS에서 키 활용)
KR_SECTOR_MAP = {
    "AI·반도체":   ["TIGER 반도체", "KODEX 반도체"],
    "바이오":      ["TIGER 바이오", "KODEX 바이오"],
    "방산":        ["TIGER 방산"],
    "원자력":      ["TIGER 원자력"],
    "2차전지":     ["TIGER 2차전지"],
    "조선·해운":   ["TIGER 조선"],
    "증권·금융":   ["TIGER 증권"],
}


def _calc_etf_flow(ticker: str, days: int = 7) -> dict | None:
    """ETF 7일 자금흐름 추정 — AUM 변화 근사."""
    try:
        import yfinance as yf
        etf = yf.Ticker(ticker)
        hist = etf.history(period="30d")
        if hist.empty or len(hist) < days + 2:
            return None

        recent  = hist.tail(days)
        prev    = hist.iloc[-(days + 5):-(days)]

        close_now  = float(recent["Close"].iloc[-1])
        close_prev = float(recent["Close"].iloc[0])
        vol_avg    = float(prev["Volume"].mean()) if not prev.empty else 1
        vol_now    = float(recent["Volume"].mean())

        # AUM 변화 = (종가변화율 + 순매수압력) 근사
        price_chg = (close_now / close_prev - 1) if close_prev > 0 else 0
        vol_ratio = vol_now / vol_avg if vol_avg > 0 else 1

        # 자금유입 추정 (억 USD)
        # 실제 AUM 데이터 없이 근사치 계산
        try:
            info = etf.fast_info
            aum = getattr(info, "three_month_average_volume", None)
        except Exception:
            aum = None

        flow_sign = 1 if (price_chg > 0 and vol_ratio > 1.0) else (-1 if price_chg < -0.01 else 0)
        flow_est  = flow_sign * abs(price_chg) * vol_ratio * 100  # 상대적 유입 지수

        return {
            "ticker":      ticker,
            "price_7d_chg": round(price_chg * 100, 2),
            "vol_ratio":   round(vol_ratio, 2),
            "flow_index":  round(flow_est, 2),
            "direction":   "inflow" if flow_sign > 0 else ("outflow" if flow_sign < 0 else "neutral"),
        }
    except Exception as e:
        print(f"  [WARN] ETF flow {ticker}: {e}")
        return None


def collect_us_flows() -> list[dict]:
    results = []
    for sector, tickers in US_SECTOR_ETFS.items():
        best = None
        for ticker in tickers:
            data = _calc_etf_flow(ticker)
            if data and (best is None or abs(data["flow_index"]) > abs(best["flow_index"])):
                best = data
        if best:
            results.append({
                "sector":        sector,
                "top_etf":       best["ticker"],
                "flow_index":    best["flow_index"],
                "price_7d_chg":  best["price_7d_chg"],
                "vol_ratio":     best["vol_ratio"],
                "flow_direction": best["direction"],
            })
    results.sort(key=lambda x: x["flow_index"], reverse=True)
    print(f"  [OK] 미국 ETF 섹터 유입: {len(results)}개")
    return results


def collect_kr_flows() -> list[dict]:
    results = []
    try:
        from pykrx import stock as pstock
        today = datetime.now(KST)
        end   = today.strftime("%Y%m%d")
        start = (today - timedelta(days=14)).strftime("%Y%m%d")

        sector_foreign: dict[str, int] = {}
        sector_inst:    dict[str, int] = {}

        for market in ["KOSPI", "KOSDAQ"]:
            for inv_type, store in [("외국인합계", sector_foreign), ("기관합계", sector_inst)]:
                try:
                    df = pstock.get_market_net_purchases_of_equities_by_ticker(start, end, market, inv_type)
                    if df is None or df.empty:
                        continue
                    net_col = next((c for c in df.columns if "순매수" in c), None)
                    if not net_col:
                        continue
                    # 섹터별 집계 (간단히 시가총액 상위로 추정)
                    for ticker, row in df.iterrows():
                        store[str(ticker)] = store.get(str(ticker), 0) + int(row[net_col])
                except Exception as e:
                    print(f"  [WARN] kr_flow {market}/{inv_type}: {e}")

        # 전체 외국인/기관 순매수 합계만 반환 (섹터 매핑은 approximation)
        total_foreign = sum(sector_foreign.values())
        total_inst    = sum(sector_inst.values())
        if total_foreign != 0 or total_inst != 0:
            results.append({
                "sector":               "전체시장",
                "foreign_net_buy_5d":   total_foreign,
                "institution_net_buy_5d": total_inst,
                "flow_direction":       "inflow" if total_foreign > 0 else "outflow",
            })
        print(f"  [OK] 한국 수급: 외국인 {total_foreign:+,} 기관 {total_inst:+,}")
    except Exception as e:
        print(f"  [WARN] kr_flows 실패: {e}")
    return results


def collect_all() -> dict:
    print("  [돈흐름] 미국 ETF 수집 중...")
    us_flows = collect_us_flows()
    print("  [돈흐름] 한국 수급 수집 중...")
    kr_flows = collect_kr_flows()
    return {
        "date":      datetime.now(KST).strftime("%Y-%m-%d"),
        "updated_at": datetime.now(KST).isoformat(),
        "us_flows":  us_flows,
        "kr_flows":  kr_flows,
    }


def save_to_firebase(db, data: dict) -> None:
    today = data["date"]
    db.collection("money-flow").document("latest").set(data)
    db.collection("money-flow").document(today).set(data)
    print(f"  [OK] Firebase 저장: /money-flow/{today}")


def main():
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    from firebase_uploader import _init as firebase_init
    from firebase_admin import firestore

    firebase_init()
    db = firestore.client()

    print("=== ETF 자금흐름 수집 시작 ===")
    data = collect_all()
    save_to_firebase(db, data)
    print("=== 완료 ===")


if __name__ == "__main__":
    main()
