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
    if (prog.done === 0 && !(G.state.story && G.state.story.completed.length)) return '';
    const on = G.storyPopupsEnabled ? G.storyPopupsEnabled() : true;
    let html = `<div class="panel-title">Příběh (${prog.done}/${prog.total})</div>`;
    html += `<div class="hint" style="text-align:left">Příběh se ptá při milnících. Každá volba se projeví hned (materiály, renomé, reputace) a některé mají <b>trvalý efekt</b>. ${
      on ? 'Popupy vypneš v menu ☰.' : '<b>Popupy máš vypnuté</b> (menu ☰).'}</div>`;
    html += `<div class="story-progress">`;
    for (const q of G.STORY_QUESTS) {
      const done = G.state.story && G.state.story.completed && G.state.story.completed.includes(q.id);
      const idx = G.state.story && G.state.story.choices ? G.state.story.choices[q.id] : null;
      const choice = (idx != null && q.choices[idx]) ? q.choices[idx] : null;
      html += `<div class="story-line ${done ? 'done' : ''}">
        <span class="story-dot">${done ? '✓' : '○'}</span>
        <span class="story-title">${G.esc(q.title)}${choice ? ` — <i>${G.esc(choice.text)}</i>` : ''}</span>
      </div>`;
      if (choice && choice.effects && choice.effects.length) {
        const txt = G.storyEffectText ? G.storyEffectText(choice.effects) : '';
        if (txt) html += `<div class="story-effect">${G.esc(txt)}</div>`;
      }
    }
    html += `</div>`;
    return html;
  };
})();
