import pandas as pd
from config import PERIOD_SHORT, PERIOD_MID, PERIOD_LONG


def calc_returns(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for sector in df.columns:
        series = df[sector].dropna()
        if len(series) < 2:
            continue

        def _ret(n: int) -> float:
            return float((series.iloc[-1] / series.iloc[-n - 1]) - 1) if len(series) > n else float("nan")

        rows.append({
            "sector":     sector,
            "return_5d":  _ret(PERIOD_SHORT),
            "return_20d": _ret(PERIOD_MID),
            "return_60d": _ret(PERIOD_LONG),
        })

    return pd.DataFrame(rows).set_index("sector")


def calc_relative_strength(returns_df: pd.DataFrame) -> pd.DataFrame:
    out = returns_df.copy()

    for col in ["return_5d", "return_20d", "return_60d"]:
        if col not in out.columns or out[col].dropna().empty:
            out[f"pct_{col}"] = float("nan")
        else:
            out[f"pct_{col}"] = out[col].rank(pct=True) * 100

    w5  = out["pct_return_5d"].fillna(0)  if "pct_return_5d"  in out.columns else pd.Series(0, index=out.index)
    w20 = out["pct_return_20d"].fillna(0) if "pct_return_20d" in out.columns else pd.Series(0, index=out.index)
    w60 = out["pct_return_60d"].fillna(0) if "pct_return_60d" in out.columns else pd.Series(0, index=out.index)

    out["rs_score"] = w5 * 0.50 + w20 * 0.30 + w60 * 0.20
    return out.sort_values("rs_score", ascending=False)


def detect_rotation_signal(returns_df: pd.DataFrame) -> list[dict]:
    signals: list[dict] = []
    df = returns_df.dropna(subset=["return_5d", "return_20d"])
    if df.empty:
        return signals

    n = len(df)
    rank_5d  = df["return_5d"].rank(ascending=False)
    rank_20d = df["return_20d"].rank(ascending=False)
    threshold = max(1, int(n * 0.4))

    for sector, val in df["return_5d"].nlargest(3).items():
        signals.append({"sector": sector, "signal": "강세 진입", "value": val})

    for sector in df.index:
        if rank_20d[sector] <= threshold and rank_5d[sector] > (n - threshold):
            signals.append({"sector": sector, "signal": "이탈 경고", "value": df.loc[sector, "return_5d"]})

    for sector in df.index:
        val = df.loc[sector, "return_5d"]
        if val >= 0.05:
            signals.append({"sector": sector, "signal": "단기 과열", "value": val})

    return signals
