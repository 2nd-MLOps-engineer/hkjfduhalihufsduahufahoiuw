(() => {
  const app = window.USIMUNKKA;
  const rows = app.getDiary();
  const $ = s => document.querySelector(s);
  const totalCalories = rows.reduce((sum, row) => sum + Number(row.calories || 0), 0);
  $("#weekWorkoutCount").textContent = rows.length;
  $("#weekCalories").textContent = totalCalories.toLocaleString();
  $("#diaryStreak").textContent = app.getProfile().streak_days;
  $("#diaryList").innerHTML = rows.map(row => `
    <article class="diary-entry">
      <div class="diary-date">${row.date}</div>
      <div class="diary-main"><h3>${app.SPORT_META[row.sport]?.icon || "★"} ${app.SPORT_META[row.sport]?.label || row.sport} · ${row.calories} kcal</h3><p>${row.place} · 사용자가 입력한 운동기기/앱 칼로리 기준</p></div>
      <div class="diary-score"><strong>+${row.score} SCORE</strong><small>+${row.pet_exp} MOVE EXP</small></div>
    </article>
  `).join("");
})();
