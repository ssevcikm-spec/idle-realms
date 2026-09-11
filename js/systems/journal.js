(function () {
  const G = window.Game;

  G.JOURNAL_MAX = 50;

  /** Zapiš událost do deníku postavy. */
  G.addJournal = function (unit, msg, icon) {
    if (!unit || unit.dead === undefined) return;
    if (!unit.journal) unit.journal = [];
    unit.journal.push({
      t: G.state.time,
      year: G.state.year || 1,
      season: G.state.season || 'spring',
      day: (G.state.day || 0) + 1,
      icon: icon || '📌',
      msg: msg
    });
    if (unit.journal.length > G.JOURNAL_MAX) {
      unit.journal.splice(0, unit.journal.length - G.JOURNAL_MAX);
    }
  };

  /** Vrátí deník setříděný od nejnovějšího. */
  G.getJournal = function (unit) {
    if (!unit || !unit.journal) return [];
    return unit.journal.slice().reverse();
  };

  /** Popis období (pro UI). */
  G.journalDate = function (entry) {
    const season = G.SEASONS[entry.season] || { name: '?', icon: '?' };
    return `${season.icon} ${entry.year}. rok, den ${entry.day}`;
  };

  /** Krátká historie ve formátu "3. rok, podzim" (pro compact display). */
  G.journalDateShort = function (entry) {
    const season = G.SEASONS[entry.season] || { icon: '?' };
    return `${entry.year}. r. ${season.icon}`;
  };
})();
