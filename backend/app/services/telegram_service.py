"""
ChronoShield — Telegram Service (stub)
Future: send alerts and admin notifications via Telegram Bot API.
"""
import structlog

logger = structlog.get_logger()


def send_admin_alert(message: str, level: str = "warning") -> bool:
    """
    Send an alert to the admin Telegram chat.
    Currently a stub — will be implemented when TELEGRAM_BOT_TOKEN is configured.
    Returns True on success, False otherwise.
    """
    logger.debug("Telegram alert stub called", message=message[:100], level=level)
    return False


def send_user_alert(chat_id: str, message: str) -> bool:
    """
    Send a security alert to a user's Telegram chat.
    Currently a stub.
    """
    logger.debug("Telegram user alert stub called", chat_id=chat_id, message=message[:100])
    return False
