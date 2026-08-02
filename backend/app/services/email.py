"""Sending account emails. With no SMTP server configured the message (including any
link) is logged instead of sent, so local development and the controlled study work
without a mail server; set the smtp_* settings to send real email in production.
"""

import logging
import smtplib
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger("app")


def send(to: str, subject: str, body: str) -> None:
    if not settings.smtp_host:
        logger.info("email (not sent, no SMTP configured) to=%s subject=%r body=%r", to, subject, body)
        return
    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
        if settings.smtp_tls:
            server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(message)


def send_verification(to: str, link: str) -> None:
    send(
        to,
        "Verify your Ante account",
        "Welcome to Ante. Please confirm your email address to get started:\n\n"
        f"{link}\n\nIf you did not create an account, you can ignore this message.",
    )


def send_password_reset(to: str, link: str) -> None:
    send(
        to,
        "Reset your Ante password",
        "We received a request to reset your password. Use the link below within the "
        f"hour to choose a new one:\n\n{link}\n\nIf you did not request this, you can "
        "ignore this message and your password will stay the same.",
    )
