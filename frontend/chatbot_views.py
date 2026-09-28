from __future__ import annotations

import json
import logging

from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_POST

from .auth_views import app_access_required
from .chatbot_service import generate_chat_reply

logger = logging.getLogger(__name__)

CHAT_HISTORY_SESSION_KEY = "usim_chat_history_v1"
MAX_MESSAGE_LENGTH = 600
MAX_HISTORY_ITEMS = 10


def _read_json(request):
    try:
        return json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return None


@never_cache
@app_access_required
@require_POST
def chatbot_message(request):
    body = _read_json(request)
    if not isinstance(body, dict):
        return JsonResponse({"error": "요청 형식이 올바르지 않습니다."}, status=400)

    message = str(body.get("message", "")).strip()
    if not message:
        return JsonResponse({"error": "메시지를 입력해 주세요."}, status=400)
    if len(message) > MAX_MESSAGE_LENGTH:
        return JsonResponse(
            {"error": f"메시지는 {MAX_MESSAGE_LENGTH}자 이하로 입력해 주세요."},
            status=400,
        )

    history = request.session.get(CHAT_HISTORY_SESSION_KEY, [])
    if not isinstance(history, list):
        history = []
    history = [row for row in history if isinstance(row, dict)][-MAX_HISTORY_ITEMS:]

    try:
        result = generate_chat_reply(
            message=message,
            history=history,
            member=getattr(request, "usim_member", None),
            client_context=body.get("profile"),
        )
    except RuntimeError as exc:
        logger.warning("Chatbot configuration/runtime error: %s", exc)
        return JsonResponse({"error": str(exc)}, status=503)
    except Exception:
        logger.exception("Chatbot request failed")
        return JsonResponse(
            {"error": "AI 코치가 잠시 쉬고 있어요. 잠시 후 다시 시도해 주세요."},
            status=502,
        )

    history.extend(
        [
            {"role": "user", "content": message[:MAX_MESSAGE_LENGTH]},
            {"role": "assistant", "content": result.reply[:1800]},
        ]
    )
    request.session[CHAT_HISTORY_SESSION_KEY] = history[-MAX_HISTORY_ITEMS:]
    request.session.modified = True

    return JsonResponse(
        {
            "reply": result.reply,
            "recommendations": result.recommendations,
            "recommendation_context_used": result.recommendation_context_used,
        }
    )


@never_cache
@app_access_required
@require_POST
def chatbot_clear(request):
    request.session.pop(CHAT_HISTORY_SESSION_KEY, None)
    request.session.modified = True
    return JsonResponse({"ok": True})
