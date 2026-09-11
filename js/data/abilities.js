(function () {
  const G = window.Game;

  /**
   * Bojové schopnosti. Každá dovednost odemyká jednu aktivní schopnost
   * na úrovni 3 (nebo výš). V souboji ji lze spustit ručně,
   * nebo nechat auto-mód používat automaticky.
   *
   * effect:
   *   type: 'damage' | 'heal' | 'aoe' | 'buff' | 'debuff' | 'poison'
   *   mult: násobič útoku (pro damage/aoe)
   *   amount: konkrétní hodnota (pro heal/buff)
   *   duration: trvání v kolech (buff/debuff/poison)
   *   target: 'self' | 'ally' | 'enemy' | 'all-enemies'
   *   selfDebuff: { def: 0.7, duration: 1 } — vedlejší účinek
   *   partyBuff: { atk: 1.2, duration: 1 }
   */
  G.ABILITIES = {
    /* ---------- Dřevorubectví ---------- */
    splitting_axe: {
      id: 'splitting_axe', name: 'Štípavá sekera', icon: '🪓',
      skill: 'woodcutting', minLevel: 3,
      cooldown: 3, stamina: 12,
      desc: 'Těžký úder sekery za 150 % útoku',
      effect: { type: 'damage', mult: 1.5 }
    },
    /* ---------- Hornictví ---------- */
    crushing_blow: {
      id: 'crushing_blow', name: 'Drtivý úder', icon: '🔨',
      skill: 'mining', minLevel: 3,
      cooldown: 3, stamina: 15,
      desc: '+80 % poškození, ale −30 % obrana na 1 kolo',
      effect: { type: 'damage', mult: 1.8, selfDebuff: { def: 0.70, duration: 1 } }
    },
    /* ---------- Bylinkářství ---------- */
    poison_strike: {
      id: 'poison_strike', name: 'Jedovatý útok', icon: '☠️',
      skill: 'herbalism', minLevel: 3,
      cooldown: 4, stamina: 12,
      desc: 'Jed na 3 kola (poškození každé kolo)',
      effect: { type: 'poison', damage: 8, duration: 3, target: 'enemy' }
    },
    /* ---------- Lov ---------- */
    precise_shot: {
      id: 'precise_shot', name: 'Přesná rána', icon: '🎯',
      skill: 'hunting', minLevel: 3,
      cooldown: 3, stamina: 14,
      desc: 'Ignoruje obranu, zaručený krit',
      effect: { type: 'damage', mult: 1.4, ignoreDef: true, alwaysCrit: true }
    },
    /* ---------- Boj ---------- */
    double_strike: {
      id: 'double_strike', name: 'Dvojitý úder', icon: '⚔️',
      skill: 'combat', minLevel: 3,
      cooldown: 3, stamina: 16,
      desc: 'Dva útoky v jednom kole',
      effect: { type: 'damage', mult: 0.9, hits: 2 }
    },
    /* ---------- Kovářství ---------- */
    iron_guard: {
      id: 'iron_guard', name: 'Železná stráž', icon: '🛡️',
      skill: 'smithing', minLevel: 3,
      cooldown: 4, stamina: 10,
      desc: '+80 % obrana sobě na 2 kola',
      effect: { type: 'buff', target: 'self', stat: 'def', mult: 1.80, duration: 2 }
    },
    /* ---------- Alchymie ---------- */
    explosive_mix: {
      id: 'explosive_mix', name: 'Výbušná směs', icon: '💥',
      skill: 'alchemy', minLevel: 3,
      cooldown: 5, stamina: 20,
      desc: 'Poškodí VŠECHNY nepřátele za 70 % útoku',
      effect: { type: 'aoe', mult: 0.70 }
    },
    /* ---------- Kuchařství ---------- */
    hearty_meal: {
      id: 'hearty_meal', name: 'Posilující jídlo', icon: '🍲',
      skill: 'cooking', minLevel: 3,
      cooldown: 4, stamina: 8,
      desc: 'Vyléčí nejzraněnějšího spojence o 40 HP',
      effect: { type: 'heal', amount: 40, target: 'lowest-ally' }
    },
    /* ---------- Průzkum ---------- */
    expose_weakness: {
      id: 'expose_weakness', name: 'Odhalit slabinu', icon: '🔍',
      skill: 'scouting', minLevel: 3,
      cooldown: 5, stamina: 12,
      desc: 'Celá skupina +25 % útok na 2 kola',
      effect: { type: 'buff', target: 'party', stat: 'atk', mult: 1.25, duration: 2 }
    },
    /* ---------- Řemeslo ---------- */
    improvised_weapon: {
      id: 'improvised_weapon', name: 'Improvizovaná zbraň', icon: '🪵',
      skill: 'crafting', minLevel: 3,
      cooldown: 3, stamina: 12,
      desc: 'Střední poškození + zpomalení nepřítele',
      effect: { type: 'damage', mult: 1.2, debuff: { stat: 'speed', mult: 0.7, duration: 2 } }
    },
    /* ---------- Obchod ---------- */
    intimidation: {
      id: 'intimidation', name: 'Zastrašení', icon: '😠',
      skill: 'trading', minLevel: 3,
      cooldown: 4, stamina: 10,
      desc: 'Nepřítel −25 % útok na 3 kola',
      effect: { type: 'debuff', target: 'enemy', stat: 'atk', mult: 0.75, duration: 3 }
    }
  };

  /** Vrátí seznam schopností, které postava má (podle dovedností). */
  G.abilitiesFor = function (unit) {
    const out = [];
    for (const aid in G.ABILITIES) {
      const a = G.ABILITIES[aid];
      if (G.unitSkill(unit, a.skill) >= a.minLevel) out.push(a);
    }
    return out;
  };

  G.abilityById = function (id) { return G.ABILITIES[id] || null; };

  /** Auto-mód: preferované schopnosti podle situace. */
  G.autoChooseAbility = function (unit, ally, combat) {
    const ids = ally.abilities || [];
    const available = ids.filter(id => {
      const a = G.ABILITIES[id];
      if (!a) return false;
      if ((ally.cooldowns && ally.cooldowns[id]) > 0) return false;
      if ((ally.stamina || 0) < a.stamina) return false;
      return true;
    });
    if (!available.length) return null;
    // priorita: heal při nízkém HP, AoE při více nepřátelích, jinak damage
    for (const id of available) {
      const a = G.ABILITIES[id];
      if (a.effect.type === 'heal') {
        const lowest = combat.ally.reduce((w, x) => x.hp < w.hp ? x : w);
        if (lowest.hp / lowest.hpMax < 0.5) return id;
      }
    }
    for (const id of available) {
      const a = G.ABILITIES[id];
      if (a.effect.type === 'aoe') {
        const alive = combat.enemy.filter(e => e.alive).length;
        if (alive >= 2) return id;
      }
    }
    return available[0];
  };
})();
