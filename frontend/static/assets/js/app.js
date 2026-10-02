(() => {
  const app = window.USIMUNKKA;
  if (!app) return;
  const profile = app.getProfile();
  const memberNickname = document.body?.dataset.memberNickname?.trim() || "";
  const memberAddress = document.body?.dataset.memberAddress?.trim() || "";
  const sportLabels = profile.preferred_sports.map(s => app.SPORT_META[s]?.label || s);
  const transport = app.TRANSPORT_META[profile.transport] || profile.transport;
  const $ = selector => document.querySelector(selector);

  const set = (selector, text) => { const el = $(selector); if (el) el.textContent = text; };
  const avatarGender = ["female", "male"].includes(profile.avatar_gender) ? profile.avatar_gender : "male";
  const genderSource = image => avatarGender === "female"
    ? (image.dataset.femaleSrc || image.dataset.defaultSrc || image.getAttribute("src") || "")
    : (image.dataset.maleSrc || image.dataset.defaultSrc || image.getAttribute("src") || "");

  document.querySelectorAll('img[data-female-src][data-male-src]').forEach(image => {
    if (image.id === "profileAvatarImage") return;
    const fallback = genderSource(image);
    image.src = fallback;
    image.addEventListener("error", () => { image.src = image.dataset.defaultSrc || fallback; }, { once: true });
  });

  const profileImage = document.querySelector("#profileAvatarImage");
  if (profileImage) {
    const fallback = genderSource(profileImage);
    const custom = profile.image_url || profile.profile_image || profile.image || "";
    profileImage.src = custom || fallback;
    profileImage.addEventListener("error", () => { profileImage.src = fallback; }, { once: true });
  }

  set("#profileNickname", memberNickname || profile.nickname);
  set("#profileMessage", profile.message);
  set("#profileRegion", memberAddress || `${profile.province.replace("특별시", "").replace("광역시", "")} ${profile.district}`);
  set("#profileSports", sportLabels.join(" · "));
  set("#profileMove", `${transport} · ${profile.max_travel_minutes}분`);
  const moodMeta = app.MOOD_META[profile.mood] || app.MOOD_META.ready;
  set("#profileMood", `${moodMeta.code || "VIBE"} · ${moodMeta.label}`);
  const profileMoodEl = $("#profileMood");
  if (profileMoodEl && profile.mood_note) profileMoodEl.title = profile.mood_note;
  set("#profileLevel", String(profile.level).padStart(2, "0"));
  set("#profileStreak", `${profile.streak_days} DAYS`);

  const diary = app.getDiary();
  const todayCalories = diary[0]?.date === new Date().toLocaleDateString("ko-KR", {month:"2-digit",day:"2-digit"}).replace(". ", ".").replace(".", "") ? diary[0].calories : 0;
  if (todayCalories > 0) {
    set("#todayStatus", "오늘 운동 완료");
  }

})();
