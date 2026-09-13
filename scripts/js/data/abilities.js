(function () {
  const G = window.Game;

  /**
   * Bojové schopnosti. Každá dovednost odemyká 3 aktivní schopnosti:
   *   - L3:  základní
   *   - L8:  pokročilá
   *   - L15: mistrovská
   */
  G.ABILITIES = {

    /* --- Dřevorubectví --- */
    splitting_axe: { id:'splitting_axe', name:'Štípavá sekera', icon:'🪓', skill:'woodcutting', minLevel:3,
      cooldown:3, stamina:12, desc:'Těžký úder sekery za 150 % útoku',
      effect:{ type:'damage', mult:1.5 } },
    whirlwind_axe: { id:'whirlwind_axe', name:'Vířivá sekera', icon:'🌀', skill:'woodcutting', minLevel:8,
      cooldown:4, stamina:20, desc:'Roztočí sekeru — 90 % útoku na všechny nepřátele',
      effect:{ type:'aoe', mult:0.9 } },
    timber_fall:   { id:'timber_fall', name:'Pád stromu', icon:'🌲', skill:'woodcutting', minLevel:15,
      cooldown:6, stamina:28, desc:'Zničující úder za 250 % útoku + omráčení 1 kolo',
      effect:{ type:'damage', mult:2.5, stun:1 } },

    /* --- Hornictví --- */
    crushing_blow: { id:'crushing_blow', name:'Drtivý úder', icon:'🔨', skill:'mining', minLevel:3,
      cooldown:3, stamina:15, desc:'+80 % poškození, ale −30 % obrana na 1 kolo',
      effect:{ type:'damage', mult:1.8, selfDebuff:{ def:0.70, duration:1 } } },
    stone_skin:    { id:'stone_skin', name:'Kamenná kůže', icon:'🗿', skill:'mining', minLevel:8,
      cooldown:5, stamina:14, desc:'+100 % obrana sobě na 3 kola',
      effect:{ type:'buff', target:'self', stat:'def', mult:2.0, duration:3 } },
    seismic_slam:  { id:'seismic_slam', name:'Seizmický úder', icon:'🌋', skill:'mining', minLevel:15,
      cooldown:6, stamina:30, desc:'Otřes — 130 % útoku na všechny + omráčení 1 kolo',
      effect:{ type:'aoe', mult:1.3, stun:1 } },

    /* --- Bylinkářství --- */
    poison_strike: { id:'poison_strike', name:'Jedovatý útok', icon:'☠️', skill:'herbalism', minLevel:3,
      cooldown:4, stamina:12, desc:'Jed na 3 kola (8 dmg/kolo)',
      effect:{ type:'poison', damage:8, duration:3 } },
    healing_herbs: { id:'healing_herbs', name:'Hojivé byliny', icon:'🌿', skill:'herbalism', minLevel:8,
      cooldown:4, stamina:14, desc:'Vyléčí nejzraněnějšího spojence o 55 HP',
      effect:{ type:'heal', amount:55, target:'lowest-ally' } },
    toxic_cloud:   { id:'toxic_cloud', name:'Jedovatý oblak', icon:'☁️', skill:'herbalism', minLevel:15,
      cooldown:6, stamina:26, desc:'Jed na VŠECHNY nepřátele (10 dmg × 4 kola)',
      effect:{ type:'poison', damage:10, duration:4, aoe:true } },

    /* --- Lov --- */
    precise_shot:  { id:'precise_shot', name:'Přesná rána', icon:'🎯', skill:'hunting', minLevel:3,
      cooldown:3, stamina:14, desc:'Ignoruje obranu, zaručený krit',
      effect:{ type:'damage', mult:1.4, ignoreDef:true, alwaysCrit:true } },
    volley:        { id:'volley', name:'Salva', icon:'🏹', skill:'hunting', minLevel:8,
      cooldown:4, stamina:20, desc:'Tři rychlé výstřely (70 % útoku každý)',
      effect:{ type:'damage', mult:0.7, hits:3 } },
    marked_prey:   { id:'marked_prey', name:'Označená kořist', icon:'🔴', skill:'hunting', minLevel:15,
      cooldown:5, stamina:22, desc:'Označí cíl — dostává +50 % poškození na 3 kola',
      effect:{ type:'mark', mult:1.5, duration:3 } },

    /* --- Boj --- */
    double_strike: { id:'double_strike', name:'Dvojitý úder', icon:'⚔️', skill:'combat', minLevel:3,
      cooldown:3, stamina:16, desc:'Dva útoky v jednom kole (90 % každý)',
      effect:{ type:'damage', mult:0.9, hits:2 } },
    shield_bash:   { id:'shield_bash', name:'Úder štítem', icon:'🛡️', skill:'combat', minLevel:8,
      cooldown:5, stamina:18, desc:'Úder za 100 % útoku + omráčení 1 kolo',
      effect:{ type:'damage', mult:1.0, stun:1 } },
    berserker_rage:{ id:'berserker_rage', name:'Berserkerský vztek', icon:'💢', skill:'combat', minLevel:15,
      cooldown:7, stamina:32, desc:'+80 % útok, ale −30 % obrana na 3 kola',
      effect:{ type:'buff', target:'self', stat:'atk', mult:1.8, duration:3, selfDebuff:{ def:0.70, duration:3 } } },

    /* --- Kovářství --- */
    iron_guard:    { id:'iron_guard', name:'Železná stráž', icon:'🛡️', skill:'smithing', minLevel:3,
      cooldown:4, stamina:10, desc:'+80 % obrana sobě na 2 kola',
      effect:{ type:'buff', target:'self', stat:'def', mult:1.80, duration:2 } },
    sharpened_blade:{ id:'sharpened_blade', name:'Naostřená čepel', icon:'🗡️', skill:'smithing', minLevel:8,
      cooldown:5, stamina:18, desc:'Naostří zbraně — celá družina +30 % útok na 3 kola',
      effect:{ type:'buff', target:'party', stat:'atk', mult:1.30, duration:3 } },
    forged_armor:  { id:'forged_armor', name:'Zbroj z výhně', icon:'⚙️', skill:'smithing', minLevel:15,
      cooldown:6, stamina:24, desc:'Zpevní zbroje — celá družina +50 % obrana na 3 kola',
      effect:{ type:'buff', target:'party', stat:'def', mult:1.50, duration:3 } },

    /* --- Alchymie --- */
    explosive_mix: { id:'explosive_mix', name:'Výbušná směs', icon:'💥', skill:'alchemy', minLevel:3,
      cooldown:5, stamina:20, desc:'Poškodí VŠECHNY nepřátele za 70 % útoku',
      effect:{ type:'aoe', mult:0.70 } },
    acid_flask:    { id:'acid_flask', name:'Kyselinová baňka', icon:'🧪', skill:'alchemy', minLevel:8,
      cooldown:4, stamina:18, desc:'150 % útoku + sníží obranu cíle o 40 % na 3 kola',
      effect:{ type:'damage', mult:1.5, debuff:{ stat:'def', mult:0.60, duration:3 } } },
    philosopher_stone:{ id:'philosopher_stone', name:'Kámen mudrců', icon:'💎', skill:'alchemy', minLevel:15,
      cooldown:7, stamina:30, desc:'Vyléčí družinu o 30 % max HP a odstraní všechny debuffy',
      effect:{ type:'cleanse', healPct:0.30 } },

    /* --- Kuchařství --- */
    hearty_meal:   { id:'hearty_meal', name:'Posilující jídlo', icon:'🍲', skill:'cooking', minLevel:3,
      cooldown:4, stamina:8, desc:'Vyléčí nejzraněnějšího spojence o 40 HP',
      effect:{ type:'heal', amount:40, target:'lowest-ally' } },
    feast:         { id:'feast', name:'Hostina', icon:'🍖', skill:'cooking', minLevel:8,
      cooldown:5, stamina:16, desc:'Vyléčí celou družinu o 25 HP',
      effect:{ type:'heal', amount:25, target:'all-allies' } },
    hero_banquet:  { id:'hero_banquet', name:'Hrdinská hostina', icon:'🍗', skill:'cooking', minLevel:15,
      cooldown:6, stamina:22, desc:'Celá družina +40 % útok na 3 kola',
      effect:{ type:'buff', target:'party', stat:'atk', mult:1.40, duration:3 } },

    /* --- Řemeslo --- */
    improvised_weapon:{ id:'improvised_weapon', name:'Improvizovaná zbraň', icon:'🪵', skill:'crafting', minLevel:3,
      cooldown:3, stamina:12, desc:'Střední poškození + zpomalení nepřítele',
      effect:{ type:'damage', mult:1.2, debuff:{ stat:'speed', mult:0.7, duration:2 } } },
    caltrops:      { id:'caltrops', name:'Ostroje', icon:'📌', skill:'crafting', minLevel:8,
      cooldown:5, stamina:16, desc:'Rozsype ostroje — VŠEM nepřátelům 50 % útoku + zpomalení',
      effect:{ type:'aoe', mult:0.5, debuff:{ stat:'speed', mult:0.6, duration:2 } } },
    master_work:   { id:'master_work', name:'Mistrovské dílo', icon:'✨', skill:'crafting', minLevel:15,
      cooldown:6, stamina:20, desc:'Připraví dokonalý úder — +100 % útok sobě na 2 kola',
      effect:{ type:'buff', target:'self', stat:'atk', mult:2.0, duration:2 } },

    /* --- Průzkum --- */
    expose_weakness:{ id:'expose_weakness', name:'Odhalit slabinu', icon:'🔍', skill:'scouting', minLevel:3,
      cooldown:5, stamina:12, desc:'Celá skupina +25 % útok na 2 kola',
      effect:{ type:'buff', target:'party', stat:'atk', mult:1.25, duration:2 } },
    ambush:        { id:'ambush', name:'Přepadení', icon:'🌫️', skill:'scouting', minLevel:8,
      cooldown:4, stamina:20, desc:'Přepad ze zálohy — 180 % útoku, zaručený krit',
      effect:{ type:'damage', mult:1.8, alwaysCrit:true } },
    tactical_retreat:{ id:'tactical_retreat', name:'Taktický ústup', icon:'🏃', skill:'scouting', minLevel:15,
      cooldown:7, stamina:22, desc:'Přeskupení — odstraní všechny debuffy a vyléčí 20 HP celé družině',
      effect:{ type:'cleanse', heal:20 } },

    /* --- Obchod --- */
    intimidation:  { id:'intimidation', name:'Zastrašení', icon:'😠', skill:'trading', minLevel:3,
      cooldown:4, stamina:10, desc:'Nepřítel −25 % útok na 3 kola',
      effect:{ type:'debuff', target:'enemy', stat:'atk', mult:0.75, duration:3 } },
    bribe:         { id:'bribe', name:'Podplacení', icon:'💰', skill:'trading', minLevel:8,
      cooldown:5, stamina:14, desc:'VŠICHNI nepřátelé −40 % útok na 2 kola',
      effect:{ type:'debuff', target:'all-enemies', stat:'atk', mult:0.60, duration:2 } },
    silver_tongue: { id:'silver_tongue', name:'Stříbrný jazyk', icon:'🗣️', skill:'trading', minLevel:15,
      cooldown:7, stamina:24, desc:'VŠEM nepřátelům −30 % obrana na 4 kola',
      effect:{ type:'debuff', target:'all-enemies', stat:'def', mult:0.70, duration:4 } }
  };

  G.abilitiesFor = function (unit) {
    const out = [];
    for (const aid in G.ABILITIES) {
      const a = G.ABILITIES[aid];
      if (G.unitSkill(unit, a.skill) >= a.minLevel) out.push(a);
    }
    return out;
  };

  G.abilitiesForCombat = function (unit, maxCount) {
    const all = G.abilitiesFor(unit);
    all.sort((a, b) => {
      const lvA = G.unitSkill(unit, a.skill);
      const lvB = G.unitSkill(unit, b.skill);
      if (lvB !== lvA) return lvB - lvA;
      return b.minLevel - a.minLevel;
    });
    return all.slice(0, maxCount || 8);
  };

  G.abilityById = function (id) { return G.ABILITIES[id] || null; };

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

    for (const id of available) {
      const a = G.ABILITIES[id];
      if (a.effect.type === 'cleanse') {
        let debuffCount = 0;
        for (const al of combat.ally) {
          if (al.debuffs && Object.keys(al.debuffs).length) debuffCount++;
        }
        if (debuffCount >= 2) return id;
      }
    }
    for (const id of available) {
      const a = G.ABILITIES[id];
      if (a.effect.type === 'heal') {
        const lowest = combat.ally.reduce((w, x) => (x.hp / x.hpMax < w.hp / w.hpMax) ? x : w);
        if (lowest.hp / lowest.hpMax < 0.55) return id;
      }
    }
    const aliveEnemies = combat.enemy.filter(e => e.alive).length;
    if (aliveEnemies >= 2) {
      for (const id of available) {
        const a = G.ABILITIES[id];
        if (a.effect.type === 'aoe') return id;
      }
      for (const id of available) {
        const a = G.ABILITIES[id];
        if (a.effect.type === 'poison' && a.effect.aoe) return id;
      }
      for (const id of available) {
        const a = G.ABILITIES[id];
        if (a.effect.type === 'debuff' && a.effect.target === 'all-enemies') return id;
      }
    }
    if (combat.round === 1) {
      for (const id of available) {
        const a = G.ABILITIES[id];
        if (a.effect.type === 'buff' && a.effect.target === 'party') return id;
      }
    }
    for (const id of available) {
      const a = G.ABILITIES[id];
      if (a.effect.type === 'mark') {
        const boss = combat.enemy.find(e => e.alive && e.isBoss);
        if (boss) return id;
      }
    }
    let bestDamage = null, bestMult = 0;
    for (const id of available) {
      const a = G.ABILITIES[id];
      if (a.effect.type === 'damage') {
        const totalMult = (a.effect.mult || 1) * (a.effect.hits || 1);
        if (totalMult > bestMult) { bestMult = totalMult; bestDamage = id; }
      }
    }
    if (bestDamage) return bestDamage;
    return available[0];
  };
})();
