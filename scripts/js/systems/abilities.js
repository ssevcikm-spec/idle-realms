(function () {
  const G = window.Game;

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

    const healSynergy = unit ? (1 + G.synergyBonus(unit, 'healBonus') / 100) : 1;
    const foodSynergy = unit ? (1 + G.synergyBonus(unit, 'foodEffect') / 100) : 1;

    switch (eff.type) {
      case 'damage': {
        const target = pickEnemy(combat, eff.target);
        if (!target) return { ok:false };
        const hits = eff.hits || 1;
        let total = 0;
        for (let i = 0; i < hits; i++) {
          if (!target.alive) break;
          const dmg = computeAbilityDamage(ally, target, eff, combat);
          target.hp = Math.max(0, target.hp - dmg);
          total += dmg;
          if (target.hp <= 0) target.alive = false;
        }
        log.push(`${name} použil ${a.icon} ${a.name} na ${target.name}: ${total} dmg${hits > 1 ? ` (${hits}×)` : ''}`);
        if (eff.selfDebuff) {
          ally.buffs = ally.buffs || {};
          ally.buffs.def = { mult: eff.selfDebuff.def, until: combat.round + eff.selfDebuff.duration };
        }
        if (eff.debuff && target.alive) {
          target.debuffs = target.debuffs || {};
          target.debuffs[eff.debuff.stat] = { mult: eff.debuff.mult, until: combat.round + eff.debuff.duration };
        }
        if (eff.stun && target.alive) {
          target.stunned = (target.stunned || 0) + eff.stun;
          log.push(`💫 ${target.name} je omráčen na ${eff.stun} kolo.`);
        }
        break;
      }
      case 'aoe': {
        const alive = combat.enemy.filter(e => e.alive);
        let total = 0;
        for (const e of alive) {
          const dmg = computeAbilityDamage(ally, e, eff, combat);
          e.hp = Math.max(0, e.hp - dmg);
          total += dmg;
          if (e.hp <= 0) e.alive = false;
        }
        log.push(`${name} použil ${a.icon} ${a.name}: ${total} dmg na ${alive.length} nepřátel`);
        if (eff.stun) {
          for (const e of combat.enemy) {
            if (e.alive) e.stunned = (e.stunned || 0) + eff.stun;
          }
          log.push(`💫 Omráčení na ${eff.stun} kolo!`);
        }
        if (eff.debuff) {
          for (const e of combat.enemy) {
            if (!e.alive) continue;
            e.debuffs = e.debuffs || {};
            e.debuffs[eff.debuff.stat] = { mult: eff.debuff.mult, until: combat.round + eff.debuff.duration };
          }
        }
        break;
      }
      case 'poison': {
        const targets = eff.aoe ? combat.enemy.filter(e => e.alive) : [pickEnemy(combat, eff.target)].filter(Boolean);
        for (const t of targets) {
          t.poisons = t.poisons || [];
          t.poisons.push({ damage: eff.damage, roundsLeft: eff.duration, source: name });
        }
        log.push(`${name} otrávil ${targets.length}× cíl (${eff.damage} dmg × ${eff.duration} kol)`);
        break;
      }
      case 'heal': {
        if (eff.target === 'all-allies') {
          const healAmount = Math.round(eff.amount * healSynergy * foodSynergy);
          let totalHeal = 0;
          for (const al of combat.ally) {
            if (!al.alive) continue;
            const before = al.hp;
            al.hp = Math.min(al.hpMax, al.hp + healAmount);
            totalHeal += al.hp - before;
          }
          log.push(`${name} použil ${a.icon} ${a.name}: +${totalHeal} HP celé družině`);
        } else {
          let target;
          if (eff.target === 'lowest-ally') {
            target = combat.ally.filter(x => x.alive).reduce((w, x) =>
              (x.hp / x.hpMax) < (w.hp / w.hpMax) ? x : w);
          } else {
            target = ally;
          }
          if (!target) return { ok:false };
          const healAmount = Math.round((eff.amount || 0) * healSynergy * foodSynergy);
          const before = target.hp;
          target.hp = Math.min(target.hpMax, target.hp + healAmount);
          const healed = target.hp - before;
          const tn = G.getUnit(target.unitId);
          log.push(`${name} použil ${a.icon} ${a.name}: +${healed} HP pro ${tn ? tn.name.split(' ')[0] : '?'}`);
        }
        break;
      }
      case 'buff': {
        if (eff.target === 'self') {
          ally.buffs = ally.buffs || {};
          ally.buffs[eff.stat] = { mult: eff.mult, until: combat.round + eff.duration };
          log.push(`${name} použil ${a.icon} ${a.name} (${eff.stat} ×${eff.mult})`);
          if (eff.selfDebuff) {
            ally.buffs.def = { mult: eff.selfDebuff.def, until: combat.round + eff.selfDebuff.duration };
          }
        } else if (eff.target === 'party') {
          for (const al of combat.ally) {
            if (!al.alive) continue;
            al.buffs = al.buffs || {};
            al.buffs[eff.stat] = { mult: eff.mult, until: combat.round + eff.duration };
          }
          log.push(`${name} použil ${a.icon} ${a.name} (celá skupina +${Math.round((eff.mult-1)*100)} %)`);
        }
        break;
      }
      case 'debuff': {
        if (eff.target === 'all-enemies') {
          const alive = combat.enemy.filter(e => e.alive);
          for (const e of alive) {
            e.debuffs = e.debuffs || {};
            e.debuffs[eff.stat] = { mult: eff.mult, until: combat.round + eff.duration };
          }
          log.push(`${name} použil ${a.icon} ${a.name} na ${alive.length} nepřátel (${eff.stat} ×${eff.mult})`);
        } else {
          const target = pickEnemy(combat, eff.target);
          if (!target) return { ok:false };
          target.debuffs = target.debuffs || {};
          target.debuffs[eff.stat] = { mult: eff.mult, until: combat.round + eff.duration };
          log.push(`${name} použil ${a.icon} ${a.name} na ${target.name} (${eff.stat} ×${eff.mult})`);
        }
        break;
      }
      case 'mark': {
        const target = pickEnemy(combat, 'enemy');
        if (!target) return { ok:false };
        target.debuffs = target.debuffs || {};
        target.debuffs.marked = { mult: eff.mult, until: combat.round + eff.duration };
        log.push(`${name} označil ${target.name} — +${Math.round((eff.mult-1)*100)} % poškození na ${eff.duration} kola`);
        break;
      }
      case 'cleanse': {
        let debuffCount = 0;
        for (const al of combat.ally) {
          if (!al.alive) continue;
          if (al.debuffs && Object.keys(al.debuffs).length) {
            debuffCount += Object.keys(al.debuffs).length;
            al.debuffs = {};
          }
        }
        let totalHeal = 0;
        if (eff.heal) {
          for (const al of combat.ally) {
            if (!al.alive) continue;
            const before = al.hp;
            al.hp = Math.min(al.hpMax, al.hp + Math.round(eff.heal * healSynergy));
            totalHeal += al.hp - before;
          }
        }
        if (eff.healPct) {
          for (const al of combat.ally) {
            if (!al.alive) continue;
            const before = al.hp;
            al.hp = Math.min(al.hpMax, al.hp + Math.round(al.hpMax * eff.healPct * healSynergy));
            totalHeal += al.hp - before;
          }
        }
        const parts = [`odstraněno ${debuffCount} debuffů`];
        if (totalHeal > 0) parts.push(`+${totalHeal} HP celé družině`);
        log.push(`${name} použil ${a.icon} ${a.name}: ${parts.join(', ')}`);
        break;
      }
    }
    return { ok:true, log };
  };

  function pickEnemy(combat, target) {
    const alive = combat.enemy.filter(e => e.alive);
    if (!alive.length) return null;
    if (target === 'enemy') {
      const boss = alive.find(e => e.isBoss);
      if (boss) return boss;
      const elite = alive.find(e => e.isElite);
      if (elite) return elite;
    }
    return alive[G.randInt(0, alive.length - 1)];
  }

  function computeAbilityDamage(ally, target, eff, combat) {
    let atk = ally.atk || 10;
    if (ally.buffs && ally.buffs.atk && ally.buffs.atk.until >= combat.round) {
      atk *= ally.buffs.atk.mult;
    }
    let base = atk * (0.9 + G.rand() * 0.4) * (eff.mult || 1);
    if (!eff.ignoreDef) base -= (target.def || 0) * 0.4;
    if (target.debuffs && target.debuffs.marked && target.debuffs.marked.until >= combat.round) {
      base *= target.debuffs.marked.mult;
    }
    if (target.debuffs && target.debuffs.def && target.debuffs.def.until >= combat.round) {
      const extraDef = (target.def || 0) * 0.4 * (1 - target.debuffs.def.mult);
      base += extraDef;
    }
    if (eff.alwaysCrit) base *= 1.8;
    return Math.max(1, Math.round(base));
  }

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
