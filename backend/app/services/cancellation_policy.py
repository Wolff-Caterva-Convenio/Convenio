from datetime import datetime, timedelta

FULL_REFUND_HOURS = 72
PARTIAL_REFUND_HOURS = 48


def calculate_refund_ratio(check_in: datetime, now: datetime | None = None) -> float:
    now = now or datetime.utcnow()
    delta = check_in - now

    if delta >= timedelta(hours=FULL_REFUND_HOURS):
        return 0.95  # >72h: refund 95% of total paid

    if delta >= timedelta(hours=PARTIAL_REFUND_HOURS):
        return 0.50  # 48-72h: refund 50% of total paid

    return 0.0  # <48h: refund 0