"""
뉴스 수집기 — Google News RSS 기반
보유 테마별 키워드 필터링
Firebase /portfolio-news/{날짜} 에 저장
"""
import os
import time
from datetime import datetime, timedelta, timezone
from xml.etree import ElementTree as ET
from urllib.parse import quote
import requests

KST = timezone(timedelta(hours=9))

MY_THEMES = {
    "AI·반도체":   ["반도체", "AI", "HBM", "SK하이닉스", "삼성전자", "엔비디아", "NVDA"],
    "원자력":      ["원자력", "원전", "SMR", "두산에너빌", "원자로"],
    "방산":        ["방산", "한화에어로", "방위산업", "K방산", "방산수출"],
    "전력·인프라": ["전력", "변압기", "데이터센터", "AI인프라", "HVDC"],
    "조선·해운":   ["조선", "해운", "LNG선", "HD현대", "삼성중공업"],
    "바이오":      ["바이오", "나스닥바이오", "FDA", "신약", "임상"],
    "로봇":        ["로봇", "휴머노이드", "자동화", "테슬라봇"],
    "금":          ["금현물", "금값", "금리", "금 ETF"],
    "2차전지":     ["배터리", "2차전지", "전기차", "LFP"],
    "증권·금융":   ["증권", "금융주", "코스피", "환율"],
}

GNEWS_BASE = "https://news.google.com/rss/search?hl=ko&gl=KR&ceid=KR:ko&q="


def _fetch_gnews(query: str, max_items: int = 5) -> list[dict]:
    url = GNEWS_BASE + quote(query) + "&when=1d"
    articles = []
    try:
        r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
        if not r.ok:
            return []
        root = ET.fromstring(r.content)
        for item in root.iter("item"):
            title_el = item.find("title")
            link_el  = item.find("link")
            pub_el   = item.find("pubDate")
            src_el   = item.find("{http://purl.org/dc/elements/1.1/}source") or item.find("source")

            if title_el is None:
                continue
            title    = (title_el.text or "").strip()
            link     = (link_el.text if link_el is not None else "") or ""
            pub_date = (pub_el.text if pub_el is not None else "") or ""
            source   = (src_el.text if src_el is not None else "") or "Google News"

            # 날짜 파싱
            try:
                from email.utils import parsedate_to_datetime
                pub_dt = parsedate_to_datetime(pub_date).isoformat() if pub_date else ""
            except Exception:
                pub_dt = pub_date

            articles.append({
                "title":        title,
                "source":       source,
                "url":          link,
                "published_at": pub_dt,
            })
            if len(articles) >= max_items:
                break
    except Exception as e:
        print(f"  [WARN] gnews fetch '{query}': {e}")
    return articles


def _dedup(articles: list[dict]) -> list[dict]:
    seen = set()
    result = []
    for a in articles:
        key = a["title"][:40]
        if key not in seen:
            seen.add(key)
            result.append(a)
    return result


def collect_news() -> list[dict]:
    all_articles = []
    for theme, keywords in MY_THEMES.items():
        # 첫 번째 키워드로 검색 (가장 핵심어)
        query = " OR ".join(keywords[:3])
        items = _fetch_gnews(query, max_items=4)
        for item in items:
            item["themes"] = [theme]
            item["sentiment"] = None
        all_articles.extend(items)
        time.sleep(0.5)  # 요청 간격

    all_articles = _dedup(all_articles)
    print(f"  [OK] 뉴스 수집: {len(all_articles)}개")
    return all_articles


def save_to_firebase(db, articles: list[dict]) -> None:
    today = datetime.now(KST).strftime("%Y-%m-%d")
    data = {
        "date":       today,
        "updated_at": datetime.now(KST).isoformat(),
        "articles":   articles,
    }
    db.collection("portfolio-news").document("latest").set(data)
    db.collection("portfolio-news").document(today).set(data)
    print(f"  [OK] Firebase 저장: /portfolio-news/{today} ({len(articles)}건)")


def main():
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    from firebase_uploader import _init as firebase_init
    from firebase_admin import firestore

    firebase_init()
    db = firestore.client()

    print("=== 뉴스 수집 시작 ===")
    articles = collect_news()
    save_to_firebase(db, articles)
    print("=== 완료 ===")


if __name__ == "__main__":
    main()
