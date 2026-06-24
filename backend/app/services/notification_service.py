"""
Notification Service — Email and SMS notifications for visitor lifecycle events.
"""
import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


EMAIL_TEMPLATES = {
    "registration": {
        "subject": "BHEL VMS - Visitor Registration Confirmed | {visitor_id}",
        "body": """
<html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
  <div style="background:#1a3a5c;padding:20px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:22px">BHEL Varanasi</h1>
    <p style="color:#93c5fd;margin:4px 0">Smart Visitor Management System</p>
  </div>
  <div style="padding:30px">
    <h2 style="color:#1a3a5c">Registration Confirmed</h2>
    <p>Dear <strong>{name}</strong>,</p>
    <p>Your visitor registration at BHEL Varanasi has been successfully submitted.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      <tr><td style="padding:8px;background:#f0f4f8;font-weight:bold;width:40%">Visitor ID</td>
          <td style="padding:8px;background:#f0f4f8">{visitor_id}</td></tr>
      <tr><td style="padding:8px;font-weight:bold">Purpose</td>
          <td style="padding:8px">{purpose}</td></tr>
      <tr><td style="padding:8px;background:#f0f4f8;font-weight:bold">Host Employee</td>
          <td style="padding:8px;background:#f0f4f8">{host_employee}</td></tr>
      <tr><td style="padding:8px;font-weight:bold">Department</td>
          <td style="padding:8px">{department}</td></tr>
      <tr><td style="padding:8px;background:#f0f4f8;font-weight:bold">Status</td>
          <td style="padding:8px;background:#f0f4f8"><span style="color:#f59e0b;font-weight:bold">Pending Approval</span></td></tr>
    </table>
    <p>You will receive another notification once your visit is approved.</p>
    <p style="color:#6b7280;font-size:12px;margin-top:30px">This is an automated message from BHEL VMS. Do not reply.</p>
  </div>
</div>
</body></html>
""",
    },
    "approval": {
        "subject": "BHEL VMS - Visit Approved | {visitor_id}",
        "body": """
<html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
<div style="max-width:600px;margin:auto;background:#fff;border-radius:8px;overflow:hidden">
  <div style="background:#1a3a5c;padding:20px;text-align:center">
    <h1 style="color:#fff;margin:0">BHEL Varanasi VMS</h1>
  </div>
  <div style="padding:30px">
    <h2 style="color:#16a34a">✓ Visit Approved</h2>
    <p>Dear <strong>{name}</strong>, your visit to BHEL Varanasi has been <strong style="color:#16a34a">APPROVED</strong>.</p>
    <p><strong>Visitor ID:</strong> {visitor_id}</p>
    <p>Please present your Visitor ID or QR Code at the entry gate.</p>
  </div>
</div>
</body></html>
""",
    },
    "entry": {
        "subject": "BHEL VMS - Entry Recorded | {visitor_id}",
        "body": """
<html><body style="font-family:Arial,sans-serif;padding:20px">
<p>Dear <strong>{name}</strong>, your entry at BHEL Varanasi has been recorded.</p>
<p><strong>Entry Time:</strong> {entry_time}</p>
<p><strong>Visitor ID:</strong> {visitor_id}</p>
</body></html>
""",
    },
}


async def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    from_name: Optional[str] = None,
) -> bool:
    """Send HTML email via SMTP."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.debug(f"Email not configured. Would send to {to_email}: {subject}")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{from_name or settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAILS_FROM_EMAIL, to_email, msg.as_string())
        return True
    except Exception as e:
        logger.error(f"Email send failed to {to_email}: {e}")
        return False


async def send_sms(phone: str, message: str) -> bool:
    """Send SMS via Twilio."""
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.debug(f"SMS not configured. Would send to {phone}: {message}")
        return False

    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(
            body=message,
            from_=settings.TWILIO_PHONE_NUMBER,
            to=phone,
        )
        return True
    except Exception as e:
        logger.error(f"SMS send failed to {phone}: {e}")
        return False


async def notify_registration(visitor_data: dict) -> None:
    """Fire-and-forget registration notifications."""
    if email := visitor_data.get("email"):
        template = EMAIL_TEMPLATES["registration"]
        subject = template["subject"].format(visitor_id=visitor_data.get("visitor_id", ""))
        body = template["body"].format(
            name=visitor_data.get("name", ""),
            visitor_id=visitor_data.get("visitor_id", ""),
            purpose=visitor_data.get("purpose", ""),
            host_employee=visitor_data.get("host_employee_name", ""),
            department=visitor_data.get("department_name", "N/A"),
        )
        asyncio.create_task(send_email(email, subject, body))

    if mobile := visitor_data.get("mobile"):
        sms = (
            f"BHEL VMS: Registration confirmed. ID: {visitor_data.get('visitor_id')}. "
            "Awaiting host approval. -BHEL Varanasi"
        )
        asyncio.create_task(send_sms(mobile, sms))


async def notify_approval(visitor_data: dict) -> None:
    if email := visitor_data.get("email"):
        template = EMAIL_TEMPLATES["approval"]
        subject = template["subject"].format(visitor_id=visitor_data.get("visitor_id", ""))
        body = template["body"].format(
            name=visitor_data.get("name", ""),
            visitor_id=visitor_data.get("visitor_id", ""),
        )
        asyncio.create_task(send_email(email, subject, body))

    if mobile := visitor_data.get("mobile"):
        sms = f"BHEL VMS: Your visit is APPROVED. ID: {visitor_data.get('visitor_id')}. Show this ID at entry. -BHEL Varanasi"
        asyncio.create_task(send_sms(mobile, sms))
