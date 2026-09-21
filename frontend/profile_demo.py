"""M1 로컬 화면 검증용 API입니다. M2 실제 추천 API를 대체하지 않습니다."""
import json
import math

from django.conf import settings
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_POST

from .demo_catalog import SPORTS, select_demo_facilities
from .forms import ProfileStartForm

PROFILE_SESSION_KEY = "usimunkka_profile"


def get_saved_profile(request):
    """세션 프로필을 다시 검사해 유효한 세 필드만 돌려줍니다."""
    raw = request.session.get(PROFILE_SESSION_KEY)
    if not isinstance(raw, dict):
        return None
    form = ProfileStartForm(raw)
    return dict(form.cleaned_data) if form.is_valid() else None


def validate_conditions(data):
    if not isinstance(data, dict):
        raise ValueError("요청은 JSON 객체여야 합니다.")

    sports = data.get("sports")
    if (
        not isinstance(sports, list)
        or not sports
        or len(sports) > len(SPORTS)
        or any(not isinstance(sport, str) or sport not in SPORTS for sport in sports)
    ):
        raise ValueError("운동 종목을 올바르게 선택해주세요.")

    def integer(name, lower, upper):
        value = data.get(name)
        if type(value) is not int or not lower <= value <= upper:
            raise ValueError(f"{name}: {lower}~{upper} 사이 정수가 필요합니다.")
        return value

    transport = data.get("transport")
    if transport not in ("WALK", "BICYCLE", "TRANSIT"):
        raise ValueError("이동수단을 확인해주세요.")

    latitude = data.get("latitude")
    longitude = data.get("longitude")
    if (latitude is None) != (longitude is None):
        raise ValueError("위도와 경도는 함께 전달해야 합니다.")
    if latitude is not None:
        for value, lower, upper in [(latitude, -90, 90), (longitude, -180, 180)]:
            if (
                type(value) not in (int, float)
                or not math.isfinite(value)
                or not lower <= value <= upper
            ):
                raise ValueError("좌표가 올바르지 않습니다.")

    return {
        "available_minutes": integer("available_minutes", 1, 1440),
        "max_travel_minutes": integer("max_travel_minutes", 0, 180),
        "transport": transport,
        "sports": list(dict.fromkeys(sports)),
        "has_departure_coordinates": latitude is not None,
    }


@never_cache
@require_POST
def demo_recommendations(request):
    # 실서비스로 오인하지 않도록 DEBUG=False에서는 비활성화합니다.
    if not settings.DEBUG:
        return JsonResponse(
            {"error": "개발용 추천 API는 운영 환경에서 사용할 수 없습니다."},
            status=404,
        )

    profile = get_saved_profile(request)
    if profile is None:
        return JsonResponse(
            {"error": "프로필을 먼저 입력하거나 다시 저장해주세요."},
            status=401,
        )

    try:
        if request.content_type != "application/json":
            raise ValueError("JSON 형식으로 요청해주세요.")
        if len(request.body) > 8192:
            raise ValueError("요청 내용이 너무 큽니다.")
        data = json.loads(request.body.decode("utf-8"))
        conditions = validate_conditions(data)
    except (ValueError, UnicodeDecodeError) as exc:
        return JsonResponse({"error": str(exc)}, status=400)

    # 핵심: 브라우저가 보낸 city/age_group/nickname은 추천 기준으로 쓰지 않습니다.
    # 서버 세션에 저장된 사용자 프로필을 기준으로 필터링합니다.
    recommendations = select_demo_facilities(profile, conditions["sports"])

    return JsonResponse({
        "mode": "MOCK",
        "generated_at": timezone.now().isoformat(),
        "applied_profile": {
            **profile,
            "age_label": dict(ProfileStartForm.AGE_CHOICES)[profile["age_group"]],
        },
        "conditions": conditions,
        "recommendations": recommendations,
        "notice": (
            "지역·종목·샘플 프로그램 나이대 연결만 확인하는 개발용 결과입니다. "
            "시간·이동수단·좌표는 아직 실제 추천 계산에 반영되지 않습니다."
        ),
    })
