(function () {
  const G = window.Game;

  /**
   * Synergie — kombinace dvou dovedností na úrovni 10+ na stejné postavě
   * odemyká unikátní pasivní bonus. Malý, ale znatelný efekt.
   */
  G.SYNERGIES = [
    {
      id:'master_craftsman', name:'Mistr řemeslník', icon:'⚒️',
      skills:['woodcutting','crafting'], minLevel:10,
      desc:'Dřevěné předměty +15 % kvalita, −1 dřevo při výrobě.',
      effect:{ craftQuality:15, craftSave:{ material:'wood', qty:1 } }
    },
    {
      id:'forge_master', name:'Mistr výhně', icon:'🔥',
      skills:['mining','smithing'], minLevel:10,
      desc:'Kovové předměty +15 % kvalita, −1 ruda při výrobě.',
      effect:{ craftQuality:15, craftSave:{ material:'iron_ore', qty:1 } }
    },
    {
      id:'field_medic', name:'Polní ranhojič', icon:'⚕️',
      skills:['herbalism','alchemy'], minLevel:10,
      desc:'+25 % k léčení a léčivým lektvarům.',
      effect:{ healBonus:25, potionStrength:25 }
    },
    {
      id:'battle_hardened', name:'Ostřílený veterán', icon:'⚔️',
      skills:['combat','scouting'], minLevel:10,
      desc:'+15 % rychlost v boji, +10 % bojová síla.',
      effect:{ combatSpeed:15, combatPower:10 }
    },
    {
      id:'gourmet', name:'Gurmán', icon:'🍲',
      skills:['cooking','herbalism'], minLevel:10,
      desc:'Jídlo léčí o 30 % více, +10 % nálada regenerace.',
      effect:{ foodEffect:30 }
    },
    {
      id:'silver_tongue', name:'Stříbrný jazyk', icon:'🗣️',
      skills:['trading','scouting'], minLevel:10,
      desc:'+10 % prodejní cena, obchodník +20 % rychlost.',
      effect:{ sellBonus:10, merchantSpeed:20 }
    },
    {
      id:'jack_of_all', name:'Všeuměl', icon:'🎓',
      skills:['crafting','alchemy'], minLevel:10,
      desc:'+10 % XP pro všechny dovednosti.',
      effect:{ xpBonus:10 }
    }
  ];

  G.activeSynergies = function (unit) {
    if (!unit || unit.dead) return [];
    const out = [];
    for (const syn of G.SYNERGIES) {
      let ok = true;
      for (const sid of syn.skills) {
        if (G.unitSkill(unit, sid) < syn.minLevel) { ok = false; break; }
      }
      if (ok) out.push(syn);
    }
    return out;
  };

  G.synergyBonus = function (unit, key) {
    if (!unit) return 0;
    const syns = G.activeSynergies(unit);
    if (key === 'craftSave') {
      const out = {};
      for (const syn of syns) {
        if (syn.effect.craftSave) {
          const m = syn.effect.craftSave.material;
          out[m] = (out[m] || 0) + syn.effect.craftSave.qty;
        }
      }
      return out;
    }
    let total = 0;
    for (const syn of syns) {
      if (syn.effect[key] != null) total += syn.effect[key];
    }
    return total;
  };
})();
