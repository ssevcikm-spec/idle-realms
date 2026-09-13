(function () {
  const G = window.Game;

  G.LEGENDARIES = {
    treant_heart: {
      id:'treant_heart', name:'Srdce prastarého enta', icon:'💚', slot:'armor', tier:4,
      durability:600, setId:'hunters_kit', combatBonus:8, defBonus:12,
      mods:{ herbalism:0.30, woodcutting:0.20 }, staminaDrain:0.85,
      unique:'Regenerace 5 HP/kolo v boji',
      effect:{ regenInCombat:5 }
    },
    wolf_fang: {
      id:'wolf_fang', name:'Ocelový tesák Alfa', icon:'🗡️', slot:'weapon', tier:4,
      durability:500, setId:'warrior_plate', combatBonus:28,
      mods:{}, unique:'+20 % poškození proti zvířatům',
      effect:{ damageVsBeast:1.20 }
    },
    warlord_banner: {
      id:'warlord_banner', name:'Korouhev válečného náčelníka', icon:'🏴', slot:'tool', tier:4,
      durability:600, combatBonus:6, mods:{}, unique:'+15 % boj celé družině',
      effect:{ partyAtkBonus:1.15 }
    },
    colossus_core: {
      id:'colossus_core', name:'Jádro kolosu', icon:'🗿', slot:'armor', tier:4,
      durability:900, setId:'warrior_plate', combatBonus:12, defBonus:24, staminaDrain:1.05,
      mods:{ mining:0.35 }, unique:'Imunitní vůči omráčení',
      effect:{ stunImmune:true }
    },
    witch_charm: {
      id:'witch_charm', name:'Talisman bahenní čarodějky', icon:'🧙', slot:'tool', tier:4,
      durability:450, combatBonus:6, mods:{ alchemy:0.40, herbalism:0.30 },
      unique:'Lektvary léčí +50 %',
      effect:{ potionStrength:50 }
    },
    leviathan_scale: {
      id:'leviathan_scale', name:'Šupina Leviatana', icon:'🐋', slot:'armor', tier:4,
      durability:1000, combatBonus:10, defBonus:20, setId:'scholars_insight',
      mods:{ hunting:0.20, scouting:0.30 }, unique:'+25 % XP',
      effect:{ xpBonus:25 }
    }
  };

  G.rollLegendaryDrop = function (bossTemplateId, bonus) {
    bonus = bonus || 0;
    const baseChance = 0.05;
    const chance = Math.min(0.5, baseChance * (1 + bonus));
    if (!G.chance(chance)) return null;
    const pool = Object.values(G.LEGENDARIES);
    return G.pick(pool);
  };
})();
