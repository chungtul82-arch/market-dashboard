"""전체 파이프라인 진입점.
사용법:
  python main.py                  # 일반 실행
  python main.py --now            # 즉시 실행 (테스트용)
  python main.py --screener-only  # 스크리너만 실행
  python main.py --index-only     # 인덱스 추세만 실행
"""
import sys
import os
import traceback
import argparse

sys.path.insert(0, os.path.dirname(__file__))

from config import SECTOR_SOURCES, SECTOR_ETFS
from collector import get_sector_data, get_foreign_net_buy, get_market_indices
from analyzer import calc_returns, calc_relative_strength, detect_rotation_signal
from firebase_uploader import build_report_data, upload_report, _init as firebase_init
from firebase_admin import firestore
from portfolio_updater import update_portfolio_prices
from telegram_bot import send_daily_notification, send_text


def run_index_only() -> None:
    print("=== 인덱스 추세 단독 실행 ===")
    try:
        firebase_init()
        db = firestore.client()
        from index_collector import collect_index_data, save_to_firebase as save_idx
        indices = collect_index_data(db)
        if indices:
            save_idx(db, indices)
        print(f"=== 인덱스 완료: {len(indices)}개 ===")
    except Exception:
        err = traceback.format_exc()
        print(f"[ERROR]\n{err}")
        sys.exit(1)


def run_screener_only() -> None:
    print("=== 스크리너 단독 실행 ===")
    try:
        firebase_init()
        db = firestore.client()
        from screener import run_screener
        results = run_screener(db)
        print(f"=== 스크리너 완료: {len(results)}개 ===")
    except Exception:
        err = traceback.format_exc()
        print(f"[ERROR]\n{err}")
        try:
            send_text(f"⚠️ 스크리너 오류\n<code>{err[-600:]}</code>")
        except Exception:
            pass
        sys.exit(1)


def run() -> None:
    print("=== 섹터 히트맵 파이프라인 시작 ===")
    try:
        print("[1/5] 시장 지수 수집 중...")
        indices = get_market_indices()
        print(f"      수집: {list(indices.keys())}")

        print("[2/5] 섹터 데이터 수집 중 (KRX 인덱스 + 대표 ETF)...")
        price_df = get_sector_data(SECTOR_SOURCES)
        print(f"      {len(price_df.columns)}개 섹터, {len(price_df)}일치")

        print("[3/5] 외국인 순매수 수집 중 (ETF 기반 섹터만)...")
        foreign = get_foreign_net_buy(SECTOR_ETFS)

        print("[4/5] 수익률·상대강도 계산 중...")
        returns_df = calc_returns(price_df)
        rs_df      = calc_relative_strength(returns_df)

        # 5일 전 RS — 신호 모멘텀 감지용
        prev_rs_df = None
        if len(price_df) > 7:
            try:
                prev_returns = calc_returns(price_df.iloc[:-5])
                prev_rs_df   = calc_relative_strength(prev_returns)
            except Exception:
                pass

        signals = detect_rotation_signal(rs_df, prev_rs_df)
        print(f"      신호 {len(signals)}건 감지")

        print("[5/5] Firebase 업로드 + 텔레그램 발송...")
        report_data = build_report_data(rs_df, signals, foreign_data=foreign, market_indices=indices)
        if not upload_report(report_data):
            raise RuntimeError("Firebase 업로드 실패")

        print("[+] 포트폴리오 가격 업데이트...")
        firebase_init()
        db = firestore.client()
        update_portfolio_prices(db)

        print("[+] 주도주 스크리너 실행...")
        try:
            from screener import run_screener
            run_screener(db)
        except Exception:
            print(f"  [WARN] 스크리너 실패 (파이프라인 계속)\n{traceback.format_exc()}")

        print("[+] 인덱스 추세 수집...")
        try:
            from index_collector import collect_index_data, save_to_firebase as save_idx
            idx_data = collect_index_data(db)
            if idx_data:
                save_idx(db, idx_data)
        except Exception:
            print(f"  [WARN] 인덱스 추세 실패 (파이프라인 계속)\n{traceback.format_exc()}")

        send_daily_notification(report_data)

        print("=== 완료 ===")

    except Exception:
        err = traceback.format_exc()
        print(f"[ERROR]\n{err}")
        try:
            send_text(f"⚠️ 섹터 히트맵 파이프라인 오류\n<code>{err[-600:]}</code>")
        except Exception:
            pass
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--now",           action="store_true", help="즉시 실행")
    parser.add_argument("--screener-only", action="store_true", help="스크리너만 실행")
    parser.add_argument("--index-only",    action="store_true", help="인덱스 추세만 실행")
    args = parser.parse_args()

    if args.screener_only:
        run_screener_only()
    elif args.index_only:
        run_index_only()
    else:
        run()
