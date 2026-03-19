import os
import resend
from fastapi import APIRouter

# Set API key
resend.api_key = os.getenv("RESEND_API_KEY")

# Create router
router = APIRouter()


def send_test_email():
    return resend.Emails.send({
        "from": "noreply-convenio@wolff-caterva.com",
        "to": "svendavidwolff99@gmail.com",
        "subject": "Hello World",
        "html": "<p>Congrats on sending your <strong>first email</strong>!</p>"
    })


@router.get("/test-email")
def test_email():
    result = send_test_email()
    return {"status": "sent", "resend_response": result}