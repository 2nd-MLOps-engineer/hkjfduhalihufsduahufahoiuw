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

  const sharedClothesImage = document.querySelector("#profileClothesImage");
  if (sharedClothesImage && document.body?.dataset.isGuest !== "1") {
    fetch("/api/room-state/", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("room state unavailable")))
      .then(payload => {
        const outfit = ["summer", "winter"].includes(payload.state?.outfit) ? payload.state.outfit : "default";
        const src = outfit === "summer"
          ? "/static/assets/images/character/clothes/level5/summer/idle_aligned.png"
          : outfit === "winter"
            ? "/static/assets/images/character/clothes/level5/winter/idle_aligned.png"
            : "";
        sharedClothesImage.src = src;
        sharedClothesImage.hidden = !src;
      })
      .catch(() => { sharedClothesImage.hidden = true; });
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

  // Shared BGM player: remember the selected track and position across page navigation.
  const musicPlayer = document.querySelector("#miniMusicPlayer");
  if (musicPlayer) {
    const tracks = [
      { title: "Track 1111", artist: "USIM ROOM TAPE", src: "/static/assets/audio/1111.mp3" },
      { title: "Track 2222", artist: "USIM MOVE MIX", src: "/static/assets/audio/2222.mp3" },
      { title: "Track 333", artist: "USIM ROOM TAPE", src: "/static/assets/audio/333.mp3" },
      { title: "Track 4444", artist: "USIM ROOM TAPE", src: "/static/assets/audio/4444.mp3" }
    ];
    const STORAGE_KEY = "usimunkka-bgm-state";
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch (_) { saved = {}; }
    let trackIndex = Number.isInteger(saved.trackIndex) && saved.trackIndex >= 0 && saved.trackIndex < tracks.length ? saved.trackIndex : 0;
    let playing = saved.playing !== false;
    const titleEl = musicPlayer.querySelector("#musicTrackTitle");
    const artistEl = musicPlayer.querySelector("#musicTrackArtist");
    const progressEl = musicPlayer.querySelector("#musicProgress");
    const timeEl = musicPlayer.querySelector("#musicTime");
    const toggleEl = musicPlayer.querySelector("#musicToggle");
    const prevEl = musicPlayer.querySelector("#musicPrev");
    const nextEl = musicPlayer.querySelector("#musicNext");
    const audio = new Audio();
    audio.preload = "auto";

    const saveState = () => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ trackIndex, currentTime: audio.currentTime || 0, playing })); } catch (_) {}
    };

    const renderMusic = () => {
      const track = tracks[trackIndex];
      titleEl.textContent = track.title;
      artistEl.textContent = track.artist;
      const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 1;
      const safeSeconds = Math.max(0, Math.min(total, audio.currentTime || 0));
      const mm = Math.floor(safeSeconds / 60);
      const ss = String(safeSeconds % 60).padStart(2, "0");
      timeEl.textContent = `${mm}:${ss}`;
      progressEl.style.width = `${Math.max(6, Math.min(96, (safeSeconds / total) * 100))}%`;
      musicPlayer.classList.toggle("is-playing", playing);
      toggleEl.querySelector("span").textContent = playing ? "Ⅱ" : "▶";
      toggleEl.setAttribute("aria-label", playing ? "일시정지" : "재생");
    };

    const loadTrack = (autoplay = playing, startAt = 0) => {
      const track = tracks[trackIndex];
      audio.src = track.src;
      audio.load();
      audio.addEventListener("loadedmetadata", () => {
        audio.currentTime = Math.min(Math.max(0, Number(startAt) || 0), Math.max(0, audio.duration - 0.2));
        renderMusic();
        if (autoplay) audio.play().catch(() => { playing = false; renderMusic(); saveState(); });
      }, { once: true });
      renderMusic();
    };

    toggleEl.addEventListener("click", () => {
      playing = !playing;
      if (playing) audio.play().catch(() => { playing = false; }).finally(() => { renderMusic(); saveState(); });
      else audio.pause();
      renderMusic();
      saveState();
    });
    const changeTrack = direction => {
      trackIndex = (trackIndex + direction + tracks.length) % tracks.length;
      playing = true;
      loadTrack(true, 0);
      saveState();
    };
    prevEl.addEventListener("click", () => changeTrack(-1));
    nextEl.addEventListener("click", () => changeTrack(1));
    audio.addEventListener("timeupdate", renderMusic);
    audio.addEventListener("pause", saveState);
    audio.addEventListener("ended", () => changeTrack(1));
    window.addEventListener("pagehide", saveState);
    loadTrack(playing, saved.currentTime || 0);
    renderMusic();
  }
})();
