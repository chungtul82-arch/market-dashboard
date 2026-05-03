"""전체 파이프라인 진입점.
사용법:
  python main.py         # 일반 실행
  python main.py --now   # 즉시 실행 (테스트용, --now 플래그 동일)
"""
import sys
import os
import traceback
import argparse

sys.path.insert(0, os.path.dirname(__file__))

from config import SECTOR_ETFS
from collector import get_sector_data, get_foreign_net_buy, get_market_indices
from analyzer import calc_returns, calc_relative_strength, detect_rotation_signal
from firebase_uploader import build_report_data, upload_report
from telegram_bot import send_daily_notification, send_text


def run() -> None:
    print("=== 섹터 히트맵 파이프라인 시작 ===")
    try:
        print("[1/5] 시장 지수 수집 중...")
        indices = get_market_indices()
        print(f"      수집: {list(indices.keys())}")

        print("[2/5] 섹터 ETF 데이터 수집 중...")
        price_df = get_sector_data(SECTOR_ETFS)
        print(f"      {len(price_df.columns)}개 섹터, {len(price_df)}일치")

        print("[3/5] 외국인 순매수 수집 중...")
        foreign = get_foreign_net_buy(SECTOR_ETFS)

        print("[4/5] 수익률·상대강도 계산 중...")
        returns_df = calc_returns(price_df)
        rs_df      = calc_relative_strength(returns_df)
        signals    = detect_rotation_signal(returns_df)
        print(f"      신호 {len(signals)}건 감지")

        print("[5/5] Firebase 업로드 + 텔레그램 발송...")
        report_data = build_report_data(rs_df, signals, foreign_data=foreign, market_indices=indices)
        if not upload_report(report_data):
            raise RuntimeError("Firebase 업로드 실패")
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
    parser.add_argument("--now", action="store_true", help="즉시 실행")
    args = parser.parse_args()
    run()
