(() => {
  const app = window.USIMUNKKA;
  const profile = app.getProfile();
  const $ = selector => document.querySelector(selector);
  const escapeHTML = value => String(value ?? "").replace(/[&<>'"]/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[ch]));

  const codeInput = $("#friendCodeInput");
  const lookupButton = $("#friendLookupButton");
  const addButton = $("#friendAddButton");
  const feedback = $("#friendAddFeedback");
  const frame = $("#friendLookupFrame");
  let selectedFriend = null;

  $("#myFriendCode").textContent = document.body?.dataset.memberFriendCode || profile.friend_code;

  const getAvatar = pose => frame?.dataset[`avatar${String(pose || "main").replace(/^./, c => c.toUpperCase())}`]
    || frame?.dataset.avatarMain
    || "";

  const renderFriends = () => {
    const friends = app.getFriends();
    $("#friendCount").textContent = `친구 ${friends.length}명`;
    $("#friendCards").innerHTML = friends.map(friend => `
      <article class="friend-card">
        <div class="friend-card-head">
          <span class="friend-mini-avatar" style="background:${escapeHTML(friend.color || "#e7dfd1")}">${escapeHTML(friend.nickname.slice(0, 1))}</span>
          <div><h3>${escapeHTML(friend.nickname)}</h3><small>${escapeHTML(friend.region)}</small></div>
        </div>
        <p>${escapeHTML(friend.status)}</p>
        <strong>${friend.calories ? `${Number(friend.calories)} kcal 🔥` : "운동 기다리는 중"}</strong>
      </article>
    `).join("");
  };

  const renderGuestbook = () => {
    $("#guestbookList").innerHTML = app.getTalks().slice(0, 5).map(row => `
      <div class="guestbook-row"><b>${escapeHTML(row.author)}</b><span>${escapeHTML(row.text)}</span><time>${escapeHTML(row.time)}</time></div>
    `).join("");
  };

  const renderLookupEmpty = (message = "코드를 조회하면 친구의 프로필이 이 액자 안에 나타나요.") => {
    selectedFriend = null;
    frame.className = "friend-profile-frame is-empty";
    frame.innerHTML = `
      <div class="friend-frame-empty">
        <span aria-hidden="true">⌕</span>
        <strong>친구 프로필 미리보기</strong>
        <p>${escapeHTML(message)}</p>
      </div>`;
    addButton.disabled = true;
    addButton.querySelector("span").textContent = "ADD CREW";
  };

  const renderLookupProfile = friend => {
    selectedFriend = friend;
    const mood = app.MOOD_META[friend.mood] || app.MOOD_META.ready;
    const sports = (friend.preferred_sports || [friend.sport]).map(key => app.SPORT_META[key]?.label || key);
    const alreadyFriend = app.getFriends().some(row => row.friend_code === friend.friend_code || row.nickname === friend.nickname);
    const avatar = getAvatar(friend.pose);

    frame.className = "friend-profile-frame has-profile";
    frame.innerHTML = `
      <div class="friend-frame-mat">
        <div class="friend-frame-photo"><img src="${escapeHTML(avatar)}" alt="${escapeHTML(friend.nickname)} 프로필 캐릭터"></div>
        <div class="friend-frame-copy">
          <div class="friend-frame-heading">
            <div><small>FRIEND PROFILE</small><h3>${escapeHTML(friend.nickname)}</h3></div>
            <span>${escapeHTML(mood.code || "VIBE")} · ${escapeHTML(mood.label)}</span>
          </div>
          <p class="friend-frame-message">“${escapeHTML(friend.message || "같이 움직여요!")}”</p>
          <dl>
            <div><dt>CODE</dt><dd>${escapeHTML(friend.friend_code)}</dd></div>
            <div><dt>HOME</dt><dd>${escapeHTML(friend.region)}</dd></div>
            <div><dt>SPORT</dt><dd>${escapeHTML(sports.join(" · "))}</dd></div>
            <div><dt>NOW</dt><dd>${escapeHTML(friend.status)}</dd></div>
          </dl>
          <div class="friend-frame-bottom"><span>${friend.calories ? `${Number(friend.calories)} kcal 오늘 기록` : "오늘 운동 기록 전"}</span><b>${alreadyFriend ? "MY CREW" : "READY TO ADD"}</b></div>
        </div>
      </div>`;

    addButton.disabled = alreadyFriend;
    addButton.querySelector("span").textContent = alreadyFriend ? "이미 친구" : "ADD CREW";
    feedback.innerHTML = alreadyFriend
      ? `<b>${escapeHTML(friend.nickname)}</b>님은 이미 운동 친구예요.`
      : `<b>${escapeHTML(friend.nickname)}</b>님의 프로필을 찾았어요. 추가하려면 ADD CREW를 눌러주세요.`;
  };

  const lookup = () => {
    const code = codeInput.value.trim().toUpperCase();
    if (!code) {
      feedback.textContent = "조회할 친구 코드를 입력해주세요.";
      renderLookupEmpty("친구 코드를 입력한 뒤 조회 버튼을 눌러주세요.");
      return null;
    }
    const friend = app.lookupFriendByCode(code);
    if (!friend) {
      feedback.textContent = `${code} 코드와 일치하는 프로필을 찾지 못했어요.`;
      renderLookupEmpty("아직 등록되지 않은 코드예요. 코드를 다시 확인해주세요.");
      return null;
    }
    renderLookupProfile(friend);
    return friend;
  };

  renderFriends();
  renderGuestbook();

  $("#guestbookForm").addEventListener("submit", event => {
    event.preventDefault();
    const input = $("#guestbookInput");
    const text = input.value.trim();
    if (!text) return;
    app.addTalk(text, profile.nickname);
    input.value = "";
    renderGuestbook();
  });

  lookupButton.addEventListener("click", lookup);
  codeInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      lookup();
    }
  });
  codeInput.addEventListener("input", () => {
    selectedFriend = null;
    addButton.disabled = true;
    addButton.querySelector("span").textContent = "ADD CREW";
  });

  $("#friendAddForm").addEventListener("submit", event => {
    event.preventDefault();
    const friend = selectedFriend || lookup();
    if (!friend) return;
    const result = app.addFriendByCode(friend.friend_code);
    if (result.ok) {
      feedback.innerHTML = `<b>${escapeHTML(friend.nickname)}</b>님을 운동 친구로 추가했어요.`;
      renderFriends();
      renderLookupProfile(friend);
      return;
    }
    if (result.reason === "exists") {
      feedback.innerHTML = `<b>${escapeHTML(friend.nickname)}</b>님은 이미 운동 친구예요.`;
      renderLookupProfile(friend);
      return;
    }
    feedback.textContent = result.reason === "self" ? "내 친구 코드는 추가할 수 없어요." : "친구를 추가하지 못했어요.";
  });
})();
