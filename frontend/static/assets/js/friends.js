(() => {
  const app = window.USIMUNKKA;
  const profile = app.getProfile();
  const $ = selector => document.querySelector(selector);
  const escapeHTML = value => String(value ?? "").replace(/[&<>'"]/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[ch]));
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";
  const codeInput = $("#friendCodeInput");
  const lookupButton = $("#friendLookupButton");
  const addButton = $("#friendAddButton");
  const feedback = $("#friendAddFeedback");
  const frame = $("#friendLookupFrame");
  const requestModal = $("#friendRequestModal");
  const requestList = $("#friendRequestList");
  const requestCount = $("#friendRequestCount");
  const requestButton = $("#friendRequestsButton");
  let selectedFriend = null;
  let friends = [];

  const openFriendVisitor = card => {
    const index = Array.from($("#friendCards").children).indexOf(card);
    const friend = friends[index];
    if (friend?.id) window.location.assign(`/friends/visitor/${encodeURIComponent(friend.id)}/`);
  };

  $("#friendCards").addEventListener("click", event => {
    const card = event.target.closest(".friend-card");
    if (card) openFriendVisitor(card);
  });

  $("#friendCards").addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest(".friend-card");
    if (!card) return;
    event.preventDefault();
    openFriendVisitor(card);
  });

  $("#myFriendCode").textContent = document.body?.dataset.memberFriendCode || profile.friend_code || "-";

  const getAvatar = pose => frame?.dataset[`avatar${String(pose || "main").replace(/^./, c => c.toUpperCase())}`]
    || frame?.dataset.avatarMain || "";

  const renderFriends = rows => {
    friends = Array.isArray(rows) ? rows : [];
    $("#friendCount").textContent = `친구 ${friends.length}명`;
    $("#friendCards").innerHTML = friends.map(friend => `
      <article class="friend-card">
        <div class="friend-card-head">
          <span class="friend-mini-avatar" style="background:${escapeHTML(friend.color || "#e7dfd1")}">${escapeHTML(String(friend.nickname || "?").slice(0, 1))}</span>
          <div><h3>${escapeHTML(friend.nickname)}</h3><small>${escapeHTML(friend.region || "지역 미설정")}</small></div>
        </div>
        <p>${escapeHTML(friend.status || "운동 기다리는 중")}</p>
        <strong>${friend.calories ? `누적 ${Number(friend.calories)} kcal 🔥` : "운동 기다리는 중"}</strong>
      </article>
    `).join("") || `<p class="friend-empty-copy">아직 친구가 없어요. 친구 코드로 첫 친구를 추가해보세요.</p>`;
    $("#friendCards").querySelectorAll(".friend-card").forEach(card => {
      card.tabIndex = 0;
      card.setAttribute("role", "link");
      card.setAttribute("aria-label", `${card.querySelector("h3")?.textContent || "친구"}의 운동방 방문`);
    });
  };

  const renderGuestbook = rows => {
    const notes = Array.isArray(rows) ? rows : [];
    $("#guestbookList").innerHTML = notes.map(row => `
      <div class="guestbook-row"><b>${escapeHTML(row.author)}</b><span>${escapeHTML(row.text)}</span><time>${escapeHTML(row.time)}</time></div>
    `).join("") || `<p class="friend-empty-copy">친구들과 나눈 운동 한마디가 여기에 보여요.</p>`;
  };

  const renderFriendRequests = rows => {
    const requests = Array.isArray(rows) ? rows : [];
    requestCount.textContent = String(requests.length);
    requestButton.hidden = requests.length === 0;
    requestList.innerHTML = requests.map(row => `
      <div class="friend-request-row">
        <div class="friend-request-copy"><strong>${escapeHTML(row.nickname)}</strong><small>${escapeHTML(row.region || "지역 미설정")} · ${escapeHTML(row.created_at || "")}</small></div>
        <div class="friend-request-actions"><button class="accept" data-request-action="accept" data-request-id="${row.id}">승인</button><button class="decline" data-request-action="decline" data-request-id="${row.id}">거절</button></div>
      </div>
    `).join("") || `<div class="friend-request-empty">새로운 친구 요청이 없어요.</div>`;
  };

  const loadFriendRequests = async () => {
    try {
      const payload = await requestJSON("/api/friend-requests/");
      renderFriendRequests(payload.requests);
    } catch (_) {
      renderFriendRequests([]);
    }
  };

  const renderLookupEmpty = (message = "코드를 조회하면 친구의 프로필이 이 액자 안에 나타나요.") => {
    selectedFriend = null;
    frame.className = "friend-profile-frame is-empty";
    frame.innerHTML = `<div class="friend-frame-empty"><span aria-hidden="true">⌕</span><strong>친구 프로필 미리보기</strong><p>${escapeHTML(message)}</p></div>`;
    addButton.disabled = true;
    addButton.querySelector("span").textContent = "ADD CREW";
  };

  const renderLookupProfile = friend => {
    selectedFriend = friend;
    const mood = app.MOOD_META[friend.mood] || app.MOOD_META.ready;
    const sports = (friend.preferred_sports || [friend.sport]).map(key => app.SPORT_META[key]?.label || key);
    const alreadyFriend = friends.some(row => row.id === friend.id || row.friend_code === friend.friend_code);
    const avatar = getAvatar(friend.pose);
    frame.className = "friend-profile-frame has-profile";
    frame.innerHTML = `
      <div class="friend-frame-mat">
        <div class="friend-frame-photo"><img src="${escapeHTML(avatar)}" alt="${escapeHTML(friend.nickname)} 프로필 캐릭터"></div>
        <div class="friend-frame-copy">
          <div class="friend-frame-heading"><div><small>FRIEND PROFILE</small><h3>${escapeHTML(friend.nickname)}</h3></div><span>${escapeHTML(mood.code || "VIBE")} · ${escapeHTML(mood.label)}</span></div>
          <p class="friend-frame-message">“${escapeHTML(friend.message || "같이 움직여요!")}”</p>
          <dl><div><dt>CODE</dt><dd>${escapeHTML(friend.friend_code)}</dd></div><div><dt>HOME</dt><dd>${escapeHTML(friend.region)}</dd></div><div><dt>SPORT</dt><dd>${escapeHTML(sports.join(" · "))}</dd></div><div><dt>NOW</dt><dd>${escapeHTML(friend.status)}</dd></div></dl>
          <div class="friend-frame-bottom"><span>${friend.calories ? `누적 ${Number(friend.calories)} kcal` : "오늘 운동 기록 전"}</span><b>${alreadyFriend ? "MY CREW" : "READY TO ADD"}</b></div>
        </div>
      </div>`;
    addButton.disabled = alreadyFriend;
    addButton.querySelector("span").textContent = alreadyFriend ? "이미 친구" : "ADD CREW";
    feedback.innerHTML = alreadyFriend
      ? `<b>${escapeHTML(friend.nickname)}</b>님은 이미 운동 친구예요.`
      : `<b>${escapeHTML(friend.nickname)}</b>님의 프로필을 찾았어요. 추가하려면 ADD CREW를 눌러주세요.`;
  };

  const requestJSON = async (url, options = {}) => {
    const response = await fetch(url, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(payload.error || "요청을 처리하지 못했어요."), { status: response.status, payload });
    return payload;
  };

  const loadPageData = async () => {
    try {
      const [friendPayload, notePayload, requestPayload] = await Promise.all([requestJSON("/api/friends/"), requestJSON("/api/friend-notes/"), requestJSON("/api/friend-requests/")]);
      renderFriends(friendPayload.friends);
      renderGuestbook(notePayload.notes);
      renderFriendRequests(requestPayload.requests);
    } catch (error) {
      renderFriends(app.getFriends());
      renderGuestbook(app.getTalks());
      feedback.textContent = "친구 데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.";
      console.error("friend page API error", error);
    }
  };

  const lookup = async () => {
    const code = codeInput.value.trim();
    if (!code) {
      feedback.textContent = "친구 코드 또는 아이디를 입력해주세요.";
      renderLookupEmpty("친구 코드 또는 아이디를 입력한 뒤 조회 버튼을 눌러주세요.");
      return null;
    }
    lookupButton.disabled = true;
    try {
      const payload = await requestJSON(`/api/friends/lookup/?code=${encodeURIComponent(code)}`);
      renderLookupProfile(payload.friend);
      return payload.friend;
    } catch (error) {
      feedback.textContent = error.message;
      renderLookupEmpty(error.status === 404 ? "등록되지 않은 친구 코드 또는 아이디예요. 다시 확인해주세요." : error.message);
      return null;
    } finally {
      lookupButton.disabled = false;
    }
  };

  $("#guestbookForm").addEventListener("submit", async event => {
    event.preventDefault();
    const input = $("#guestbookInput");
    const text = input.value.trim();
    if (!text) return;
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    try {
      await requestJSON("/api/friend-notes/create/", { method: "POST", headers: { "X-CSRFToken": csrfToken }, body: JSON.stringify({ text }) });
      input.value = "";
      const payload = await requestJSON("/api/friend-notes/");
      renderGuestbook(payload.notes);
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  lookupButton.addEventListener("click", lookup);
  codeInput.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); lookup(); } });
  codeInput.addEventListener("input", () => { selectedFriend = null; addButton.disabled = true; addButton.querySelector("span").textContent = "ADD CREW"; });

  $("#friendRequestsButton").addEventListener("click", async () => {
    await loadFriendRequests();
    requestModal.hidden = false;
  });
  $("#closeFriendRequestModal").addEventListener("click", () => { requestModal.hidden = true; });
  requestModal.addEventListener("click", event => { if (event.target === requestModal) requestModal.hidden = true; });
  requestList.addEventListener("click", async event => {
    const button = event.target.closest("[data-request-action]");
    if (!button) return;
    button.disabled = true;
    try {
      await requestJSON("/api/friend-requests/respond/", { method: "POST", headers: { "X-CSRFToken": csrfToken }, body: JSON.stringify({ request_id: button.dataset.requestId, action: button.dataset.requestAction }) });
      const friendPayload = await requestJSON("/api/friends/");
      renderFriends(friendPayload.friends);
      await loadFriendRequests();
    } catch (error) {
      feedback.textContent = error.message;
      button.disabled = false;
    }
  });

  $("#friendAddForm").addEventListener("submit", async event => {
    event.preventDefault();
    const friend = selectedFriend || await lookup();
    if (!friend) return;
    addButton.disabled = true;
    try {
      const payload = await requestJSON("/api/friends/add/", { method: "POST", headers: { "X-CSRFToken": csrfToken }, body: JSON.stringify({ friend_code: friend.friend_code }) });
      renderLookupProfile(friend);
      addButton.disabled = true;
      feedback.innerHTML = `<b>${escapeHTML(friend.nickname)}</b>님에게 친구 요청을 보냈어요. 상대가 승인하면 친구 목록에 보여요.`;
    } catch (error) {
      feedback.textContent = error.message;
      if (error.payload?.friends) renderFriends(error.payload.friends);
      renderLookupProfile(friend);
    }
  });

  renderLookupEmpty();
  loadPageData();
})();
