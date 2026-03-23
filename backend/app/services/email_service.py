import resend
import logging
from fastapi import APIRouter
from app.core.config import settings  # ✅ NEW

# -------------------------
# LOGGING (minimal, useful)
# -------------------------
logger = logging.getLogger(__name__)

# -------------------------
# RESEND CONFIG (FIXED)
# -------------------------
resend.api_key = settings.RESEND_API_KEY  # ✅ FIX

router = APIRouter()


# =========================
# HELPER: FORMAT EURO
# =========================
def format_eur(amount: float) -> str:
    return f"{amount:.2f}".replace(".", ",")


# =========================
# CORE SEND FUNCTION
# =========================
def send_email(to: str, subject: str, html: str):
    try:
        response = resend.Emails.send({
            "from": settings.EMAIL_FROM,  # ✅ FIX
            "to": [to],
            "subject": subject,
            "html": html
        })

        logger.info("Email sent", extra={
            "to": to,
            "subject": subject,
            "response": response
        })

        return response

    except Exception:
        logger.exception("Email sending failed (non-blocking)", extra={
            "to": to,
            "subject": subject
        })
        return None


# =========================
# TEST ROUTE (KEEP)
# =========================
@router.get("/test-email")
def test_email():
    result = send_email(
        to="svendavidwolff99@gmail.com",
        subject="Hello World",
        html="<p>Congrats on sending your <strong>first email</strong>!</p>"
    )
    return {"status": "sent", "resend_response": result}


# =========================
# BOOKING EMAILS
# =========================
def send_booking_confirmation_email(
    guest_email: str,
    venue_title: str,
    check_in: str,
    check_out: str,
    total_price: float
):
    formatted_price = format_eur(total_price)

    html = f"""
    <h2>Booking Confirmed</h2>
    <p>Your booking has been confirmed.</p>

    <ul>
        <li><strong>Venue:</strong> {venue_title}</li>
        <li><strong>Check-in:</strong> {check_in}</li>
        <li><strong>Check-out:</strong> {check_out}</li>
        <li><strong>Total:</strong> €{formatted_price}</li>
    </ul>

    <p>Thank you for using Convenio.</p>
    """

    return send_email(
        to=guest_email,
        subject="Your booking is confirmed",
        html=html
    )


def send_host_notification_email(
    host_email: str,
    guest_email: str,
    venue_title: str,
    check_in: str,
    check_out: str
):
    html = f"""
    <h2>New Booking Received</h2>

    <ul>
        <li><strong>Venue:</strong> {venue_title}</li>
        <li><strong>Guest:</strong> {guest_email}</li>
        <li><strong>Check-in:</strong> {check_in}</li>
        <li><strong>Check-out:</strong> {check_out}</li>
    </ul>

    <p>Log in to your dashboard to view details.</p>
    """

    return send_email(
        to=host_email,
        subject="You have a new booking",
        html=html
    )


def send_cancellation_email(
    user_email: str,
    venue_title: str,
    check_in: str,
    check_out: str,
    refund_amount: float
):
    formatted_refund = format_eur(refund_amount)

    html = f"""
    <h2>Booking Cancelled</h2>

    <p>Your booking has been cancelled.</p>

    <ul>
        <li><strong>Venue:</strong> {venue_title}</li>
        <li><strong>Check-in:</strong> {check_in}</li>
        <li><strong>Check-out:</strong> {check_out}</li>
        <li><strong>Refund:</strong> €{formatted_refund}</li>
    </ul>
    """

    return send_email(
        to=user_email,
        subject="Your booking was cancelled",
        html=html
    )