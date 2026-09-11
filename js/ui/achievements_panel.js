(function () {
  const G = window.Game;

  G.achievementsSection = function () {
    const prog = G.achievementProgress();
    let html = `<div class="panel-title">Cíle (${prog.done}/${prog.total})</div>`;
    html += `<div class="ach-grid">`;
    for (const a of G.ACHIEVEMENTS) {
      const done = G.isAchieved(a.id);
      html += `<div class="ach-card ${done ? 'done' : ''}">
        <div class="ach-icon">${done ? '🏆' : a.icon}</div>
        <div class="ach-main">
          <div class="ach-name">${G.esc(a.name)}</div>
          <div class="ach-desc">${G.esc(a.desc)}</div>
          <div class="ach-reward">
            ${a.reward.gold ? `+${a.reward.gold} 🪙` : ''}
            ${a.reward.renown ? `+${a.reward.renown} ⭐` : ''}
          </div>
        </div>
      </div>`;
    }
    html += `</div>`;
    return html;
  };

  G.storySection = function () {
    const prog = G.storyProgress();
    if (prog.done === 0 && !G.state.story) return '';
    let html = `<div class="panel-title">Příběh (${prog.done}/${prog.total})</div>`;
    html += `<div class="story-progress">`;
    for (const q of G.STORY_QUESTS) {
      const done = G.state.story && G.state.story.completed && G.state.story.completed.includes(q.id);
      html += `<div class="story-line ${done ? 'done' : ''}">
        <span class="story-dot">${done ? '✓' : '○'}</span>
        <span class="story-title">${G.esc(q.title)}</span>
      </div>`;
    }
    html += `</div>`;
    return html;
  };
})();
