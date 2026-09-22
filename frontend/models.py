import secrets
import string

from django.db import models


def generate_friend_code():
    alphabet = string.ascii_uppercase + string.digits
    return "USIM-" + "".join(secrets.choice(alphabet) for _ in range(6))


class Profile(models.Model):
    """기존 추천 기능에서 사용하는 프로필 모델. 기존 필드는 유지한다."""

    nickname = models.CharField(max_length=20, unique=True)
    age_group = models.CharField(max_length=20)
    city = models.CharField(max_length=40)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nickname"]

    def __str__(self):
        return f"{self.nickname} ({self.city})"


class Member(models.Model):
    """회원가입 계정 정보. 비밀번호 원문은 저장하지 않고 해시만 저장한다."""

    name = models.CharField(max_length=50)
    nickname = models.CharField(max_length=20, unique=True)
    password_hash = models.CharField(max_length=128)
    address = models.CharField(max_length=200)
    friend_code = models.CharField(max_length=20, unique=True, null=True, blank=True)
    room_state = models.JSONField(default=dict, blank=True)
    room_layout = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.nickname} ({self.name})"


class WorkoutProgress(models.Model):
    """회원별 운동량과 레벨 계산에 필요한 누적 데이터를 저장한다."""

    member = models.OneToOneField(Member, on_delete=models.CASCADE, related_name="workout_progress")
    total_calories = models.PositiveIntegerField(default=0)
    entries = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    @property
    def level(self):
        return (self.total_calories // 1500) + 1

    def __str__(self):
        return f"{self.member.nickname} · LV.{self.level}"


class Friendship(models.Model):
    """회원 사이의 친구 관계. 친구 추가 시 양쪽 방향으로 저장한다."""

    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="friendships")
    friend = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="added_by_friendships")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["member", "friend"],
                name="unique_member_friend",
            ),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.member.nickname} ↔ {self.friend.nickname}"


class FriendNote(models.Model):
    """현재 회원과 친구들이 함께 보는 운동 한마디."""

    author = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="friend_notes")
    text = models.TextField(max_length=60)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.author.nickname}: {self.text[:24]}"
