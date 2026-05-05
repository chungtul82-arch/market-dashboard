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


def detect_rotation_signal(
    rs_df: pd.DataFrame,
    prev_rs_df: pd.DataFrame | None = None,
) -> list[dict]:
    """
    개선된 신호 감지:
      강세 진입: RS ≥ 60 AND 5일간 RS +10 이상 상승 (모멘텀 가속)
      이탈 경고: 직전 RS ≥ 60 이었으나 5일간 -15 이하 급락
      저점 반등: RS < 40 AND 5일간 RS +5 이상 개선
      단기 과열: 5일 수익률이 전체 섹터 평균 +1.5σ 초과 (Z-score)
    prev_rs_df 없으면 절대값 기준 fallback 적용.
    """
    signals: list[dict] = []
    df = rs_df.dropna(subset=["return_5d", "return_20d", "rs_score"])
    if df.empty:
        return signals

    has_prev = prev_rs_df is not None and not prev_rs_df.empty

    # Z-score 기반 단기 과열 — 전체 섹터 평균·표준편차 사용
    ret5_vals = df["return_5d"].dropna()
    mean5 = float(ret5_vals.mean())
    std5  = float(ret5_vals.std()) if len(ret5_vals) > 1 else 0.0

    for sector in df.index:
        rs_now = float(df.loc[sector, "rs_score"])
        ret5   = float(df.loc[sector, "return_5d"])
        ret20  = float(df.loc[sector, "return_20d"])

        if has_prev and sector in prev_rs_df.index:
            rs_prev = float(prev_rs_df.loc[sector, "rs_score"])
            delta   = rs_now - rs_prev

            if rs_now >= 60 and delta >= 10:
                signals.append({"sector": sector, "signal": "강세 진입", "value": ret5})
            elif rs_prev >= 60 and delta <= -15:
                signals.append({"sector": sector, "signal": "이탈 경고", "value": ret5})
            elif rs_now < 40 and delta >= 5:
                signals.append({"sector": sector, "signal": "저점 반등", "value": ret5})
        else:
            # prev 없을 때 절대값 기준 fallback
            if rs_now >= 70:
                signals.append({"sector": sector, "signal": "강세 진입", "value": ret5})
            elif rs_now < 40 and ret20 > 0 and ret5 < 0:
                signals.append({"sector": sector, "signal": "이탈 경고", "value": ret5})

        # 단기 과열: Z-score > 1.5 (항상 적용)
        if std5 > 0 and (ret5 - mean5) / std5 > 1.5:
            signals.append({"sector": sector, "signal": "단기 과열", "value": ret5})

    return signals
