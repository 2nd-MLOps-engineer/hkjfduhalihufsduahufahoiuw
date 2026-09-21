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

  // Decorative BGM player: visual-only, no audio source is loaded.
  const musicPlayer = document.querySelector("#miniMusicPlayer");
  if (musicPlayer) {
    const tracks = [
      { title: "Morning Lap", artist: "USIM ROOM MIX", seconds: 37 },
      { title: "Window Seat", artist: "ROOM TAPE 02", seconds: 64 },
      { title: "After Five", artist: "USIM SIDE B", seconds: 91 }
    ];
    let trackIndex = 0;
    let playing = true;
    let seconds = tracks[0].seconds;
    const titleEl = musicPlayer.querySelector("#musicTrackTitle");
    const artistEl = musicPlayer.querySelector("#musicTrackArtist");
    const progressEl = musicPlayer.querySelector("#musicProgress");
    const timeEl = musicPlayer.querySelector("#musicTime");
    const toggleEl = musicPlayer.querySelector("#musicToggle");
    const prevEl = musicPlayer.querySelector("#musicPrev");
    const nextEl = musicPlayer.querySelector("#musicNext");

    const renderMusic = () => {
      const track = tracks[trackIndex];
      titleEl.textContent = track.title;
      artistEl.textContent = track.artist;
      const total = 180;
      const safeSeconds = Math.max(0, Math.min(total, seconds));
      const mm = Math.floor(safeSeconds / 60);
      const ss = String(safeSeconds % 60).padStart(2, "0");
      timeEl.textContent = `${mm}:${ss}`;
      progressEl.style.width = `${Math.max(6, Math.min(96, (safeSeconds / total) * 100))}%`;
      musicPlayer.classList.toggle("is-playing", playing);
      toggleEl.querySelector("span").textContent = playing ? "Ⅱ" : "▶";
      toggleEl.setAttribute("aria-label", playing ? "일시정지 상태로 보기" : "재생 상태로 보기");
    };

    toggleEl.addEventListener("click", () => { playing = !playing; renderMusic(); });
    prevEl.addEventListener("click", () => { trackIndex = (trackIndex + tracks.length - 1) % tracks.length; seconds = tracks[trackIndex].seconds; renderMusic(); });
    nextEl.addEventListener("click", () => { trackIndex = (trackIndex + 1) % tracks.length; seconds = tracks[trackIndex].seconds; renderMusic(); });
    window.setInterval(() => {
      if (!playing) return;
      seconds += 1;
      if (seconds > 179) seconds = 0;
      renderMusic();
    }, 1000);
    renderMusic();
  }
})();
