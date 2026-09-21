(() => {
  const button = document.querySelector("#recommendBtn");
  const result = document.querySelector("#result");
  if (!button || !result) return;
  const escapeHtml = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  button.addEventListener("click", async () => {
    const mode = document.body.dataset.recommendMode || "home";
    const region = document.querySelector("#manualLocation")?.value.trim() || document.querySelector("#resultRegion")?.textContent.trim();
    const sports = [...document.querySelectorAll("input[name='sport']:checked")].map(input => input.value).join(",");
    const params = new URLSearchParams({mode, region, sports, available_minutes: document.querySelector("#availableMinutes")?.value || "90", max_travel_minutes: document.querySelector("#travelMinutes")?.value || "20", transport: document.querySelector("#transport")?.value || "WALK"});
    result.innerHTML = '<div class="result-placeholder"><strong>실제 API 데이터를<br>불러오는 중입니다.</strong><p>기상·대기질·시설 정보를 조회하고 있어요.</p></div>';
    try {
      const response = await fetch(`/api/live-recommendations/?${params}`, {credentials: "same-origin", headers: {Accept: "application/json"}});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "API 요청 실패");
      const items = data.recommendations || [];
      result.innerHTML = items.length ? items.map((item, index) => `<article class="mock-result-card"><div class="mock-result-body"><div class="mock-result-title-row"><div><span class="mock-result-kicker">LIVE API · ${escapeHtml(item.sport)}</span><h3>${escapeHtml(item.name)}</h3></div><span class="mock-result-badge">LIVE</span></div><strong class="mock-result-place">${escapeHtml(item.facility_type || "운동 시설")}</strong><p class="mock-result-description">${escapeHtml(item.address || data.region)}</p><div class="mock-result-stats"><div><span>지역</span><strong>${escapeHtml(data.region)}</strong></div><div><span>이동</span><strong>${escapeHtml(item.travel_time)}분</strong></div><div><span>운동 가능</span><strong>${escapeHtml(item.available_minutes)}분</strong></div><div><span>출처</span><strong>${escapeHtml(data.facility_source)}</strong></div></div></div></article>`).join("") : `<div class="mock-result-empty"><strong>조회된 시설이 없습니다.</strong><p>${escapeHtml(data.notice || "조건을 바꿔 다시 시도해주세요.")}</p></div>`;
    } catch (error) {
      result.innerHTML = `<div class="mock-result-empty"><strong>실제 API 조회에 실패했습니다.</strong><p>${escapeHtml(error.message)}</p><small>서버 로그와 API 키 설정을 확인해주세요.</small></div>`;
    }
  }, {capture: true});
})();
