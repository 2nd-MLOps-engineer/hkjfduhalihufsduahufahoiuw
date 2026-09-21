(() => {
  const app = window.USIMUNKKA;
  const profile = app.getProfile();
  const $ = s => document.querySelector(s);
  const setValue = (s, v) => { const el = $(s); if (el) el.value = v ?? ""; };

  setValue("#nicknameInput", profile.nickname);
  setValue("#messageInput", profile.message);
  setValue("#moodNoteInput", profile.mood_note);
  setValue("#profileProvince", profile.province);
  setValue("#profileDistrict", profile.district);
  setValue("#profileNeighborhood", profile.neighborhood);
  setValue("#profileTransport", profile.transport);
  setValue("#profileTravelMinutes", profile.max_travel_minutes);
  $("#friendCodeText").textContent = profile.friend_code;

  const genderInputs = [...document.querySelectorAll('input[name="avatarGender"]')];
  const genderImages = [...document.querySelectorAll('img[data-female-src][data-male-src]')];
  const initialGender = ["female", "male"].includes(profile.avatar_gender) ? profile.avatar_gender : "male";
  const renderGender = gender => {
    genderImages.forEach(image => {
      if (image.id === "profileAvatarImage" && (profile.image_url || profile.profile_image || profile.image)) return;
      const src = gender === "female" ? image.dataset.femaleSrc : image.dataset.maleSrc;
      if (src) image.src = src;
    });
    document.documentElement.dataset.avatarGenderPreview = gender;
  };
  genderInputs.forEach(input => {
    input.checked = input.value === initialGender;
    input.addEventListener("change", () => {
      if (input.checked) renderGender(input.value);
    });
  });
  renderGender(initialGender);

  const moodInputs = [...document.querySelectorAll('#moodPicker input[name="profileMood"]')];
  const moodPreviewCode = $("#moodPreviewCode");
  const moodPreviewLabel = $("#moodPreviewLabel");
  const renderMood = moodKey => {
    const meta = app.MOOD_META[moodKey] || app.MOOD_META.ready;
    if (moodPreviewCode) moodPreviewCode.textContent = meta.code || String(moodKey || "ready").toUpperCase();
    if (moodPreviewLabel) moodPreviewLabel.textContent = meta.label;
  };
  moodInputs.forEach(input => {
    input.checked = input.value === profile.mood;
    input.addEventListener("change", () => { if (input.checked) renderMood(input.value); });
  });
  renderMood(profile.mood);

  document.querySelectorAll("#profileSportChecks input").forEach(input => {
    input.checked = profile.preferred_sports.includes(input.value);
  });

  $("#profileForm").addEventListener("submit", event => {
    event.preventDefault();
    const sports = [...document.querySelectorAll("#profileSportChecks input:checked")].map(input => input.value);
    if (!sports.length) {
      alert("좋아하는 운동을 하나 이상 선택해주세요.");
      return;
    }
    const saved = app.saveProfile({
      ...profile,
      nickname: $("#nicknameInput").value.trim(),
      message: $("#messageInput").value.trim(),
      avatar_gender: document.querySelector('input[name="avatarGender"]:checked')?.value || "male",
      mood: document.querySelector('#moodPicker input[name="profileMood"]:checked')?.value || "ready",
      mood_note: $("#moodNoteInput").value.trim(),
      province: $("#profileProvince").value.trim(),
      district: $("#profileDistrict").value.trim(),
      neighborhood: $("#profileNeighborhood").value.trim(),
      preferred_sports: sports,
      transport: $("#profileTransport").value,
      max_travel_minutes: Number($("#profileTravelMinutes").value),
    });
    const message = $("#profileSaveMessage");
    message.textContent = `${saved.nickname}님의 추천 기본값을 저장했어요. HOME에 바로 반영됩니다.`;
    message.classList.add("is-success");
    setTimeout(() => { location.href = document.body?.dataset.homeUrl || "/main/"; }, 700);
  });
})();
