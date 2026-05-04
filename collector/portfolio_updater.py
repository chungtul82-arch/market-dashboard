"""Firebase 포트폴리오 가격 일일 업데이트."""
import warnings
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))

import yfinance as yf

warnings.filterwarnings("ignore")


def update_portfolio_prices(db) -> bool:
    """portfolio/latest 에서 종목 읽어 yfinance로 가격 갱신."""
    try:
        doc_ref = db.collection("portfolio").document("latest")
        doc     = doc_ref.get()
        if not doc.exists:
            print("  [INFO] 포트폴리오 데이터 없음 — 스킵")
            return True

        portfolio = doc.to_dict()
        holdings  = portfolio.get("holdings", [])
        if not holdings:
            return True

        symbols = list({h["symbol"] for h in holdings})
        print(f"  포트폴리오 가격 업데이트: {len(symbols)}개 종목")

        prices: dict[str, dict] = {}
        for symbol in symbols:
            try:
                hist = yf.download(symbol, period="3d", progress=False, auto_adjust=True)
                if hist.empty or len(hist) < 1:
                    continue
                close       = hist["Close"].squeeze()
                cur         = float(close.iloc[-1])
                prev        = float(close.iloc[-2]) if len(close) > 1 else cur
                daily_chg   = cur - prev
                daily_pct   = (daily_chg / prev * 100) if prev != 0 else 0
                prices[symbol] = {"currentPrice": cur, "dailyChange": daily_chg, "dailyChangePct": daily_pct}
            except Exception as e:
                print(f"  [WARN] {symbol}: {e}")

        updated = []
        for h in holdings:
            p = prices.get(h["symbol"])
            if p:
                h["currentPrice"]    = p["currentPrice"]
                h["dailyChange"]     = p["dailyChange"]
                h["dailyChangePct"]  = p["dailyChangePct"]
                h["currentValue"]    = p["currentPrice"] * h["quantity"]
                h["pnl"]             = h["currentValue"] - h["investedValue"]
                h["returnPct"]       = (h["pnl"] / h["investedValue"] * 100) if h["investedValue"] else 0
            updated.append(h)

        total_cur    = sum(h["currentValue"] for h in updated)
        total_inv    = sum(h["investedValue"] for h in updated)
        total_pnl    = total_cur - total_inv
        total_ret    = (total_pnl / total_inv * 100) if total_inv else 0

        doc_ref.update({
            "holdings":          updated,
            "totalCurrentValue": total_cur,
            "totalInvested":     total_inv,
            "totalPnl":          total_pnl,
            "totalReturnPct":    total_ret,
            "pricesUpdatedAt":   datetime.now(KST).isoformat(),
        })
        print(f"  [OK] 포트폴리오 가격 업데이트 완료 (총평가: {total_cur:,.0f}원)")
        return True

    except Exception as e:
        print(f"  [ERROR] 포트폴리오 업데이트 실패: {e}")
        return False
