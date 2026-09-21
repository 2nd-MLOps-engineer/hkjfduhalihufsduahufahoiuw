(() => {
  const IS_GUEST = document.body?.dataset.isGuest === "1";
  const STORAGE_NAMESPACE = IS_GUEST ? "usimunkka.guest" : "usimunkka.v1";
  const KEYS = {
    profile: `${STORAGE_NAMESPACE}.profile`,
    talks: `${STORAGE_NAMESPACE}.talks`,
    diary: `${STORAGE_NAMESPACE}.diary`,
    friends: `${STORAGE_NAMESPACE}.friends`,
    mate: `${STORAGE_NAMESPACE}.mate`,
    workoutProgress: `${STORAGE_NAMESPACE}.workout_progress`,
  };

  const SPORT_META = {
    running: { label: "러닝", icon: "🏃" },
    cycling: { label: "자전거", icon: "🚲" },
    crossfit: { label: "크로스핏", icon: "CF" },
    fitness: { label: "헬스", icon: "🏋️" },
  };

  const TRANSPORT_META = {
    walk: "도보",
    transit: "대중교통",
  };

  const MOOD_META = {
    ready: { label: "가볍게 시작", code: "READY" },
    energy: { label: "의욕 충전", code: "FULL POWER" },
    happy: { label: "기분 좋음", code: "GOOD DAY" },
    calm: { label: "여유로움", code: "EASY PACE" },
    tired: { label: "조금 피곤", code: "LOW BATTERY" },
  };

  const defaultProfile = {
    id: 7,
    nickname: "우심이",
    message: "오늘도 일단 움직이자.",
    avatar_gender: "male",
    friend_code: "USIM-7K29",
    province: "서울특별시",
    district: "관악구",
    neighborhood: "봉천동",
    preferred_sports: ["running", "fitness"],
    transport: "walk",
    max_travel_minutes: 20,
    level: 7,
    streak_days: 4,
    pet_exp_percent: 72,
    mood: "ready",
    mood_note: "오늘은 가볍게 움직이고 싶어요.",
  };

  const defaultMate = {
    type: "human",
    style: "performance",
    room: "track",
    name: "MOVE 07",
  };

  const defaultTalks = [
    { author: "민수", text: "오늘 러닝 완료 🔥", time: "08:12" },
    { author: "지훈", text: "난 저녁에 헬스 갈 예정", time: "08:41" },
    { author: "하늘", text: "오늘도 일단 움직여보자!", time: "09:03" },
  ];

  const defaultDiary = [
    { date: "09.16", sport: "running", calories: 420, place: "관악구", score: 420, pet_exp: 42 },
    { date: "09.14", sport: "fitness", calories: 350, place: "관악구", score: 350, pet_exp: 35 },
    { date: "09.12", sport: "cycling", calories: 610, place: "한강", score: 610, pet_exp: 61 },
  ];


  const defaultWorkoutProgress = {
    total_calories: 0,
    entries: [],
  };

  const friendDirectory = [
    { friend_code: "USIM-M520", nickname: "민수", region: "강남구", sport: "running", preferred_sports: ["running", "fitness"], calories: 520, color: "#ffd75f", status: "오늘 러닝 완료", message: "퇴근 후 한 바퀴 같이 달려요.", mood: "energy", pose: "thumb" },
    { friend_code: "USIM-J380", nickname: "지훈", region: "마포구", sport: "fitness", preferred_sports: ["fitness", "crossfit"], calories: 380, color: "#74caff", status: "저녁 헬스 예정", message: "무리하지 말고 꾸준하게!", mood: "calm", pose: "tie" },
    { friend_code: "USIM-HANE", nickname: "하늘", region: "송파구", sport: "cycling", preferred_sports: ["cycling", "running"], calories: 0, color: "#d2b0ff", status: "오늘은 아직 운동 전", message: "날씨 좋으면 자전거 타러 가요.", mood: "ready", pose: "main" },
    { friend_code: "USIM-SEON", nickname: "서연", region: "동작구", sport: "running", preferred_sports: ["running", "cycling"], calories: 240, color: "#f0a58b", status: "오늘 저녁 러닝 예정", message: "가볍게라도 같이 움직여요.", mood: "happy", pose: "wave" },
  ];

  const defaultFriends = friendDirectory.slice(0, 3).map(friend => ({ ...friend }));

  const recommendationCatalog = {
    running: [
      { name: "관악산 둘레길", type: "러닝", travel: 13, indoor: false, score: 92, reasons: ["이동 범위 안", "충분한 러닝 시간 확보", "프로필 선호 종목과 일치"] },
      { name: "도림천 러닝 코스", type: "러닝", travel: 18, indoor: false, score: 86, reasons: ["왕복 이동시간 적합", "러닝 동선 확보", "가벼운 운동에 적합"] },
    ],
    cycling: [
      { name: "한강 자전거길 진입 구간", type: "자전거", travel: 19, indoor: false, score: 90, reasons: ["자전거 이동 동선 확보", "운동시간 충분", "프로필 이동범위 안"] },
      { name: "안양천 자전거길", type: "자전거", travel: 24, indoor: false, score: 82, reasons: ["장거리 라이딩 가능", "추천 시간대 적합", "복귀 시간 계산 가능"] },
    ],
    crossfit: [
      { name: "관악 크로스핏 박스", type: "크로스핏", travel: 16, indoor: true, score: 89, reasons: ["실내 운동", "기능성 트레이닝", "이동 범위 안"] },
      { name: "신림 크로스핏 스튜디오", type: "크로스핏", travel: 20, indoor: true, score: 84, reasons: ["복합 운동 가능", "날씨 영향 적음", "수업 시간 확인 권장"] },
    ],
    fitness: [
      { name: "관악구민종합체육센터", type: "헬스", travel: 12, indoor: true, score: 94, reasons: ["이동시간 짧음", "실내시설", "프로필 선호 종목과 일치"] },
      { name: "봉천 생활체육센터", type: "헬스", travel: 17, indoor: true, score: 88, reasons: ["운동시간 충분", "대중교통 접근 가능", "실내시설"] },
    ],
  };

  const read = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(fallback));
    } catch (_) {
      return JSON.parse(JSON.stringify(fallback));
    }
  };

  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  };

  const normalizeSportKey = key => key === "hyrox" ? "crossfit" : key;

  const normalizeProfile = (value) => ({
    ...defaultProfile,
    ...value,
    preferred_sports: Array.isArray(value?.preferred_sports) && value.preferred_sports.length
      ? value.preferred_sports.map(normalizeSportKey)
      : defaultProfile.preferred_sports,
    max_travel_minutes: Number(value?.max_travel_minutes || defaultProfile.max_travel_minutes),
    avatar_gender: ["female", "male"].includes(value?.avatar_gender) ? value.avatar_gender : defaultProfile.avatar_gender,
    mood: Object.prototype.hasOwnProperty.call(MOOD_META, value?.mood) ? value.mood : defaultProfile.mood,
    mood_note: String(value?.mood_note || defaultProfile.mood_note).slice(0, 40),
  });

  const normalizeMate = value => ({
    ...defaultMate,
    ...(value || {}),
    type: ["human","robot","hybrid"].includes(value?.type) ? value.type : defaultMate.type,
    style: ["performance","street","minimal"].includes(value?.style) ? value.style : defaultMate.style,
    room: ["track","night","lime"].includes(value?.room) ? value.room : defaultMate.room,
    name: String(value?.name || defaultMate.name).slice(0, 16),
  });

  const normalizeFriendCode = value => String(value || "").trim().toUpperCase();

  const normalizeFriend = value => {
    const byCode = friendDirectory.find(row => normalizeFriendCode(row.friend_code) === normalizeFriendCode(value?.friend_code));
    const byName = friendDirectory.find(row => row.nickname === value?.nickname);
    const base = byCode || byName || {};
    return {
      ...base,
      ...(value || {}),
      friend_code: normalizeFriendCode(value?.friend_code || base.friend_code),
      preferred_sports: Array.isArray(value?.preferred_sports) && value.preferred_sports.length
        ? value.preferred_sports.map(normalizeSportKey)
        : (base.preferred_sports || [normalizeSportKey(value?.sport || base.sport || "running")]),
      mood: Object.prototype.hasOwnProperty.call(MOOD_META, value?.mood) ? value.mood : (base.mood || "ready"),
      pose: value?.pose || base.pose || "main",
    };
  };

  const recommend = async ({ province, district, sport, available_minutes, transport, max_travel_minutes }) => {
    await new Promise(resolve => setTimeout(resolve, 220));
    const key = normalizeSportKey(sport || "running");
    const travelLimit = Number(max_travel_minutes || 20);
    const totalMinutes = Number(available_minutes || 60);
    const rows = (recommendationCatalog[key] || recommendationCatalog.running).map((item, index) => {
      const travel = Math.min(item.travel, travelLimit + 8);
      const exerciseMinutes = Math.max(10, totalMinutes - travel * 2);
      const adjustedScore = Math.max(60, Math.min(99, item.score - Math.max(0, travel - travelLimit)));
      return {
        id: `${key}-${index + 1}`,
        ...item,
        sport: key,
        province,
        district,
        transport,
        travel_minutes: travel,
        available_exercise_minutes: exerciseMinutes,
        score: adjustedScore,
      };
    });
    return rows.sort((a, b) => b.score - a.score);
  };

  window.USIMUNKKA = {
    SPORT_META,
    TRANSPORT_META,
    MOOD_META,
    // v1은 프론트 구조 검증용 localStorage 프로토타입입니다.
    // 실제 배포에서는 아래 메서드 내부를 기존 Backend API 호출로 교체합니다.
    getProfile() { return normalizeProfile(read(KEYS.profile, defaultProfile)); },
    saveProfile(profile) { return normalizeProfile(write(KEYS.profile, normalizeProfile(profile))); },
    getTalks() { return read(KEYS.talks, defaultTalks); },
    addTalk(text, author) {
      const talks = read(KEYS.talks, defaultTalks);
      const now = new Date();
      talks.unshift({ author, text, time: now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }) });
      return write(KEYS.talks, talks.slice(0, 12));
    },
    getDiary() { return read(KEYS.diary, defaultDiary); },
    getFriends() { return read(KEYS.friends, defaultFriends).map(normalizeFriend); },
    lookupFriendByCode(code) {
      const normalized = normalizeFriendCode(code);
      if (!normalized) return null;
      const row = friendDirectory.find(friend => normalizeFriendCode(friend.friend_code) === normalized);
      return row ? normalizeFriend(row) : null;
    },
    addFriendByCode(code) {
      const normalized = normalizeFriendCode(code);
      const candidate = this.lookupFriendByCode(normalized);
      if (!candidate) return { ok: false, reason: "not_found" };
      if (normalizeFriendCode(this.getProfile().friend_code) === normalized) {
        return { ok: false, reason: "self", friend: candidate };
      }
      const friends = this.getFriends();
      if (friends.some(friend => normalizeFriendCode(friend.friend_code) === normalized || friend.nickname === candidate.nickname)) {
        return { ok: false, reason: "exists", friend: candidate, friends };
      }
      const next = [...friends, candidate];
      write(KEYS.friends, next);
      return { ok: true, friend: candidate, friends: next };
    },
    getWorkoutProgress() {
      const value = read(KEYS.workoutProgress, defaultWorkoutProgress);
      return {
        total_calories: Math.max(0, Number(value?.total_calories || 0)),
        entries: Array.isArray(value?.entries) ? value.entries : [],
      };
    },
    addWorkoutCalories(calories) {
      const amount = Math.max(0, Math.round(Number(calories || 0)));
      const current = this.getWorkoutProgress();
      if (!amount) return current;
      const now = new Date();
      const next = {
        total_calories: current.total_calories + amount,
        entries: [
          {
            calories: amount,
            created_at: now.toISOString(),
            label: now.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }),
          },
          ...current.entries,
        ].slice(0, 30),
      };
      return write(KEYS.workoutProgress, next);
    },
    getMate() { return normalizeMate(read(KEYS.mate, defaultMate)); },
    saveMate(mate) { return normalizeMate(write(KEYS.mate, normalizeMate(mate))); },
    recommend,
    getQuickRecommendation(profile, availableMinutes = 60) {
      const sport = profile.preferred_sports?.[0] || "running";
      return recommend({
        province: profile.province,
        district: profile.district,
        sport,
        available_minutes: availableMinutes,
        transport: profile.transport,
        max_travel_minutes: profile.max_travel_minutes,
      }).then(rows => rows[0]);
    },
  };
})();
