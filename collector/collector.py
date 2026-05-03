import warnings
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
from config import FETCH_DAYS

warnings.filterwarnings("ignore")

_INDEX_TICKERS = {
    "kospi":   "^KS11",
    "kosdaq":  "^KQ11",
    "vix":     "^VIX",
    "usd_krw": "USDKRW=X",
}


def get_market_indices() -> dict:
    """코스피·코스닥·VIX·달러/원 수집."""
    result: dict = {}
    for key, ticker in _INDEX_TICKERS.items():
        try:
            raw = yf.download(ticker, period="22d", progress=False, auto_adjust=True)
            if raw.empty or len(raw) < 2:
                print(f"  [WARN] {ticker}: 데이터 부족 — 스킵")
                continue
            close      = raw["Close"].squeeze()
            value      = float(close.iloc[-1])
            prev       = float(close.iloc[-2])
            change_pct = (value - prev) / prev
            history    = [round(float(v), 2) for v in close.tail(10).tolist()]

            entry: dict = {
                "value":      round(value, 2),
                "change_pct": round(change_pct, 6),
                "history":    history,
            }
            if key == "vix":
                entry["label"] = "탐욕" if value < 15 else ("공포" if value >= 25 else "중립")

            result[key] = entry
        except Exception as exc:
            print(f"  [WARN] {ticker}: {exc} — 스킵")
    return result


def get_sector_data(sector_etfs: dict, period_days: int = FETCH_DAYS) -> pd.DataFrame:
    end   = datetime.today()
    start = end - timedelta(days=period_days * 2)
    sector_prices: dict[str, pd.Series] = {}

    for sector, tickers in sector_etfs.items():
        valid_returns: list[pd.Series] = []
        for ticker in tickers:
            try:
                raw = yf.download(
                    ticker,
                    start=start.strftime("%Y-%m-%d"),
                    end=end.strftime("%Y-%m-%d"),
                    progress=False,
                    auto_adjust=True,
                )
                if raw.empty or len(raw) < 5:
                    print(f"  [WARN] {ticker}: 데이터 부족 — 스킵")
                    continue
                ret = raw["Close"].squeeze().pct_change().dropna()
                valid_returns.append(ret)
            except Exception as exc:
                print(f"  [WARN] {ticker}: {exc} — 스킵")

        if not valid_returns:
            print(f"  [WARN] '{sector}': 유효 티커 없음 — 스킵")
            continue

        avg_ret    = pd.concat(valid_returns, axis=1).dropna(how="all").mean(axis=1)
        cumulative = (1 + avg_ret).cumprod() * 100
        sector_prices[sector] = cumulative

    if not sector_prices:
        raise RuntimeError("수집된 섹터 데이터가 없습니다.")

    df = pd.DataFrame(sector_prices).dropna(how="all")
    return df.iloc[-period_days:] if len(df) >= period_days else df


def get_foreign_net_buy(sector_etfs: dict) -> dict | None:
    """외국인 순매수 수집 — 현재 미지원, None 반환."""
    print("  [INFO] 외국인 순매수 수집 생략 (pykrx API 미지원)")
    return None
