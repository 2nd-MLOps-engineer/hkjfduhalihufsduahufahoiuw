from functools import wraps

from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError, transaction
import json

from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from .auth_forms import LoginForm, SignupForm
from .models import FriendNote, FriendRequest, Friendship, Member, WorkoutProgress, generate_friend_code
from .recommendation_service import make_recommendations

LOGIN_ERROR_MESSAGE = "아이디 또는 비밀번호 오류입니다."
GUEST_SESSION_KEY = "guest_mode"


def _current_member(request):
    member_id = request.session.get("member_id")
    if not member_id:
        return None
    member = Member.objects.filter(pk=member_id).first()
    if member is None:
        request.session.pop("member_id", None)
        request.session.pop("member_nickname", None)
    return member


def _is_guest(request):
    return bool(request.session.get(GUEST_SESSION_KEY)) and _current_member(request) is None


def member_required(view_func):
    @wraps(view_func)
    def wrapped(request, *args, **kwargs):
        member = _current_member(request)
        if member is None:
            return redirect("login")
        request.usim_member = member
        request.usim_guest = False
        return view_func(request, *args, **kwargs)
    return wrapped


def app_access_required(view_func):
    """회원 또는 오프닝에서 시작한 게스트에게 앱 전체 페이지 접근을 허용한다."""
    @wraps(view_func)
    def wrapped(request, *args, **kwargs):
        member = _current_member(request)
        is_guest = member is None and _is_guest(request)
        if member is None and not is_guest:
            return redirect("login")

        if member is not None:
            request.session.pop(GUEST_SESSION_KEY, None)

        request.usim_member = member
        request.usim_guest = is_guest
        return view_func(request, *args, **kwargs)
    return wrapped


def _app_context(request, active_tab):
    member = getattr(request, "usim_member", None) or _current_member(request)
    is_guest = bool(getattr(request, "usim_guest", False)) or (member is None and _is_guest(request))
    return {
        "active_tab": active_tab,
        "member": member,
        "is_guest": is_guest,
    }


def welcome(request):
    return render(request, "pages/welcome.html")


@require_POST
def guest_start(request):
    """오프닝에서 로그인 없이 MY ROOM만 체험하도록 게스트 세션을 시작한다."""
    member = _current_member(request)
    if member is not None:
        # 이미 로그인된 사용자는 자신의 방으로 바로 보낸다.
        request.session.pop(GUEST_SESSION_KEY, None)
        return redirect("home")

    request.session.cycle_key()
    request.session.pop("member_id", None)
    request.session.pop("member_nickname", None)
    request.session[GUEST_SESSION_KEY] = True
    return redirect("home")


@never_cache
@require_http_methods(["GET", "POST"])
def signup_page(request):
    if request.method == "POST":
        form = SignupForm(request.POST)
        if form.is_valid():
            Member.objects.create(
                name=form.cleaned_data["name"],
                nickname=form.cleaned_data["nickname"],
                password_hash=make_password(form.cleaned_data["password"]),
                address=form.cleaned_data["address"],
                friend_code=generate_friend_code(),
            )
            return redirect("login")
    else:
        form = SignupForm()
    return render(request, "pages/signup.html", {"form": form})


@never_cache
@require_http_methods(["GET", "POST"])
def login_page(request):
    error = None
    if request.method == "POST":
        form = LoginForm(request.POST)
        if form.is_valid():
            member = Member.objects.filter(nickname=form.cleaned_data["nickname"]).first()
            valid = member is not None and check_password(
                form.cleaned_data["password"], member.password_hash
            )
            if not valid:
                error = LOGIN_ERROR_MESSAGE
            else:
                request.session.cycle_key()
                request.session.pop(GUEST_SESSION_KEY, None)
                request.session["member_id"] = member.pk
                request.session["member_nickname"] = member.nickname
                return redirect("login_loading")
        else:
            # 입력 형식 오류는 필드 오류로 표시하되 계정 존재 여부는 노출하지 않는다.
            if request.POST.get("nickname") and request.POST.get("password"):
                error = LOGIN_ERROR_MESSAGE
    else:
        form = LoginForm()

    return render(request, "pages/login.html", {"form": form, "error": error})


@never_cache
@member_required
def login_loading(request):
    return render(request, "pages/login_loading.html")


@never_cache
@member_required
@require_GET
def prepare_login_home(request):
    """로그인 전환 화면에서 메인 추천을 미리 계산해 다음 화면의 대기시간을 줄인다."""
    member = request.usim_member
    try:
        available = 60
        max_travel = 20
        payload = make_recommendations(member.address, set(), available, max_travel, None)
        request.session["preloaded_home_recommendations"] = payload.get("recommendations", [])
        request.session.modified = True
        return JsonResponse({"ready": True})
    except Exception as exc:
        return JsonResponse({"ready": False, "error": str(exc)}, status=503)


@require_POST
def logout_page(request):
    request.session.flush()
    return redirect("welcome")


@never_cache
@require_GET
def check_member_nickname(request):
    nickname = request.GET.get("nickname", "").strip()
    available = bool(nickname) and not Member.objects.filter(nickname=nickname).exists()
    return JsonResponse({"available": available})


def _member_progress_payload(member):
    if not member.friend_code:
        member.friend_code = generate_friend_code()
        member.save(update_fields=["friend_code", "updated_at"])
    progress, _ = WorkoutProgress.objects.get_or_create(member=member)
    total = max(0, int(progress.total_calories or 0))
    return {
        "friend_code": member.friend_code,
        "total_calories": total,
        "level": (total // 1500) + 1,
        "entries": progress.entries if isinstance(progress.entries, list) else [],
    }


@never_cache
@app_access_required
@require_GET
def account_state(request):
    member = getattr(request, "usim_member", None)
    if member is None:
        return JsonResponse({"friend_code": "", "total_calories": 0, "level": 1, "entries": []})
    return JsonResponse(_member_progress_payload(member))


@never_cache
@app_access_required
@require_POST
def add_workout_calories(request):
    member = getattr(request, "usim_member", None)
    if member is None:
        return JsonResponse({"error": "회원 로그인 후 운동량을 저장할 수 있습니다."}, status=401)
    try:
        body = json.loads(request.body or "{}")
        amount = int(body.get("calories", 0))
    except (TypeError, ValueError, json.JSONDecodeError):
        amount = 0
    if amount <= 0:
        return JsonResponse({"error": "칼로리는 1 이상이어야 합니다."}, status=400)
    progress, _ = WorkoutProgress.objects.get_or_create(member=member)
    entries = progress.entries if isinstance(progress.entries, list) else []
    entries.insert(0, {"calories": amount, "created_at": timezone.now().isoformat()})
    progress.total_calories = max(0, int(progress.total_calories or 0)) + amount
    progress.entries = entries[:30]
    progress.save(update_fields=["total_calories", "entries", "updated_at"])
    return JsonResponse(_member_progress_payload(member))


@never_cache
def main_page(request):
    """회원은 자신의 방, 게스트는 오프닝에서 시작한 체험 방에 접근한다."""
    member = _current_member(request)
    is_guest = member is None and _is_guest(request)
    if member is None and not is_guest:
        return redirect("login")

    if member is not None:
        request.session.pop(GUEST_SESSION_KEY, None)

    request.usim_member = member
    request.usim_guest = is_guest
    context = _app_context(request, "home")
    context["room_owner"] = member
    context["room_is_visitor"] = False
    owner_progress = getattr(member, "workout_progress", None) if member is not None else None
    context["visitor_total_calories"] = max(0, int(owner_progress.total_calories or 0)) if owner_progress else 0
    address = member.address if member is not None else "서울특별시 관악구"
    try:
        latitude = float(request.GET["latitude"]) if request.GET.get("latitude") else None
        longitude = float(request.GET["longitude"]) if request.GET.get("longitude") else None
        if latitude is not None and not -90 <= latitude <= 90:
            latitude = longitude = None
        if longitude is not None and not -180 <= longitude <= 180:
            latitude = longitude = None
        origin = (latitude, longitude) if latitude is not None and longitude is not None else None
        available = max(1, int(request.GET.get("available_minutes", "60")))
        max_travel = max(0, int(request.GET.get("max_travel_minutes", "20")))
        preloaded = request.session.pop("preloaded_home_recommendations", None) if origin is None else None
        payload = None
        if preloaded is not None:
            payload = {"recommendations": preloaded}
        else:
            payload = make_recommendations(address, set(), available, max_travel, origin)
        context["initial_recommendations"] = payload.get("recommendations", [])
        context["location_loaded"] = bool(origin)
    except Exception:
        context["initial_recommendations"] = []
        context["location_loaded"] = False
    return render(request, "frontend/home.html", context)


@never_cache
@app_access_required
def recommend_page(request):
    return render(request, "frontend/recommend.html", _app_context(request, "recommend"))


@never_cache
@app_access_required
def friends_page(request):
    return render(request, "frontend/friends.html", _app_context(request, "friends"))


@never_cache
@member_required
def friend_visitor_page(request, member_id):
    """친구가 꾸민 MY ROOM을 그대로 보여주는 방문자 홈페이지."""
    visitor = Member.objects.filter(pk=member_id).first()
    if visitor is None or not Friendship.objects.filter(
        member=request.usim_member, friend=visitor
    ).exists():
        return redirect("friends")

    progress = getattr(visitor, "workout_progress", None)
    total_calories = max(0, int(progress.total_calories or 0)) if progress else 0
    context = _app_context(request, "friends")
    context.update({
        "room_owner": visitor,
        "room_is_visitor": True,
        "visitor_total_calories": total_calories,
        "visitor_level": (total_calories // 1500) + 1,
    })
    try:
        latitude = float(request.GET["latitude"]) if request.GET.get("latitude") else None
        longitude = float(request.GET["longitude"]) if request.GET.get("longitude") else None
        if latitude is not None and not -90 <= latitude <= 90:
            latitude = longitude = None
        if longitude is not None and not -180 <= longitude <= 180:
            latitude = longitude = None
        origin = (latitude, longitude) if latitude is not None and longitude is not None else None
        payload = make_recommendations(visitor.address, set(), 60, 20, origin)
        context["initial_recommendations"] = payload.get("recommendations", [])
        context["location_loaded"] = bool(origin)
    except Exception:
        context["initial_recommendations"] = []
        context["location_loaded"] = False
    return render(request, "frontend/home.html", context)


def _friend_progress(member):
    progress = getattr(member, "workout_progress", None)
    total = max(0, int(progress.total_calories or 0)) if progress else 0
    return total


def _friend_payload(member):
    """친구 화면에서 필요한 공개 프로필만 반환한다."""
    if not member.friend_code:
        member.friend_code = generate_friend_code()
        member.save(update_fields=["friend_code", "updated_at"])
    total = _friend_progress(member)
    return {
        "id": member.pk,
        "friend_code": member.friend_code,
        "nickname": member.nickname,
        "region": member.address or "지역 미설정",
        "sport": "fitness",
        "preferred_sports": ["fitness"],
        "calories": total,
        "status": "운동 기록 있음" if total else "운동 기다리는 중",
        "message": "오늘도 같이 움직여요!",
        "mood": "energy" if total else "ready",
        "pose": "main",
    }


def _friend_list(member):
    relations = Friendship.objects.filter(member=member).select_related("friend")
    return [_friend_payload(relation.friend) for relation in relations]


def _json_body(request):
    try:
        return json.loads(request.body or "{}")
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}


@never_cache
@member_required
@require_http_methods(["GET", "POST"])
def room_state_api(request, member_id=None):
    """내 방은 저장하고, 친구 방은 읽기 전용으로 조회한다."""
    current = request.usim_member
    owner = current if member_id is None else Member.objects.filter(pk=member_id).first()
    if owner is None:
        return JsonResponse({"error": "방을 찾지 못했어요."}, status=404)
    if owner.pk != current.pk and not Friendship.objects.filter(member=current, friend=owner).exists():
        return JsonResponse({"error": "친구의 운동방만 볼 수 있어요."}, status=403)
    if request.method == "GET":
        return JsonResponse({"state": owner.room_state or {}, "layout": owner.room_layout or {}})
    if owner.pk != current.pk:
        return JsonResponse({"error": "친구의 운동방은 수정할 수 없어요."}, status=403)
    body = _json_body(request)
    state = body.get("state") if isinstance(body.get("state"), dict) else {}
    layout = body.get("layout") if isinstance(body.get("layout"), dict) else {}
    # 의상은 현재 운동 레벨에서 해금된 항목만 서버에도 저장한다.
    outfit = state.get("outfit", "default")
    progress = getattr(owner, "workout_progress", None)
    level = (int(progress.total_calories or 0) // 1500) + 1 if progress else 1
    if outfit not in {"default", "summer", "winter"}:
        outfit = "default"
    if outfit != "default" and level < 5:
        outfit = "default"
    state["outfit"] = outfit
    owner.room_state = state
    owner.room_layout = layout
    owner.save(update_fields=["room_state", "room_layout", "updated_at"])
    return JsonResponse({"saved": True, "state": state, "layout": layout})


@never_cache
@member_required
@require_GET
def friends_api(request):
    member = request.usim_member
    return JsonResponse({"friends": _friend_list(member)})


@never_cache
@member_required
@require_GET
def friend_lookup_api(request):
    identifier = request.GET.get("code", "").strip()
    if not identifier:
        return JsonResponse({"error": "친구 코드 또는 아이디를 입력해주세요."}, status=400)
    if identifier.upper().startswith("USIM-"):
        target = Member.objects.filter(friend_code=identifier.upper()).first()
    else:
        target = Member.objects.filter(nickname=identifier).first()
    if target is None:
        return JsonResponse({"error": "해당 친구 코드 또는 아이디를 찾지 못했어요."}, status=404)
    if target.pk == request.usim_member.pk:
        return JsonResponse({"error": "내 친구 코드는 조회할 수 없어요."}, status=400)
    return JsonResponse({"friend": _friend_payload(target)})


def _friend_request_payload(friend_request):
    requester = friend_request.requester
    return {
        "id": friend_request.pk,
        "nickname": requester.nickname,
        "friend_code": requester.friend_code,
        "region": requester.address or "지역 미설정",
        "created_at": timezone.localtime(friend_request.created_at).strftime("%m/%d %H:%M"),
    }


@never_cache
@member_required
@require_GET
def friend_requests_api(request):
    requests = FriendRequest.objects.filter(
        recipient=request.usim_member, status=FriendRequest.STATUS_PENDING
    ).select_related("requester")
    return JsonResponse({"requests": [_friend_request_payload(row) for row in requests]})


@never_cache
@member_required
@require_POST
def respond_friend_request_api(request):
    body = _json_body(request)
    try:
        request_id = int(body.get("request_id"))
    except (TypeError, ValueError):
        request_id = 0
    action = str(body.get("action", "")).strip().lower()
    if action not in {"accept", "decline"} or not request_id:
        return JsonResponse({"error": "친구 요청 처리 정보가 올바르지 않아요."}, status=400)

    friend_request = FriendRequest.objects.filter(
        pk=request_id,
        recipient=request.usim_member,
        status=FriendRequest.STATUS_PENDING,
    ).select_related("requester").first()
    if friend_request is None:
        return JsonResponse({"error": "처리할 친구 요청을 찾지 못했어요."}, status=404)

    if action == "decline":
        friend_request.status = FriendRequest.STATUS_DECLINED
        friend_request.responded_at = timezone.now()
        friend_request.save(update_fields=["status", "responded_at"])
        return JsonResponse({"status": "declined"})

    with transaction.atomic():
        friend_request.status = FriendRequest.STATUS_ACCEPTED
        friend_request.responded_at = timezone.now()
        friend_request.save(update_fields=["status", "responded_at"])
        Friendship.objects.get_or_create(member=request.usim_member, friend=friend_request.requester)
        Friendship.objects.get_or_create(member=friend_request.requester, friend=request.usim_member)
    return JsonResponse({"status": "accepted", "friend": _friend_payload(friend_request.requester)})


@never_cache
@member_required
@require_POST
def add_friend_api(request):
    member = request.usim_member
    code = str(_json_body(request).get("friend_code", "")).strip().upper()
    if not code:
        return JsonResponse({"error": "친구 코드를 입력해주세요."}, status=400)
    target = Member.objects.filter(friend_code=code).first()
    if target is None:
        return JsonResponse({"error": "해당 친구 코드를 찾지 못했어요."}, status=404)
    if target.pk == member.pk:
        return JsonResponse({"error": "내 친구 코드는 추가할 수 없어요."}, status=400)

    if Friendship.objects.filter(member=member, friend=target).exists():
        return JsonResponse({"error": "이미 친구로 추가된 회원이에요.", "friends": _friend_list(member)}, status=409)
    if FriendRequest.objects.filter(
        requester=member, recipient=target, status=FriendRequest.STATUS_PENDING
    ).exists():
        return JsonResponse({"error": "이미 친구 요청을 보냈어요."}, status=409)
    if FriendRequest.objects.filter(
        requester=target, recipient=member, status=FriendRequest.STATUS_PENDING
    ).exists():
        return JsonResponse({"error": "상대가 보낸 친구 요청을 먼저 승인해주세요."}, status=409)

    friend_request = FriendRequest.objects.create(requester=member, recipient=target)
    return JsonResponse({"request": _friend_request_payload(friend_request), "status": "pending"}, status=201)


@never_cache
@member_required
@require_GET
def friend_notes_api(request):
    member = request.usim_member
    visible_ids = [member.pk] + list(
        Friendship.objects.filter(member=member).values_list("friend_id", flat=True)
    )
    notes = FriendNote.objects.filter(author_id__in=visible_ids).select_related("author")[:5]
    return JsonResponse({
        "notes": [
            {
                "id": note.pk,
                "author": note.author.nickname,
                "text": note.text,
                "time": timezone.localtime(note.created_at).strftime("%H:%M"),
            }
            for note in notes
        ]
    })


@never_cache
@member_required
@require_POST
def create_friend_note_api(request):
    text = str(_json_body(request).get("text", "")).strip()
    if not text:
        return JsonResponse({"error": "한마디를 입력해주세요."}, status=400)
    if len(text) > 60:
        return JsonResponse({"error": "한마디는 60자 이내로 입력해주세요."}, status=400)
    note = FriendNote.objects.create(author=request.usim_member, text=text)
    return JsonResponse({
        "note": {
            "id": note.pk,
            "author": note.author.nickname,
            "text": note.text,
            "time": timezone.localtime(note.created_at).strftime("%H:%M"),
        }
    }, status=201)


@never_cache
@app_access_required
def profile_page(request):
    return render(request, "frontend/profile.html", _app_context(request, "profile"))


@never_cache
@app_access_required
def diary_page(request):
    return render(request, "frontend/diary.html", _app_context(request, "diary"))
