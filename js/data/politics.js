(function () {
  const G = window.Game;

  /**
   * Politika frakcí.
   * Každá frakce má jednou za `electionInterval` herních sekund volby.
   * Během volebního období může hráč:
   *   - podpořit kandidáta (zlato + reputace)
   *   - sám kandidovat (při reputaci >= 100)
   * Vítěz mění ceny, questy a vztahy na další období.
   */

  G.POLITICS = {
    electionInterval: 20 * 300,    // 20 herních dní (6000 s ≈ 100 min při ×1)
    electionPhaseDuration: 900,    // 15 min herního času na podporu
    supportCost: 200,              // základní cena podpory
    candidacyReputation: 100,      // minimální reputace pro vlastní kandidaturu
    candidacyCost: 800             // cena vlastní kandidatury
  };

  /** Jména kandidátů — generují se náhodně pro každou frakci. */
  G.CANDIDATE_NAMES = {
    first: ['Vilém', 'Otakar', 'Bohumil', 'Radoslav', 'Jindřich', 'Kryštof',
            'Zikmund', 'Přemysl', 'Vratislav', 'Ladislav', 'Oldřich', 'Jaromír',
            'Květoslav', 'Miroslav', 'Bohuslav', 'Stanislav', 'Rostislav', 'Vladimír'],
    last: ['z Vysokého', 'Krutý', 'Moudrý', 'z Lipí', 'Bystrý', 'Ostří',
           'z Údolí', 'Kamenný', 'Rychlý', 'Šedý', 'z Brodu', 'Moudrý']
  };

  /** Politické programy — každý kandidát má jeden. */
  G.POLITICAL_PROGRAMS = {
    mercantile: {
      id: 'mercantile', name: 'Kupectví', icon: '⚖️',
      desc: 'Nižší daně, vyšší obchod, více questů na dodávky',
      effects: { priceMods: { all: 0.95 }, questBonus: 2, questKind: 'deliver' }
    },
    militant: {
      id: 'militant', name: 'Válečná strana', icon: '⚔️',
      desc: 'Vyšší daně, ale silnější ochrana a lepší zbraně',
      effects: { priceMods: { iron_ore: 1.15, iron_ingot: 1.20 }, questBonus: 1, questKind: 'combat', safetyBonus: 0.85 }
    },
    isolationist: {
      id: 'isolationist', name: 'Izolacionisté', icon: '🚪',
      desc: 'Uzavřené hranice, vyšší ceny, ale méně nebezpečí',
      effects: { priceMods: { all: 1.10 }, questBonus: 0, safetyBonus: 0.75 }
    },
    populist: {
      id: 'populist', name: 'Lidová strana', icon: '🌾',
      desc: 'Nižší ceny jídla, více jídla, přátelštější k sousedům',
      effects: { priceMods: { bread: 0.75, herb: 0.80, fish: 0.80 }, questBonus: 1, repBonus: 1.20 }
    },
    traditional: {
      id: 'traditional', name: 'Staří moudří', icon: '📜',
      desc: 'Stabilní ceny, více zkušeností, méně konfliktů',
      effects: { priceMods: {}, questBonus: 1, xpBonus: 1.15 }
    }
  };

  /** Vrátí efektivní modifikátory od aktuálního vítěze frakce. */
  G.politicsMods = function (factionId) {
    const st = G.state.politics && G.state.politics.factions
      ? G.state.politics.factions[factionId]
      : null;
    if (!st || !st.winner || !st.winner.program) return null;
    const prog = G.POLITICAL_PROGRAMS[st.winner.program];
    return prog ? prog.effects : null;
  };

  /** Lidsky čitelný souhrn efektů programu (pro UI). */
  G.programEffectsText = function (prog) {
    if (!prog || !prog.effects) return '';
    const e = prog.effects, out = [];
    if (e.priceMods) {
      for (const k in e.priceMods) {
        const diff = Math.round((e.priceMods[k] - 1) * 100);
        const label = k === 'all' ? 'všechny ceny' : (G.MATERIALS[k] ? G.MATERIALS[k].name.toLowerCase() : k);
        out.push(`${label} ${diff > 0 ? '+' : ''}${diff} %`);
      }
    }
    if (e.questBonus) out.push(`+${e.questBonus} zakázky`);
    if (e.xpBonus) out.push(`XP +${Math.round((e.xpBonus - 1) * 100)} %`);
    if (e.safetyBonus) out.push(`nebezpečí ${Math.round((e.safetyBonus - 1) * 100)} %`);
    if (e.repBonus) out.push(`zisk reputace +${Math.round((e.repBonus - 1) * 100)} %`);
    return out.join(' • ');
  };

  /** Cena podpory kandidáta (roste s počtem už podpořených). */
  G.supportPrice = function (factionId) {
    const st = G.state.politics.factions[factionId];
    if (!st) return G.POLITICS.supportCost;
    const already = st.playerSupport || 0;
    return G.POLITICS.supportCost + already * 100;
  };
})();
