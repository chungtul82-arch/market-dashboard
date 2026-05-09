"""
박병창 매매전략 기반 주도주 스크리너
스코어링 시스템: 최대 17점
  A그룹 (추세)  : 6점
  B그룹 (타이밍): 3점
  C그룹 (수급)  : 4점
  D그룹 (섹터)  : +2 ~ -1점
등급: A=10점+, B=7~9점, C=6점 이하(제외)

유니버스: FinanceDataReader (로그인 불필요)
가격데이터: yfinance 배치
수급데이터: pykrx (KRX_ID / KRX_PW 환경변수 필요)
"""
import warnings
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta, timezone

warnings.filterwarnings("ignore")

KST           = timezone(timedelta(hours=9))
MIN_PRICE     = 1_000
MIN_TRADE_VAL = 1_000_000_000
TOP_N         = 30
BATCH         = 25
HIST_DAYS     = 80

# FinanceDataReader 업종명 + pykrx 업종명 모두 포함
SECTOR_MAPPING = {
    "AI·반도체":   ["반도체", "IT부품", "전자부품", "전기전자"],
    "소부장":      ["화학", "기계", "소재", "비철금속", "철강금속", "금속"],
    "전력·전기":   ["전력", "유틸리티", "전기가스"],
    "원자력":      ["에너지", "원자력"],
    "방산":        ["방위산업", "항공우주"],
    "중공업·조선": ["조선", "중공업", "운수장비"],
    "재건·인프라": ["건설", "인프라", "시멘트", "비금속"],
    "바이오":      ["바이오", "제약", "헬스케어", "의료", "의약"],
    "2차전지":     ["전기차", "배터리", "이차전지"],
    "증권·금융":   ["증권", "은행", "금융", "보험"],
}


def map_sector(sector_str: str) -> str:
    s = str(sector_str)
    for mapped, kws in SECTOR_MAPPING.items():
        if any(k in s for k in kws):
            return mapped
    return ""


# ── pykrx로 업종 보강 ─────────────────────────────────────
def _get_krx_sectors(market: str, td: str) -> dict[str, str]:
    """pykrx에서 공식 KRX 업종명 가져오기. {티커: 업종명} 반환."""
    try:
        from pykrx import stock as pstock
        cap = pstock.get_market_cap_by_ticker(td, market=market)
        if cap is None or cap.empty:
            return {}
        sec_col = next((c for c in cap.columns if '업종' in c), None)
        if not sec_col:
            return {}
        result = {str(k): str(v) for k, v in cap[sec_col].items() if v}
        print(f"  pykrx 업종 수집: {market} {len(result)}개")
        return result
    except Exception as e:
        print(f"  [WARN] pykrx 업종 수집 실패 ({market}): {e}")
        return {}


# ── 유니버스 (FinanceDataReader + pykrx 업종) ──────────────
def get_universe() -> pd.DataFrame:
    try:
        import FinanceDataReader as fdr

        # pykrx로 업종 미리 수집 (최근 거래일)
        today = datetime.now(KST)
        td = today.strftime('%Y%m%d')
        sector_map_krx: dict[str, str] = {}
        for m in ['KOSPI', 'KOSDAQ']:
            sector_map_krx.update(_get_krx_sectors(m, td))

        dfs = []
        for market in ['KOSPI', 'KOSDAQ']:
            try:
                df = fdr.StockListing(market)
                if df is None or df.empty:
                    print(f"  [WARN] {market} 목록 비어있음")
                    continue

                df.columns = [c.strip() for c in df.columns]
                sym_col  = next((c for c in df.columns if c in ('Symbol', 'Code', 'Ticker')), None)
                name_col = next((c for c in df.columns if c in ('Name', '종목명', 'name')), None)

                if sym_col is None:
                    print(f"  [WARN] {market}: Symbol 컬럼 없음 — cols: {list(df.columns)}")
                    continue

                result = pd.DataFrame(index=df[sym_col])
                result.index.name = None
                result['name']   = df[name_col].values if name_col else df[sym_col].values
                result['market'] = market
                # pykrx 업종 우선, 없으면 fdr 업종
                fdr_sec = None
                sec_col = next((c for c in df.columns if c in ('Sector', 'Industry', '업종')), None)
                if sec_col is not None:
                    fdr_sec = df[sec_col].values
                result['sector_krx'] = [
                    sector_map_krx.get(str(t), str(fdr_sec[i]) if fdr_sec is not None else '')
                    for i, t in enumerate(df[sym_col].values)
                ]
                dfs.append(result)
                print(f"  {market}: {len(result)}개")
            except Exception as e:
                print(f"  [WARN] {market} 목록 실패: {e}")

        if not dfs:
            return pd.DataFrame()

        df = pd.concat(dfs)
        df = df[~df['name'].astype(str).str.contains(
            '스팩|SPAC|ETF|ETN|인버스|레버리지|리츠', na=False, regex=True)]

        # 업종 분포 로그 (상위 10개)
        top_sectors = df['sector_krx'].value_counts().head(10)
        print(f"  업종 상위 10개: {dict(top_sectors)}")
        print(f"  유니버스 총 {len(df)}개 (필터 전)")
        return df
    except Exception as e:
        print(f"  [ERROR] 유니버스 구성 실패: {e}")
        return pd.DataFrame()


# ── 가격 히스토리 (yfinance 배치) ─────────────────────────
def get_price_history_batch(universe: pd.DataFrame, start: str, end: str) -> dict:
    tickers = list(universe.index)
    markets  = universe['market'].to_dict() if 'market' in universe.columns else {}
    yf_map   = {
        f"{t}.KS" if markets.get(t) == 'KOSPI' else f"{t}.KQ": t
        for t in tickers
    }
    yf_keys = list(yf_map.keys())
    results  = {}

    for i in range(0, len(yf_keys), BATCH):
        batch = yf_keys[i:i+BATCH]
        try:
            raw = yf.download(
                batch, start=start, end=end,
                progress=False, auto_adjust=True, group_by='ticker',
            )
            for yf_t in batch:
                orig = yf_map[yf_t]
                try:
                    df = raw[yf_t] if len(batch) > 1 else raw
                    if df is None or df.empty or len(df) < 5:
                        continue
                    df = df.dropna(subset=['Close'])
                    if len(df) >= 5:
                        results[orig] = df
                except Exception:
                    pass
        except Exception as e:
            print(f"  [WARN] 배치 {i} 실패: {e}")

    return results


# ── 투자자 수급 (pykrx, KRX_ID/KRX_PW 필요) ──────────────
def get_investor_streaks() -> dict:
    result: dict[str, dict] = {}
    try:
        from pykrx import stock as pstock
        today = datetime.now(KST)
        end   = today.strftime('%Y%m%d')
        start = (today - timedelta(days=14)).strftime('%Y%m%d')

        for market in ['KOSPI', 'KOSDAQ']:
            for investor, key in [('외국인합계', 'foreign'), ('기관합계', 'institution')]:
                try:
                    df = pstock.get_market_net_purchases_of_equities_by_ticker(
                        start, end, market, investor)
                    if df is None or df.empty:
                        continue
                    net_col = next((c for c in df.columns if '순매수' in c), None)
                    if not net_col:
                        continue
                    for ticker, row in df.iterrows():
                        if ticker not in result:
                            result[ticker] = {}
                        if float(row[net_col]) > 0:
                            result[ticker][f'{key}_streak'] = \
                                result[ticker].get(f'{key}_streak', 0) + 1
                except Exception as e:
                    print(f"  [WARN] 수급 {market}/{investor}: {e}")

        if result:
            print(f"  [OK] 투자자 수급: {len(result)}개 종목")
        else:
            print("  [WARN] 투자자 수급 데이터 없음 (KRX 로그인 확인)")
    except Exception as e:
        print(f"  [WARN] 투자자 수급 전체 실패: {e}")
    return result


# ── 섹터 RS (Firebase) ────────────────────────────────────
def get_sector_rs(db) -> dict:
    try:
        doc = db.collection('reports').document('latest').get()
        if not doc.exists:
            return {}
        return {k: v.get('rs_score', 50) for k, v in doc.to_dict().get('sectors', {}).items()}
    except Exception as e:
        print(f"  [WARN] 섹터 RS 실패: {e}")
        return {}


# ── 스코어링 ──────────────────────────────────────────────
def score_stock(ticker: str, row: pd.Series, hist: pd.DataFrame,
                investor: dict, sector_rs: dict) -> dict | None:
    if hist.empty or len(hist) < 20:
        return None

    close  = hist['Close'].astype(float)
    volume = hist['Volume'].astype(float)
    opens  = hist['Open'].astype(float) if 'Open' in hist.columns else close

    c0 = float(close.iloc[-1])
    o0 = float(opens.iloc[-1])
    if c0 < MIN_PRICE:
        return None

    vma20  = float(volume.tail(20).mean())
    if c0 * vma20 < MIN_TRADE_VAL:
        return None

    ma5  = float(close.tail(5).mean())
    ma20 = float(close.tail(20).mean())
    ma60 = float(close.tail(60).mean()) if len(close) >= 60 else None
    high52 = float(close.tail(250).max() if len(close) >= 250 else close.max())
    h52r   = c0 / high52 * 100

    v0     = float(volume.iloc[-1])
    vratio = v0 / vma20 if vma20 > 0 else 1.0
    vprev  = float(volume.iloc[-2]) if len(volume) >= 2 else v0
    c_prev = float(close.iloc[-2]) if len(close) >= 2 else c0
    chg    = (c0 / c_prev - 1) * 100

    # A: 추세 (max 6)
    score_a = 0
    if ma60 and ma5 > ma20 > ma60:  score_a += 3
    elif ma5 > ma20:                 score_a += 1
    if   h52r >= 90 and v0 > vma20: score_a += 3
    elif h52r >= 90:                 score_a += 1
    elif h52r >= 80:                 score_a += 1

    # B: 타이밍 (max 3)
    score_b, pattern = 0, None
    if (c0 > ma5 and -1 <= chg <= 0 and
            abs(c0 - ma5) / ma5 <= 0.03 and v0 < vprev * 0.7):
        score_b, pattern = 2, "B1"
    if len(volume) >= 3:
        vdec = float(volume.iloc[-3]) >= float(volume.iloc[-2]) or float(volume.iloc[-2]) <= vma20
        if ma5 > ma20 and c0 > o0 and v0 > vprev and vdec and score_b < 3:
            score_b, pattern = 3, "B2"
    below = any(float(p) < ma20 for p in close.tail(5).iloc[:-1])
    if below and c0 >= ma20 and vratio >= 1.5 and c0 > o0 and score_b < 3:
        score_b, pattern = 3, "B3"

    # C: 수급 (max 4) — KRX 로그인 시 실제 데이터, 아니면 0
    inv  = investor.get(ticker, {})
    fs   = inv.get('foreign_streak', 0)
    ins  = inv.get('institution_streak', 0)
    score_c = (2 if fs >= 3 else 1 if fs >= 1 else 0) + \
              (2 if ins >= 3 else 1 if ins >= 1 else 0)

    # D: 섹터 RS (max +2, min -1)
    sk  = str(row.get('sector_krx', ''))
    sm  = map_sector(sk)
    rs  = sector_rs.get(sm, 50) if sm else 50
    score_d = 2 if rs >= 70 else (-1 if rs < 40 else 0)

    total = score_a + score_b + score_c + score_d
    grade = 'A' if total >= 10 else ('B' if total >= 7 else 'C')
    if grade == 'C':
        return None

    sigs = []
    if ma60 and ma5 > ma20 > ma60: sigs.append("정배열")
    elif ma5 > ma20:               sigs.append("단기정배열")
    if h52r >= 90:                 sigs.append("52주신고가")
    if pattern:
        sigs.append({'B1': '패턴1-눌림', 'B2': '패턴2-양봉', 'B3': '패턴3-반등'}[pattern])
    if fs >= 3:    sigs.append(f"외국인{fs}일↑")
    elif fs >= 1:  sigs.append("외국인순매수")
    if ins >= 3:   sigs.append(f"기관{ins}일↑")
    elif ins >= 1: sigs.append("기관순매수")
    if vratio >= 2.0: sigs.append(f"거래량{vratio:.1f}배")

    return {
        'ticker': ticker, 'name': str(row.get('name', ticker)),
        'market': str(row.get('market', 'KOSPI')),
        'sector_krx': sk, 'sector_mapped': sm,
        'current_price': int(c0), 'change_pct': round(chg, 2),
        'volume': int(v0), 'volume_ratio': round(vratio, 2),
        'ma5': int(ma5), 'ma20': int(ma20), 'ma60': int(ma60) if ma60 else None,
        'ma_alignment': bool(ma60 and ma5 > ma20 > ma60),
        'high_52w': int(high52), 'high_52w_ratio': round(h52r, 1),
        'near_52w_high': h52r >= 90,
        'foreign_buy_streak': fs, 'institution_buy_streak': ins,
        'buy_pattern': pattern, 'sector_strength': round(float(rs), 1),
        'score_a': score_a, 'score_b': score_b,
        'score_c': score_c, 'score_d': score_d,
        'total_score': total, 'grade': grade,
        'signals': [s for s in sigs if s],
        'price_history': [int(p) for p in close.tail(5).tolist()],
    }


# ── 메인 ──────────────────────────────────────────────────
def run_screener(db=None) -> list[dict]:
    today = datetime.now(KST)
    td    = today.strftime('%Y%m%d')

    print("  [스크리너] 유니버스 구성 (FinanceDataReader)...")
    universe = get_universe()
    if universe.empty:
        print("  [스크리너] 유니버스 없음")
        return []

    total = len(universe)
    start = (today - timedelta(days=HIST_DAYS)).strftime('%Y-%m-%d')
    end   = (today + timedelta(days=1)).strftime('%Y-%m-%d')

    print(f"  [스크리너] 가격 히스토리 다운로드 ({total}개)...")
    hists = get_price_history_batch(universe, start, end)
    print(f"  [스크리너] 다운로드 완료: {len(hists)}개")

    print("  [스크리너] 투자자 수급 조회...")
    investor = get_investor_streaks()

    sector_rs = get_sector_rs(db) if db else {}
    print(f"  [스크리너] 섹터 RS: {len(sector_rs)}개")

    results: list[dict] = []
    for ticker, hist in hists.items():
        if ticker not in universe.index:
            continue
        scored = score_stock(ticker, universe.loc[ticker], hist, investor, sector_rs)
        if scored:
            results.append(scored)

    results.sort(key=lambda x: x['total_score'], reverse=True)
    top     = results[:TOP_N]
    grade_a = sum(1 for r in top if r['grade'] == 'A')
    grade_b = sum(1 for r in top if r['grade'] == 'B')
    print(f"  [스크리너] 완료: A등급 {grade_a}개 / B등급 {grade_b}개 / 전체 {len(results)}개")

    if db:
        _upload(db, td[:4]+'-'+td[4:6]+'-'+td[6:], top, total, grade_a, grade_b)

    return top


def _upload(db, date_str: str, results: list, total: int, ga: int, gb: int):
    from firebase_admin import firestore as fs
    data = {
        'date': date_str, 'updated_at': fs.SERVER_TIMESTAMP,
        'total_scanned': total, 'grade_a_count': ga, 'grade_b_count': gb,
        'results': results,
    }
    batch = db.batch()
    col   = db.collection('screener')
    batch.set(col.document('latest'),  data)
    batch.set(col.document(date_str),  data)
    batch.commit()
    print(f"  [OK] 스크리너 Firebase 업로드 완료")
