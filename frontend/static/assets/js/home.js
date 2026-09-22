(() => {
  const app = window.USIMUNKKA;
  if (!app) return;

  const isRoomVisitor = document.body?.dataset.roomVisitor === "1";
  const roomOwnerId = document.body?.dataset.roomOwnerId?.trim() || document.body?.dataset.memberId?.trim() || "";
  const memberNickname = document.body?.dataset.roomOwnerNickname?.trim() || document.body?.dataset.memberNickname?.trim() || "";
  const memberAddress = document.body?.dataset.roomOwnerAddress?.trim() || document.body?.dataset.memberAddress?.trim() || "";
  const memberId = document.body?.dataset.memberId?.trim() || "";
  const isMember = Boolean(memberId) && document.body?.dataset.isGuest !== "1" && !isRoomVisitor;
  const csrfToken = document.querySelector("meta[name='csrf-token']")?.content || "";
  const serverLocationLoaded = document.body?.dataset.locationLoaded === "1";
  const pageParams = new URLSearchParams(window.location.search);
  const pageLatitude = Number(pageParams.get("latitude"));
  const pageLongitude = Number(pageParams.get("longitude"));
  if (Number.isFinite(pageLatitude) && Number.isFinite(pageLongitude)) {
    window.__usimunkkaCurrentLocation = { latitude: pageLatitude, longitude: pageLongitude };
  }
  let initialRecommendations = [];
  try {
    initialRecommendations = JSON.parse(document.getElementById("initialRecommendations")?.textContent || "[]");
  } catch (_) {
    initialRecommendations = [];
  }
  const profile = { ...app.getProfile(), ...(memberAddress ? { address: memberAddress } : {}) };
  const $ = selector => document.querySelector(selector);
  const set = (selector, value) => {
    const el = $(selector);
    if (el) el.textContent = value;
  };
  const sportLabel = sport => app.SPORT_META[sport]?.label || sport;
  const transportLabel = app.TRANSPORT_META[profile.transport] || profile.transport;

  const accountStorageKey = roomOwnerId || "guest";
  const ROOM_STATE_KEY = `usimunkka.v1.room.state.${accountStorageKey}.v91`;
  const LAYOUT_KEY = `usimunkka.v1.room.layout.${accountStorageKey}.v91`;
  const defaultVisible = {
    window: true,
    poster: true,
    bed: true,
    shelf: true,
    desk: true,
    rug: true,
    plant: true,
    lamp: true,
    character: true,
    bottle: false,
    towel: false,
    dumbbell: false,
    gymbag: false,
    shoes: false,
    medal: false,
  };
  const defaultState = { tone: "cream", visible: { ...defaultVisible } };
  const ROOM_REWARDS = [
    { key: "bottle", calories: 100, label: "운동 물병" },
    { key: "towel", calories: 250, label: "스포츠 타월" },
    { key: "dumbbell", calories: 450, label: "덤벨" },
    { key: "gymbag", calories: 700, label: "운동 가방" },
    { key: "shoes", calories: 1000, label: "러닝화" },
    { key: "medal", calories: 1500, label: "기념 메달" },
  ];
  const ROOM_LEVEL_KCAL = 1500;
  const ROOM_LEVEL_TITLES = ["STARTER", "MOVER", "PACE MAKER", "ATHLETE", "ROOM MAKER", "MOVE MASTER"];

  const getRoomLevelInfo = rawTotal => {
    const total = Math.max(0, Math.floor(Number(rawTotal) || 0));
    const level = Math.floor(total / ROOM_LEVEL_KCAL) + 1;
    const exp = total % ROOM_LEVEL_KCAL;
    const percent = Math.max(0, Math.min(100, (exp / ROOM_LEVEL_KCAL) * 100));
    const remaining = ROOM_LEVEL_KCAL - exp;
    const title = ROOM_LEVEL_TITLES[Math.min(level - 1, ROOM_LEVEL_TITLES.length - 1)];
    return { total, level, exp, percent, remaining, title };
  };

  const safeJson = (key, fallback) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "null");
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  };

  const readRoomState = () => {
    const stored = safeJson(ROOM_STATE_KEY, {});
    const tone = ["cream", "sage", "blue"].includes(stored.tone) ? stored.tone : defaultState.tone;
    return {
      tone,
      visible: { ...defaultVisible, ...(stored.visible || {}) },
    };
  };

  let savedState = readRoomState();
  let draftState = JSON.parse(JSON.stringify(savedState));

  set("#homeNickname", memberNickname || profile.nickname);
  set("#homeRegion", memberAddress || `${profile.province} ${profile.district}`);
  set("#homePreference", `${profile.preferred_sports.map(sportLabel).join(" · ")} · ${transportLabel} ${profile.max_travel_minutes}분 기준`);

  let serverProgress = isMember
    ? { total_calories: 0, entries: [] }
    : (isRoomVisitor ? { total_calories: Number(document.body?.dataset.roomOwnerCalories || 0), entries: [] } : null);
  const getWorkoutProgress = () => serverProgress || app.getWorkoutProgress?.() || { total_calories: 0, entries: [] };
  const isUnlocked = (key, total = getWorkoutProgress().total_calories) => {
    const reward = ROOM_REWARDS.find(item => item.key === key);
    return !reward || total >= reward.calories;
  };

  const applyRoomState = state => {
    const room = $("#sportsRoom");
    if (!room) return;
    room.dataset.tone = state.tone;
    document.querySelectorAll("[data-room-item]").forEach(item => {
      const key = item.dataset.roomItem;
      const unlocked = isUnlocked(key);
      const visible = unlocked && state.visible[key] !== false;
      item.classList.toggle("is-room-hidden", !visible);
      item.classList.toggle("is-room-locked", !unlocked);
    });
  };

  const syncCustomizer = () => {
    document.querySelectorAll("[data-tone]").forEach(button => {
      button.classList.toggle("is-selected", button.dataset.tone === draftState.tone);
    });
    const total = getWorkoutProgress().total_calories;
    document.querySelectorAll("[data-toggle-item]").forEach(button => {
      const key = button.dataset.toggleItem;
      const unlocked = isUnlocked(key, total);
      button.classList.toggle("is-locked", !unlocked);
      button.classList.toggle("is-selected", unlocked && draftState.visible[key] !== false);
      button.setAttribute("aria-disabled", String(!unlocked));
      const status = button.querySelector("small");
      if (status && button.dataset.unlockCalories) status.textContent = unlocked ? "UNLOCKED" : "LOCKED";
    });
    applyRoomState(draftState);
  };

  const openCustomizer = () => {
    if (isRoomVisitor) return;
    draftState = JSON.parse(JSON.stringify(savedState));
    syncCustomizer();
    const backdrop = $("#customizerBackdrop");
    if (backdrop) backdrop.hidden = false;
    document.body.style.overflow = "hidden";
  };

  const closeCustomizer = restore => {
    if (restore) applyRoomState(savedState);
    const backdrop = $("#customizerBackdrop");
    if (backdrop) backdrop.hidden = true;
    document.body.style.overflow = "";
  };

  $("#openCustomizer")?.addEventListener("click", openCustomizer);
  $("#closeCustomizer")?.addEventListener("click", () => closeCustomizer(true));
  $("#customizerBackdrop")?.addEventListener("click", event => {
    if (event.target === event.currentTarget) closeCustomizer(true);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !$("#customizerBackdrop")?.hidden) closeCustomizer(true);
  });

  document.querySelectorAll("[data-tone]").forEach(button => {
    button.addEventListener("click", () => {
      draftState.tone = button.dataset.tone;
      syncCustomizer();
    });
  });

  document.querySelectorAll("[data-toggle-item]").forEach(button => {
    button.addEventListener("click", () => {
      const key = button.dataset.toggleItem;
      if (!isUnlocked(key)) {
        const need = Number(button.dataset.unlockCalories || 0);
        set("#customizerSaveMessage", `${need.toLocaleString("ko-KR")} kcal를 채우면 열리는 소품이에요.`);
        return;
      }
      draftState.visible[key] = !(draftState.visible[key] !== false);
      syncCustomizer();
    });
  });

  $("#saveCustomizer")?.addEventListener("click", () => {
    if (isRoomVisitor) return;
    savedState = JSON.parse(JSON.stringify(draftState));
    localStorage.setItem(ROOM_STATE_KEY, JSON.stringify(savedState));
    applyRoomState(savedState);
    persistRoomState();
    set("#customizerSaveMessage", "저장했어요. 내 방에 바로 반영됐어요.");
    window.setTimeout(() => closeCustomizer(false), 450);
  });

  const roomScene = $("#roomScene");
  const draggableItems = [...document.querySelectorAll("[data-room-item]")];
  let activeDrag = null;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const getLimits = item => ({
    minX: Number(item.dataset.minX || 5),
    maxX: Number(item.dataset.maxX || 95),
    minY: Number(item.dataset.minY || 10),
    maxY: Number(item.dataset.maxY || 91),
  });

  const setItemPosition = (item, x, y, save = false) => {
    if (isRoomVisitor) return;
    const limits = getLimits(item);
    const nx = clamp(Number(x), limits.minX, limits.maxX);
    const ny = clamp(Number(y), limits.minY, limits.maxY);
    item.style.left = `${nx}%`;
    item.style.top = `${ny}%`;
    item.dataset.x = String(nx);
    item.dataset.y = String(ny);
    if (save) saveLayout();
  };

  const saveLayout = () => {
    if (isRoomVisitor) return;
    const state = {};
    draggableItems.forEach(item => {
      state[item.dataset.roomItem] = {
        x: Number(item.dataset.x || item.dataset.defaultX || 50),
        y: Number(item.dataset.y || item.dataset.defaultY || 50),
      };
    });
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(state));
    persistRoomState();
  };

  const persistRoomState = async () => {
    if (!isMember) return;
    try {
      await fetch("/api/room-state/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken, Accept: "application/json" },
        body: JSON.stringify({ state: savedState, layout: safeJson(LAYOUT_KEY, {}) }),
      });
    } catch (_) {}
  };

  const loadServerRoomState = async () => {
    const url = isRoomVisitor ? `/api/room-state/${encodeURIComponent(roomOwnerId)}/` : (isMember ? "/api/room-state/" : "");
    if (!url) return;
    try {
      const response = await fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("방 상태 조회 실패");
      const payload = await response.json();
      const hasServerState = payload.state && Object.keys(payload.state).length;
      const hasServerLayout = payload.layout && Object.keys(payload.layout).length;
      if (hasServerState) {
        savedState = { tone: payload.state.tone || defaultState.tone, visible: { ...defaultVisible, ...(payload.state.visible || {}) } };
        draftState = JSON.parse(JSON.stringify(savedState));
      }
      if (hasServerLayout) localStorage.setItem(LAYOUT_KEY, JSON.stringify(payload.layout));
      if (!isRoomVisitor && (!hasServerState || !hasServerLayout)) persistRoomState();
    } catch (_) {}
  };

  const restoreLayout = () => {
    const savedLayout = safeJson(LAYOUT_KEY, {});
    draggableItems.forEach(item => {
      const key = item.dataset.roomItem;
      const saved = savedLayout[key];
      const x = saved?.x ?? Number(item.dataset.defaultX || 50);
      const y = saved?.y ?? Number(item.dataset.defaultY || 50);
      setItemPosition(item, x, y, false);
    });
  };

  const pointerPosition = event => {
    const rect = roomScene.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  };

  draggableItems.forEach(item => {
    item.addEventListener("pointerdown", event => {
      if (isRoomVisitor) return;
      if (item.classList.contains("is-room-hidden")) return;
      if (event.button !== undefined && event.button !== 0) return;
      const sceneRect = roomScene.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      activeDrag = {
        item,
        offsetX: ((event.clientX - (itemRect.left + itemRect.width / 2)) / sceneRect.width) * 100,
        offsetY: ((event.clientY - (itemRect.top + itemRect.height / 2)) / sceneRect.height) * 100,
      };
      item.classList.add("is-dragging");
      item.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });

    item.addEventListener("pointermove", event => {
      if (activeDrag?.item !== item) return;
      const pos = pointerPosition(event);
      setItemPosition(item, pos.x - activeDrag.offsetX, pos.y - activeDrag.offsetY, false);
    });

    const endDrag = event => {
      if (activeDrag?.item !== item) return;
      item.classList.remove("is-dragging");
      item.releasePointerCapture?.(event.pointerId);
      activeDrag = null;
      saveLayout();
    };
    item.addEventListener("pointerup", endDrag);
    item.addEventListener("pointercancel", endDrag);

    item.addEventListener("keydown", event => {
      if (isRoomVisitor) return;
      if (item.classList.contains("is-room-hidden")) return;
      const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const step = event.shiftKey ? 3 : 1;
      let x = Number(item.dataset.x || item.dataset.defaultX || 50);
      let y = Number(item.dataset.y || item.dataset.defaultY || 50);
      if (event.key === "ArrowLeft") x -= step;
      if (event.key === "ArrowRight") x += step;
      if (event.key === "ArrowUp") y -= step;
      if (event.key === "ArrowDown") y += step;
      setItemPosition(item, x, y, true);
    });
  });

  $("#resetRoomLayout")?.addEventListener("click", () => {
    if (isRoomVisitor) return;
    draggableItems.forEach(item => {
      setItemPosition(item, Number(item.dataset.defaultX || 50), Number(item.dataset.defaultY || 50), false);
    });
    localStorage.removeItem(LAYOUT_KEY);
  });

  const renderWorkoutProgress = (flashMessage = "") => {
    const progress = getWorkoutProgress();
    const total = Math.max(0, Math.floor(Number(progress.total_calories) || 0));
    const levelInfo = getRoomLevelInfo(total);
    const nextReward = ROOM_REWARDS.find(item => total < item.calories);

    set("#roomTotalCalories", `${total.toLocaleString("ko-KR")} kcal TOTAL`);
    set("#roomLevelBadge", `LV. ${levelInfo.level}`);
    set("#roomLevelTitle", levelInfo.title);
    set("#roomLevelExp", `${levelInfo.exp.toLocaleString("ko-KR")} / ${ROOM_LEVEL_KCAL.toLocaleString("ko-KR")} MOVE EXP`);
    set("#roomNextLevel", `다음 레벨까지 ${levelInfo.remaining.toLocaleString("ko-KR")} kcal`);
    set("#roomLevelPercent", `${Math.floor(levelInfo.percent)}%`);

    const bar = $("#roomProgressBar");
    if (bar) bar.style.width = `${levelInfo.percent}%`;

    if (flashMessage) {
      set("#roomUnlockMessage", flashMessage);
    } else if (nextReward) {
      set("#roomUnlockMessage", `다음 소품 · ${nextReward.label} — ${Math.max(0, nextReward.calories - total).toLocaleString("ko-KR")} kcal 남았어요.`);
    } else {
      set("#roomUnlockMessage", `MOVE REWARD 전부 해금 완료 · ROOM LV.${levelInfo.level} 성장 중!`);
    }

    syncCustomizer();
  };

  $("#workoutLogForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (isRoomVisitor) return;
    const input = $("#workoutCaloriesInput");
    const numericValue = Number(input?.value || 0);
    const amount = Math.round(numericValue);

    if (!Number.isFinite(numericValue) || !Number.isSafeInteger(amount) || amount <= 0) {
      set("#roomUnlockMessage", "1 kcal 이상의 숫자를 입력해주세요. 상한은 없어요.");
      input?.focus();
      return;
    }

    const before = Math.max(0, Math.floor(Number(getWorkoutProgress().total_calories) || 0));
    const beforeLevel = getRoomLevelInfo(before).level;
    let progress;
    if (isMember) {
      try {
        const response = await fetch("/workout-calories-data/", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken, Accept: "application/json" },
          body: JSON.stringify({ calories: amount }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "운동량 저장에 실패했습니다.");
        serverProgress = payload;
        progress = payload;
      } catch (error) {
        set("#roomUnlockMessage", error.message);
        return;
      }
    } else {
      progress = app.addWorkoutCalories?.(amount) || { total_calories: before + amount };
    }
    const after = Math.max(0, Math.floor(Number(progress.total_calories) || before + amount));
    const afterLevel = getRoomLevelInfo(after).level;
    const newlyUnlocked = ROOM_REWARDS.filter(item => before < item.calories && after >= item.calories);

    if (newlyUnlocked.length) {
      newlyUnlocked.forEach(item => { savedState.visible[item.key] = true; });
      localStorage.setItem(ROOM_STATE_KEY, JSON.stringify(savedState));
      draftState = JSON.parse(JSON.stringify(savedState));
      applyRoomState(savedState);
    }

    const messages = [`${amount.toLocaleString("ko-KR")} kcal 기록 완료`];
    if (newlyUnlocked.length) messages.push(`${newlyUnlocked.map(item => item.label).join(" · ")} 해금`);
    if (afterLevel > beforeLevel) {
      messages.push(afterLevel - beforeLevel > 1
        ? `ROOM LV.${beforeLevel} → LV.${afterLevel} 점프!`
        : `ROOM LV.${afterLevel} LEVEL UP!`);
    } else if (!newlyUnlocked.length) {
      messages.push(`LV.${afterLevel} EXP +${amount.toLocaleString("ko-KR")}`);
    }

    renderWorkoutProgress(messages.join(" · "));

    const card = $("#roomProgressCard");
    if (afterLevel > beforeLevel && card) {
      card.classList.remove("is-level-up");
      void card.offsetWidth;
      card.classList.add("is-level-up");
      window.setTimeout(() => card.classList.remove("is-level-up"), 900);
    }

    if (input) input.value = "";
  });

  const sportBadge = sport => ({ running: "RUN", cycling: "RIDE", crossfit: "CF", fitness: "GYM" }[sport] || "MOVE");
  let locationPromise;
  const requestCurrentLocation = () => {
    if (locationPromise) return locationPromise;
    locationPromise = new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 3000, maximumAge: 300000 },
      );
    });
    return locationPromise;
  };

  const renderQuick = async () => {
    const requestedMinutes = pageParams.get("available_minutes");
    const minutes = Number(requestedMinutes || $("#quickMinutes")?.value || 60);
    const minutesInput = $("#quickMinutes");
    if (minutesInput && ["30", "60", "90", "120"].includes(requestedMinutes || "")) {
      minutesInput.value = requestedMinutes;
    }
    // 위치 확인을 기다리지 않고 로그인 지역 추천을 먼저 표시한다.
    // GPS가 확인되면 아래 백그라운드 요청이 현재 위치 기준 결과로 교체한다.
    const locationTask = serverLocationLoaded ? Promise.resolve(null) : requestCurrentLocation();
    const currentLocation = window.__usimunkkaCurrentLocation || null;
    const region = memberAddress || `${profile.province || ""} ${profile.district || ""}`.trim();
    const parts = region.split(/\s+/).filter(Boolean);
    const aliases = { 수원: ["경기도", "수원시"], 수원시: ["경기도", "수원시"] };
    const normalized = aliases[parts.join(" ")] || aliases[parts.at(-1)] || [parts[0], parts.at(-1)];
    const selectedSport = profile.preferred_sports?.[0] || "fitness";
    let result;
    const initialItem = initialRecommendations.find(item => item.sport === (selectedSport === "헬스" ? "fitness" : selectedSport)) || initialRecommendations[0];
    if (initialItem) {
      result = {
        ...initialItem,
        sport: initialItem.sport || selectedSport,
        name: initialItem.name || initialItem.facility_name,
        travel_minutes: initialItem.travel_time,
        indoor: initialItem.indoor,
        reasons: initialItem.reasons || [],
      };
    } else try {
      const params = new URLSearchParams({
        province: normalized[0] || "",
        district: normalized[1] || "",
        sports: selectedSport,
        available_minutes: String(minutes),
        max_travel_minutes: String(profile.max_travel_minutes || 20),
        transport: profile.transport || "walk",
      });
      if (currentLocation) {
        params.set("latitude", String(currentLocation.latitude));
        params.set("longitude", String(currentLocation.longitude));
      }
      const response = await fetch(`/nearby-facilities-data/?${params}`, { credentials: "same-origin", headers: { Accept: "application/json" } });
      const data = await response.json();
      if (!response.ok || !data.recommendations?.length) throw new Error("지역·운동 조건에 맞는 시설 없음");
      const item = data.recommendations[0];
      result = {
        ...item,
        sport: item.sport || selectedSport,
        name: item.name || item.facility_name,
        travel_minutes: item.travel_time,
        indoor: item.indoor,
        reasons: item.reasons || [],
      };
    } catch (_) {
      // 다른 지역의 기본 샘플을 보여주면 사용자에게 잘못된 추천이 되므로,
      // API 실패 시에는 지역이 다른 가짜 시설을 대신 표시하지 않는다.
      set("#spotlightIcon", selectedSport === "fitness" ? "GYM" : "MOVE");
      set("#spotlightSport", sportLabel(selectedSport));
      set("#spotlightTitle", `${region} 추천을 불러오지 못했어요`);
      set("#spotlightMeta", `${sportLabel(selectedSport)} · ${profile.transport || "도보"} · 지역 일치 시설만 표시`);
      const tags = $("#spotlightTags");
      if (tags) tags.innerHTML = "<span>다시 추천을 눌러 재시도하세요</span>";
      if (!currentLocation) {
        locationTask.then(location => {
          if (!location || window.__usimunkkaCurrentLocation) return;
          window.location.href = `${document.body.dataset.homeUrl || "/main/"}?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}`;
        });
      }
      return;
    }
    set("#spotlightIcon", sportBadge(result.sport));
    set("#spotlightSport", sportLabel(result.sport));
    set("#spotlightTitle", result.name);
    const distanceLabel = result.distance_km != null ? `${result.distance_km}km · ` : "";
    set("#spotlightMeta", `${sportLabel(result.sport)} · ${distanceLabel}${transportLabel} ${result.travel_minutes}분 · ${result.indoor ? "실내" : "야외"}`);
    const tags = $("#spotlightTags");
    if (tags) {
      const visibleReasons = result.reasons.filter(reason => reason !== "시설 기본정보 확인").slice(0, 3);
      tags.innerHTML = visibleReasons.map(reason => `<span>${reason}</span>`).join("");
    }

    if (!currentLocation) {
      locationTask.then(location => {
        if (!location || window.__usimunkkaCurrentLocation) return;
        window.location.href = `${document.body.dataset.homeUrl || "/main/"}?latitude=${encodeURIComponent(location.latitude)}&longitude=${encodeURIComponent(location.longitude)}`;
      });
    }
  };

  const renderTalks = () => {
    const list = $("#homeTalkList");
    if (!list) return;
    list.innerHTML = app.getTalks().slice(0, 3).map(row => `
      <div class="talk-row"><b>${row.author}</b><span>${row.text}</span><time>${row.time}</time></div>
    `).join("");
  };

  const reloadRecommendation = async () => {
    const minutes = Number($("#quickMinutes")?.value || 60);
    let location = window.__usimunkkaCurrentLocation || null;
    if (!location) location = await requestCurrentLocation();
    const params = new URLSearchParams({
      available_minutes: String(minutes),
      max_travel_minutes: String(profile.max_travel_minutes || 20),
      refresh: String(Date.now()),
    });
    if (location) {
      params.set("latitude", String(location.latitude));
      params.set("longitude", String(location.longitude));
    }
    window.location.href = `${document.body.dataset.homeUrl || "/main/"}?${params}`;
  };

  $("#quickRecommendButton")?.addEventListener("click", reloadRecommendation);
  $("#quickMinutes")?.addEventListener("change", reloadRecommendation);
  $("#homeTalkForm")?.addEventListener("submit", event => {
    event.preventDefault();
    if (isRoomVisitor) return;
    const input = $("#homeTalkInput");
    const text = input.value.trim();
    if (!text) return;
    app.addTalk(text, memberNickname || profile.nickname);
    input.value = "";
    renderTalks();
  });

  const bootHome = async () => {
    await loadServerRoomState();
    applyRoomState(savedState);
    restoreLayout();
    renderWorkoutProgress();
    renderTalks();
    if (isMember) {
      fetch("/account-state-data/", { credentials: "same-origin", headers: { Accept: "application/json" } })
        .then(response => response.ok ? response.json() : Promise.reject(new Error("계정 상태 조회 실패")))
        .then(payload => {
          serverProgress = payload;
          renderWorkoutProgress();
        })
        .catch(() => {});
    }
    renderQuick();
  };
  bootHome();
})();
