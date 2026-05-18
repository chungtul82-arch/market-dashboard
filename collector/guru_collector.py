"""
거장 포트폴리오 수집기 — SEC EDGAR 13F-HR 파싱
Firebase /guru-portfolios/latest 에 저장
"""
import os, time, json, re
from datetime import datetime, timezone
from xml.etree import ElementTree as ET
import requests

KST = timezone(__import__('datetime').timedelta(hours=9))

HEADERS = {"User-Agent": "MarketDashboard chungtul82@gmail.com", "Accept-Encoding": "gzip, deflate"}

GURUS = {
    "워런 버핏 (버크셔)":       "0001067983",
    "레이 달리오 (브리지워터)":  "0001350694",
    "마이클 버리 (사이언)":     "0001649339",
    "캐시 우드 (ARK)":          "0001697748",
    "빌 애크먼 (퍼싱스퀘어)":   "0001336528",
}

SECTOR_MAP = {
    "Technology":            "AI·반도체",
    "Information Technology":"AI·반도체",
    "Energy":                "전력·원자력",
    "Industrials":           "중공업·조선",
    "Healthcare":            "바이오",
    "Health Care":           "바이오",
    "Financials":            "증권·금융",
    "Financial Services":    "증권·금융",
    "Materials":             "소부장",
    "Basic Materials":       "소부장",
    "Consumer Discretionary":"소비재",
    "Consumer Staples":      "필수소비재",
    "Communication Services":"미디어·통신",
    "Real Estate":           "부동산",
    "Utilities":             "유틸리티",
    "Defense":               "방산",
}

# 주요 CUSIP → 티커 매핑 (상위 보유 종목)
CUSIP_TICKER = {
    "037833100": "AAPL",  "594918104": "META",  "023135106": "AMZN",
    "02079K305": "GOOGL", "67066G104": "NVDA",  "88160R101": "TSLA",
    "78378X107": "MSFT",  "17275R102": "CSCO",  "92826C839": "V",
    "45866F104": "ISRG",  "91282CHV7": "BAC",   "038222105": "AXP",
    "40434L105": "HPQ",   "20030N101": "COF",   "172967424": "C",
    "055622104": "BA",    "097023105": "BK",     "92343V104": "VZ",
    "31428X106": "FDX",   "806517504": "SFM",
}


def _get(url: str, retries=3) -> requests.Response | None:
    for i in range(retries):
        try:
            r = requests.get(url, headers=HEADERS, timeout=20)
            if r.status_code == 200:
                return r
            if r.status_code == 429:
                time.sleep(5 * (i + 1))
        except Exception as e:
            print(f"  [WARN] GET {url}: {e}")
            time.sleep(2)
    return None


def _find_13f_accession(cik: str) -> tuple[str, str, str] | None:
    """(accession_raw, accession_nodash, filing_date) 반환."""
    padded = cik.lstrip("0").zfill(10)
    url = f"https://data.sec.gov/submissions/CIK{padded}.json"
    r = _get(url)
    if not r:
        return None
    try:
        data = r.json()
        recent = data.get("filings", {}).get("recent", {})
        forms  = recent.get("form", [])
        accs   = recent.get("accessionNumber", [])
        dates  = recent.get("filingDate", [])
        for form, acc, date in zip(forms, accs, dates):
            if form == "13F-HR":
                return acc, acc.replace("-", ""), date
    except Exception as e:
        print(f"  [WARN] submissions parse: {e}")
    return None


def _fetch_holdings_xml(cik_numeric: str, acc_nodash: str) -> str | None:
    """13F information table XML 내용 반환."""
    idx_url = f"https://www.sec.gov/Archives/edgar/data/{cik_numeric}/{acc_nodash}/{acc_nodash}-index.json"
    r = _get(idx_url)
    if not r:
        return None
    try:
        idx = r.json()
        docs = idx.get("directory", {}).get("item", [])
        for doc in docs:
            name = doc.get("name", "").lower()
            if "infotable" in name or "form13f" in name:
                xml_url = f"https://www.sec.gov/Archives/edgar/data/{cik_numeric}/{acc_nodash}/{doc['name']}"
                xr = _get(xml_url)
                if xr:
                    return xr.text
    except Exception as e:
        print(f"  [WARN] index parse: {e}")
    return None


def _parse_holdings_xml(xml_text: str) -> list[dict]:
    """13F XML → holding list 파싱."""
    holdings = []
    try:
        # 네임스페이스 제거
        xml_clean = re.sub(r' xmlns[^"]*"[^"]*"', '', xml_text)
        root = ET.fromstring(xml_clean)
        ns = {"n": ""}

        for info in root.iter("infoTable"):
            name_el  = info.find("nameOfIssuer")
            cusip_el = info.find("cusip")
            value_el = info.find("value")
            shrs_el  = info.find("shrsOrPrnAmt/sshPrnamt") or info.find("sshPrnamt")

            if name_el is None or value_el is None:
                continue
            name   = (name_el.text or "").strip()
            cusip  = (cusip_el.text or "").strip() if cusip_el is not None else ""
            value  = int(value_el.text or 0) * 1000  # thousands → USD
            shares = int(shrs_el.text or 0) if shrs_el is not None else 0
            ticker = CUSIP_TICKER.get(cusip, "")

            holdings.append({
                "ticker": ticker,
                "name":   name,
                "cusip":  cusip,
                "value_usd":  value,
                "shares": shares,
                "sector": "",
                "weight_pct": 0.0,
                "change_type": "unchanged",
            })
    except Exception as e:
        print(f"  [WARN] XML parse error: {e}")
    return holdings


def _enrich_with_sectors(holdings: list[dict]) -> list[dict]:
    """yfinance로 섹터 보완 (최대 20개 티커)."""
    try:
        import yfinance as yf
        tickers = [h["ticker"] for h in holdings if h["ticker"]][:20]
        if not tickers:
            return holdings
        info_map = {}
        for t in tickers:
            try:
                info = yf.Ticker(t).info
                info_map[t] = SECTOR_MAP.get(info.get("sector", ""), "기타")
                time.sleep(0.1)
            except Exception:
                pass
        for h in holdings:
            if h["ticker"] in info_map:
                h["sector"] = info_map[h["ticker"]]
    except Exception as e:
        print(f"  [WARN] sector enrich: {e}")
    return holdings


def fetch_13f(guru_name: str, cik: str) -> dict | None:
    print(f"  [{guru_name}] 13F 수집 중...")
    cik_numeric = cik.lstrip("0")
    result = _find_13f_accession(cik)
    if not result:
        print(f"  [{guru_name}] 13F-HR 파일링 없음")
        return None
    acc_raw, acc_nodash, filing_date = result
    print(f"  [{guru_name}] 파일링: {acc_raw} ({filing_date})")

    xml_text = _fetch_holdings_xml(cik_numeric, acc_nodash)
    if not xml_text:
        print(f"  [{guru_name}] XML 다운로드 실패")
        return None

    holdings = _parse_holdings_xml(xml_text)
    if not holdings:
        print(f"  [{guru_name}] 보유종목 파싱 실패")
        return None

    holdings = _enrich_with_sectors(holdings)

    total_value = sum(h["value_usd"] for h in holdings)
    if total_value > 0:
        for h in holdings:
            h["weight_pct"] = round(h["value_usd"] / total_value * 100, 2)

    # 섹터별 비중 계산
    sector_weights: dict[str, float] = {}
    for h in holdings:
        sec = h["sector"] or "기타"
        sector_weights[sec] = round(sector_weights.get(sec, 0) + h["weight_pct"], 2)

    # 상위 20개만 저장
    holdings_top = sorted(holdings, key=lambda x: x["value_usd"], reverse=True)[:20]

    return {
        "guru":           guru_name,
        "report_date":    filing_date,
        "total_value_usd": total_value,
        "holdings":       holdings_top,
        "sector_weights": sector_weights,
        "updated_at":     datetime.now(KST).isoformat(),
    }


def fetch_all_gurus() -> dict[str, dict]:
    results = {}
    for guru_name, cik in GURUS.items():
        try:
            data = fetch_13f(guru_name, cik)
            if data:
                results[guru_name] = data
        except Exception as e:
            print(f"  [ERROR] {guru_name}: {e}")
        time.sleep(1)  # SEC rate limit
    return results


def save_to_firebase(db, guru_data: dict[str, dict]) -> None:
    from firebase_admin import firestore as fs
    today = datetime.now(KST).strftime("%Y-%m-%d")
    batch = db.batch()
    latest_ref = db.collection("guru-portfolios").document("latest")

    for guru_name, data in guru_data.items():
        # 날짜별 저장
        date_ref = db.collection("guru-portfolios").document(today).collection("gurus").document(guru_name)
        batch.set(date_ref, data)
        # latest 저장
        batch.set(latest_ref, {guru_name: data}, merge=True)

    batch.commit()
    print(f"  [OK] Firebase 저장 완료: {len(guru_data)}개 거장")


def main():
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    from firebase_uploader import _init as firebase_init
    from firebase_admin import firestore

    firebase_init()
    db = firestore.client()

    print("=== 거장 포트폴리오 수집 시작 ===")
    guru_data = fetch_all_gurus()
    if guru_data:
        save_to_firebase(db, guru_data)
    print(f"=== 완료: {len(guru_data)}/{len(GURUS)}개 ===")


if __name__ == "__main__":
    main()
