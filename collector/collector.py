import warnings
import time
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta, timezone
from config import FETCH_DAYS

warnings.filterwarnings("ignore")

KST = timezone(timedelta(hours=9))

_INDEX_TICKERS = {
    "kospi":   "^KS11",
    "kosdaq":  "^KQ11",
    "vix":     "^VIX",
    "usd_krw": "USDKRW=X",
    "cny_krw": "CNYKRW=X",
}


def get_market_indices() -> dict:
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


# ── 인덱스 데이터 (pykrx) ────────────────────────────────
def _fetch_index_pct_change(
    ticker: str, market: str, start: datetime, end: datetime
) -> pd.Series | None:
    """pykrx 인덱스 종가 → pct_change 시계열."""
    try:
        from pykrx import stock as pstock
        fromdate = start.strftime("%Y%m%d")
        todate   = end.strftime("%Y%m%d")
        df = pstock.get_index_ohlcv_by_date(fromdate, todate, ticker, market)
        if df is None or df.empty or len(df) < 5:
            return None
        close_col = next((c for c in df.columns if c in ("종가", "Close")), None)
        if close_col is None:
            return None
        return df[close_col].astype(float).pct_change().dropna()
    except Exception as e:
        print(f"  [WARN] 인덱스 {ticker}({market}): {e}")
        return None


# ── ETF 데이터 pykrx 폴백 (yfinance 실패 시) ─────────────
def _fetch_etf_pct_change_pykrx(
    code: str, start: datetime, end: datetime
) -> pd.Series | None:
    """pykrx로 ETF 종가 → pct_change (yfinance 실패 폴백)."""
    try:
        from pykrx import stock as pstock
        fromdate = start.strftime("%Y%m%d")
        todate   = end.strftime("%Y%m%d")
        df = pstock.get_market_ohlcv_by_date(fromdate, todate, code)
        if df is None or df.empty or len(df) < 5:
            return None
        close_col = next((c for c in df.columns if c in ("종가", "Close")), None)
        if close_col is None:
            return None
        return df[close_col].astype(float).pct_change().dropna()
    except Exception as e:
        print(f"  [WARN] pykrx ETF {code}: {e}")
        return None


# ── 섹터 데이터 수집 (하이브리드) ────────────────────────
def get_sector_data(sector_sources: dict, period_days: int = FETCH_DAYS) -> pd.DataFrame:
    """
    KRX 인덱스 또는 ETF 기반 섹터별 누적 수익률 DataFrame.
    ETF는 yfinance 먼저, 실패 시 pykrx로 폴백.
    """
    end   = datetime.today()
    start = end - timedelta(days=period_days * 2)
    sector_prices: dict[str, pd.Series] = {}

    for sector, src in sector_sources.items():
        # 구형 {sector: [tickers]} 형식 호환
        if isinstance(src, list):
            src = {"type": "etf", "tickers": src}

        src_type = src.get("type", "etf")

        # ── KRX 공식 인덱스 ──────────────────────────────
        if src_type == "index":
            ret = _fetch_index_pct_change(src["ticker"], src["market"], start, end)
            if ret is None or len(ret) < 5:
                print(f"  [WARN] '{sector}' 인덱스({src['ticker']}): 데이터 없음 — 스킵")
                continue
            sector_prices[sector] = (1 + ret).cumprod() * 100
            print(f"  [인덱스] {sector}: {len(ret)}일")

        # ── ETF (yfinance → pykrx 폴백) ──────────────────
        else:
            tickers = src.get("tickers", [])
            valid_returns: list[pd.Series] = []

            for ticker in tickers:
                krx_code = ticker.replace(".KS", "").replace(".KQ", "")
                ret: pd.Series | None = None

                # yfinance 시도
                try:
                    raw = yf.download(
                        ticker,
                        start=start.strftime("%Y-%m-%d"),
                        end=end.strftime("%Y-%m-%d"),
                        progress=False,
                        auto_adjust=True,
                    )
                    if raw.empty or len(raw) < 5:
                        raise ValueError("데이터 부족")
                    ret = raw["Close"].squeeze().pct_change().dropna()
                except Exception:
                    # pykrx 폴백
                    ret = _fetch_etf_pct_change_pykrx(krx_code, start, end)
                    if ret is not None:
                        print(f"  [pykrx 폴백] {ticker} → {krx_code} OK")
                    else:
                        print(f"  [WARN] {ticker}: yfinance·pykrx 모두 실패 — 스킵")

                if ret is not None and len(ret) >= 5:
                    valid_returns.append(ret)

            if not valid_returns:
                print(f"  [WARN] '{sector}': 유효 데이터 없음 — 스킵")
                continue

            avg_ret = pd.concat(valid_returns, axis=1).dropna(how="all").mean(axis=1)
            sector_prices[sector] = (1 + avg_ret).cumprod() * 100

    if not sector_prices:
        raise RuntimeError("수집된 섹터 데이터가 없습니다.")

    df = pd.DataFrame(sector_prices).dropna(how="all")
    return df.iloc[-period_days:] if len(df) >= period_days else df


# ── 외국인 순매수 (ETF 기반 섹터만) ─────────────────────
def get_foreign_net_buy(sector_etfs: dict) -> dict | None:
    """
    pykrx로 ETF 기반 섹터의 외국인 순매수.
    pykrx API 변경에 대비해 investor 파라미터 후보를 순서대로 시도.
    """
    try:
        from pykrx import stock as pstock

        today = datetime.now(KST)
        end   = today.strftime('%Y%m%d')
        start = (today - timedelta(days=10)).strftime('%Y%m%d')

        df_all = None
        for investor in ['외국인합계', '외국인', '전체']:
            try:
                df_all = pstock.get_market_net_purchases_of_equities_by_ticker(
                    start, end, 'KOSPI', investor
                )
                if df_all is not None and not df_all.empty:
                    print(f"  [OK] 외국인 순매수 investor='{investor}'")
                    break
            except Exception as e:
                print(f"  [WARN] 외국인 순매수 investor='{investor}': {e}")
                df_all = None

        if df_all is None or df_all.empty:
            print("  [WARN] 외국인 순매수: 모든 investor 파라미터 실패")
            return None

        net_col = next((c for c in df_all.columns if '순매수' in c), None)
        if not net_col:
            print("  [WARN] 외국인 순매수: 순매수 컬럼 없음")
            return None

        result: dict[str, float] = {}
        for sector, src in sector_etfs.items():
            tickers = src if isinstance(src, list) else src.get("tickers", [])
            total = 0.0
            for ticker in tickers:
                krx_t = ticker.replace('.KS', '').replace('.KQ', '')
                if krx_t in df_all.index:
                    total += float(df_all.loc[krx_t, net_col])
            if total != 0:
                result[sector] = total

        print(f"  [OK] 외국인 순매수 수집: {len(result)}개 섹터")
        return result

    except Exception as e:
        print(f"  [WARN] 외국인 순매수 수집 실패 (스킵): {e}")
        return None
