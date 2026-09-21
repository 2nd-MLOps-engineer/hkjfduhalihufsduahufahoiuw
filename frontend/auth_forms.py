import re

from django import forms

from .models import Member


class SignupForm(forms.Form):
    name = forms.CharField(label="이름", max_length=50, strip=True)
    nickname = forms.CharField(label="닉네임", max_length=20, strip=True)
    password = forms.CharField(
        label="비밀번호",
        min_length=8,
        max_length=128,
        widget=forms.PasswordInput,
    )
    password_confirm = forms.CharField(
        label="비밀번호 확인",
        min_length=8,
        max_length=128,
        widget=forms.PasswordInput,
    )
    address = forms.CharField(label="주소", max_length=200, strip=True)

    def clean_name(self):
        value = self.cleaned_data["name"].strip()
        if not value:
            raise forms.ValidationError("이름을 입력해주세요.")
        return value

    def clean_nickname(self):
        value = self.cleaned_data["nickname"].strip()
        if "<" in value or ">" in value:
            raise forms.ValidationError("닉네임에는 꺾쇠 기호를 사용할 수 없습니다.")
        if Member.objects.filter(nickname=value).exists():
            raise forms.ValidationError("이미 사용 중인 닉네임입니다.")
        return value

    def clean_address(self):
        value = self.cleaned_data["address"].strip()
        if not value:
            raise forms.ValidationError("주소를 입력해주세요.")
        return value

    def clean(self):
        cleaned = super().clean()
        password = cleaned.get("password", "")
        password_confirm = cleaned.get("password_confirm", "")

        if password and len(password) < 8:
            self.add_error("password", "비밀번호는 8자 이상이어야 합니다.")
        if password and any(char.isspace() for char in password):
            self.add_error("password", "비밀번호에는 공백을 사용할 수 없습니다.")
        if password and re.search(r"[가-힣ㄱ-ㅎㅏ-ㅣ]", password):
            self.add_error("password", "비밀번호에는 한글을 사용할 수 없습니다.")
        if password and password.isdigit():
            self.add_error("password", "숫자만으로 이루어진 비밀번호는 사용할 수 없습니다.")
        if password and re.search(r"(.)\1{3,}", password):
            self.add_error("password", "같은 문자를 4번 이상 반복할 수 없습니다.")

        normalized_password = "".join(password.lower().split())
        personal_values = {
            "".join(str(cleaned.get(key, "")).lower().split())
            for key in ("name", "nickname", "address")
            if cleaned.get(key)
        }
        if normalized_password and normalized_password in personal_values:
            self.add_error("password", "이름·닉네임·주소만으로 된 비밀번호는 사용할 수 없습니다.")

        if password and password_confirm and password != password_confirm:
            self.add_error("password_confirm", "비밀번호가 일치하지 않습니다.")

        return cleaned


class LoginForm(forms.Form):
    nickname = forms.CharField(label="닉네임", max_length=20, strip=True)
    password = forms.CharField(label="비밀번호", max_length=128, widget=forms.PasswordInput)
