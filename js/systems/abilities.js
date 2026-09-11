(function () {
  const G = window.Game;

  /**
   * Použije schopnost v souboji.
   * Vrací { ok, log } — co se stalo.
   */
  G.useAbility = function (combat, ally, abilityId) {
    const a = G.ABILITIES[abilityId];
    if (!a) return { ok:false, reason:'Neznámá schopnost.' };
    if (!ally.alive) return { ok:false, reason:'Mrtvý.' };
    if ((ally.cooldowns && ally.cooldowns[abilityId]) > 0) return { ok:false, reason:'Na cooldownu.' };
    if ((ally.stamina || 0) < a.stamina) return { ok:false, reason:'Nedostatek výdrže.' };

    const unit = G.getUnit(ally.unitId);
    const name = unit ? unit.name.split(' ')[0] : '?';
    const eff = a.effect;
    const log = [];

    ally.stamina = Math.max(0, (ally.stamina || 0) - a.stamina);
    ally.cooldowns = ally.cooldowns || {};
    ally.cooldowns[abilityId] = a.cooldown;

    if (eff.type === 'damage') {
      const target = pickEnemy(combat);
      if (!target) return { ok:false };
      const hits = eff.hits || 1;
      let total = 0;
      for (let i = 0; i < hits; i++) {
        if (!target.alive) break;
        const dmg = computeAbilityDamage(ally, target, eff);
        target.hp = Math.max(0, target.hp - dmg);
        total += dmg;
        if (target.hp <= 0) target.alive = false;
      }
      log.push(`${name} použil ${a.icon} ${a.name} na ${target.name}: ${total} dmg`);
      if (eff.selfDebuff) {
        ally.buffs = ally.buffs || {};
        ally.buffs.def = { mult: eff.selfDebuff.def, until: combat.round + eff.selfDebuff.duration };
      }
      if (eff.debuff && target.alive) {
        target.debuffs = target.debuffs || {};
        target.debuffs[eff.debuff.stat] = { mult: eff.debuff.mult, until: combat.round + eff.debuff.duration };
      }
    }
    else if (eff.type === 'aoe') {
      const alive = combat.enemy.filter(e => e.alive);
      let total = 0;
      for (const e of alive) {
        const dmg = computeAbilityDamage(ally, e, eff);
        e.hp = Math.max(0, e.hp - dmg);
        total += dmg;
        if (e.hp <= 0) e.alive = false;
      }
      log.push(`${name} použil ${a.icon} ${a.name}: ${total} dmg na ${alive.length} nepřátel`);
    }
    else if (eff.type === 'poison') {
      const target = pickEnemy(combat);
      if (!target) return { ok:false };
      target.poisons = target.poisons || [];
      target.poisons.push({ damage: eff.damage, roundsLeft: eff.duration, source: name });
      log.push(`${name} otrávil ${target.name} (${eff.damage} dmg × ${eff.duration} kol)`);
    }
    else if (eff.type === 'heal') {
      let target;
      if (eff.target === 'lowest-ally') {
        target = combat.ally.filter(x => x.alive).reduce((w, x) =>
          (x.hp / x.hpMax) < (w.hp / w.hpMax) ? x : w);
      } else {
        target = ally;
      }
      if (!target) return { ok:false };
      const before = target.hp;
      target.hp = Math.min(target.hpMax, target.hp + eff.amount);
      const healed = target.hp - before;
      const tn = G.getUnit(target.unitId);
      log.push(`${name} použil ${a.icon} ${a.name}: +${healed} HP pro ${tn ? tn.name.split(' ')[0] : '?'}`);
    }
    else if (eff.type === 'buff') {
      if (eff.target === 'self') {
        ally.buffs = ally.buffs || {};
        ally.buffs[eff.stat] = { mult: eff.mult, until: combat.round + eff.duration };
        log.push(`${name} použil ${a.icon} ${a.name} (${eff.stat} ×${eff.mult})`);
      } else if (eff.target === 'party') {
        for (const al of combat.ally) {
          if (!al.alive) continue;
          al.buffs = al.buffs || {};
          al.buffs[eff.stat] = { mult: eff.mult, until: combat.round + eff.duration };
        }
        log.push(`${name} použil ${a.icon} ${a.name} (celá skupina +${Math.round((eff.mult-1)*100)} %)`);
      }
    }
    else if (eff.type === 'debuff') {
      const target = pickEnemy(combat);
      if (!target) return { ok:false };
      target.debuffs = target.debuffs || {};
      target.debuffs[eff.stat] = { mult: eff.mult, until: combat.round + eff.duration };
      log.push(`${name} použil ${a.icon} ${a.name} na ${target.name} (${eff.stat} ×${eff.mult})`);
    }

    return { ok:true, log };
  };

  function pickEnemy(combat) {
    const alive = combat.enemy.filter(e => e.alive);
    if (!alive.length) return null;
    return alive[G.randInt(0, alive.length - 1)];
  }

  function computeAbilityDamage(ally, target, eff) {
    let atk = ally.atk || 10;
    if (ally.buffs && ally.buffs.atk && ally.buffs.atk.until >= (G.state.combat.active ? G.state.combat.active.round : 0)) {
      atk *= ally.buffs.atk.mult;
    }
    let base = atk * (0.9 + G.rand() * 0.4) * (eff.mult || 1);
    if (!eff.ignoreDef) base -= (target.def || 0) * 0.4;
    if (eff.alwaysCrit) base *= 1.8;
    return Math.max(1, Math.round(base));
  }

  /** Sníží cooldowny a vyprší buffy/debuffy na začátku kola. */
  G.tickAbilityTimers = function (combat) {
    for (const a of combat.ally) {
      if (!a.cooldowns) a.cooldowns = {};
      for (const id in a.cooldowns) {
        if (a.cooldowns[id] > 0) a.cooldowns[id]--;
      }
      a.stamina = Math.min(100, (a.stamina || 0) + 5);
      if (a.buffs) {
        for (const k in a.buffs) if (a.buffs[k].until < combat.round) delete a.buffs[k];
      }
      if (a.debuffs) {
        for (const k in a.debuffs) if (a.debuffs[k].until < combat.round) delete a.debuffs[k];
      }
    }
    for (const e of combat.enemy) {
      if (e.debuffs) {
        for (const k in e.debuffs) if (e.debuffs[k].until < combat.round) delete e.debuffs[k];
      }
    }
  };

  /** Aplikuje poison damage na konci kola. */
  G.tickPoisons = function (combat) {
    const log = [];
    for (const e of combat.enemy) {
      if (!e.poisons || !e.poisons.length || !e.alive) continue;
      let total = 0;
      e.poisons = e.poisons.filter(p => {
        total += p.damage;
        p.roundsLeft--;
        return p.roundsLeft > 0;
      });
      e.hp = Math.max(0, e.hp - total);
      if (e.hp <= 0) e.alive = false;
      log.push(`☠️ Jed působí na ${e.name}: ${total} dmg`);
    }
    return log;
  };
})();
