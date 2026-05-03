"""APScheduler 기반 스케줄러 — 평일 08:00 KST 자동 실행."""
import sys
import os
import logging

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron       import CronTrigger

sys.path.insert(0, os.path.dirname(__file__))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


def job() -> None:
    from main import run
    try:
        run()
    except SystemExit:
        pass   # main.py 오류 시 스케줄러는 계속 실행


def main() -> None:
    scheduler = BlockingScheduler(timezone="Asia/Seoul")
    scheduler.add_job(
        job,
        CronTrigger(hour=8, minute=0, day_of_week="mon-fri", timezone="Asia/Seoul"),
        id="daily_report",
        replace_existing=True,
    )
    log.info("스케줄러 시작 — 평일 08:00 KST 실행")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        log.info("스케줄러 종료")


if __name__ == "__main__":
    main()
