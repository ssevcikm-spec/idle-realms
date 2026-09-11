(function () {
  const G = window.Game;

  G.startCombat = function (node, units, opts) {
    opts = opts || {};
    const party = units.filter(u => !u.dead && !u.isChild && !u.resting && !u.onExpedition && !(G.hasSevereInjury && G.hasSevereInjury(u)));
    if (!party.length) return null;
    const partyPower = party.reduce((s, u) => s + G.unitCombatPower(u), 0);
    const enemy = G.pickEnemyFor(node.kind, partyPower);
    const count = G.enemyCountFor(enemy, party.length);
    const combat = {
      id: 'cb_' + Date.now(),
      nodeId: node.id, nodeKind: node.kind,
      tactic: opts.tactic || 'balanced',
      autoAbilities: false,
      round: 1, log: [],
      ally: party.map(u => {
        const s = G.unitCombatStats(u);
        const abilities = G.abilitiesFor ? G.abilitiesFor(u).map(a => a.id) : [];
        return {
          unitId: u.id, hp: s.hpMax, hpMax: s.hpMax,
          atk: s.atk, def: s.def, speed: s.speed, crit: s.crit, reach: s.reach,
          alive: true, abilities, cooldowns: {}, stamina: 100,
          buffs: {}, debuffs: {}
        };
      }),
      enemy: [], enemyTemplate: enemy.id, enemyName: enemy.name,
      finished: false, result: null, dropList: []
    };
    for (let i = 0; i < count; i++) {
      combat.enemy.push({
        id: 'e' + i, name: enemy.name + (count > 1 ? ' ' + (i + 1) : ''),
        icon: enemy.icon, hp: enemy.hp, hpMax: enemy.hp,
        atk: enemy.atk, def: enemy.def, speed: enemy.speed, alive: true,
        buffs: {}, debuffs: {}, poisons: []
      });
    }
    G.state.combat.active = combat;
    G.pauseGame();
    if (G.showCombatModal) G.showCombatModal(combat);
    return combat;
  };

  G.combatRound = function () {
    const cb = G.state.combat.active;
    if (!cb || cb.finished) return;
    const tact = G.TACTICS[cb.tactic] || G.TACTICS.balanced;
    if (G.tickAbilityTimers) G.tickAbilityTimers(cb);
    const turnList = [];
    for (const a of cb.ally) if (a.alive) {
      const u = G.getUnit(a.unitId);
      if (u && !u.dead) turnList.push({ side:'ally', ref:a, unit:u, speed:a.speed });
    }
    for (const e of cb.enemy) if (e.alive) turnList.push({ side:'enemy', ref:e, speed:e.speed });
    turnList.sort((x, y) => y.speed - x.speed);
    cb.log.push({ t:`— Kolo ${cb.round} —`, cls:'round' });
    for (const turn of turnList) {
      if (cb.finished) break;
      if (turn.side === 'ally') {
        const aliveEnemies = cb.enemy.filter(e => e.alive);
        if (!aliveEnemies.length) break;
        let abilityUsed = false;
        if (turn.ref.queuedAbility) {
          const res = G.useAbility(cb, turn.ref, turn.ref.queuedAbility);
          turn.ref.queuedAbility = null;
          if (res.ok) {
            abilityUsed = true;
            if (res.log) for (const line of res.log) cb.log.push({ t: line, cls:'ability' });
            G.state.stats.abilitiesUsed = (G.state.stats.abilitiesUsed || 0) + 1;
          }
        } else if (cb.autoAbilities && G.autoChooseAbility) {
          const aid = G.autoChooseAbility(turn.unit, turn.ref, cb);
          if (aid) {
            const res = G.useAbility(cb, turn.ref, aid);
            if (res.ok) {
              abilityUsed = true;
              if (res.log) for (const line of res.log) cb.log.push({ t: line, cls:'ability' });
              G.state.stats.abilitiesUsed = (G.state.stats.abilitiesUsed || 0) + 1;
            }
          }
        }
        if (!abilityUsed) {
          const target = aliveEnemies[G.randInt(0, aliveEnemies.length - 1)];
          const dmg = calcDamage(turn.ref.atk, target.def, tact.atkMult, turn.ref.crit);
          target.hp = Math.max(0, target.hp - dmg.amount);
          if (target.hp <= 0) target.alive = false;
          cb.log.push({ t:`${turn.unit.name.split(' ')[0]} útočí na ${target.name}: ${dmg.amount} dmg${dmg.crit ? ' (krit!)' : ''}`, cls:'ally' });
        }
      } else {
        const aliveAllies = cb.ally.filter(a => a.alive);
        if (!aliveAllies.length) break;
        const target = aliveAllies[G.randInt(0, aliveAllies.length - 1)];
        const dmg = calcDamage(turn.ref.atk, Math.round(target.def * tact.defMult), 1, 0.03);
        target.hp = Math.max(0, target.hp - dmg.amount);
        if (target.hp <= 0) target.alive = false;
        const u = G.getUnit(target.unitId);
        cb.log.push({ t:`${turn.ref.name} útočí na ${u ? u.name.split(' ')[0] : '?'}: ${dmg.amount} dmg`, cls:'enemy' });
      }
      if (!cb.enemy.some(e => e.alive)) { finishCombat('win'); break; }
      if (!cb.ally.some(a => a.alive)) { finishCombat('lose'); break; }
    }
    if (!cb.finished && G.tickPoisons) {
      const plog = G.tickPoisons(cb);
      for (const line of plog) cb.log.push({ t: line, cls:'enemy' });
      if (!cb.enemy.some(e => e.alive)) finishCombat('win');
      if (!cb.ally.some(a => a.alive)) finishCombat('lose');
    }
    if (!cb.finished) cb.round++;
    if (G.updateCombatModal) G.updateCombatModal(cb);
  };

  G.queueAbility = function (allyId, abilityId) {
    const cb = G.state.combat.active;
    if (!cb) return;
    const a = cb.ally.find(x => x.unitId === allyId);
    if (!a) return;
    a.queuedAbility = abilityId;
    if (G.updateCombatModal) G.updateCombatModal(cb);
  };
  G.toggleAutoAbilities = function () {
    const cb = G.state.combat.active;
    if (!cb) return;
    cb.autoAbilities = !cb.autoAbilities;
    if (G.updateCombatModal) G.updateCombatModal(cb);
  };

  function calcDamage(atk, def, mult, critChance) {
    let base = atk * (0.8 + G.rand() * 0.5) * mult - def * 0.5;
    base = Math.max(1, base);
    const isCrit = G.rand() < critChance;
    if (isCrit) base *= 2;
    return { amount: Math.round(base), crit: isCrit };
  }

  function finishCombat(result) {
    const cb = G.state.combat.active;
    if (!cb || cb.finished) return;
    cb.finished = true;
    cb.result = result;
    if (result === 'win') {
      G.state.stats.combatsWon = (G.state.stats.combatsWon || 0) + 1;
      G.log(`⚔️ Vítězství! Porazil jsi ${cb.enemyName}.`, 'combat');
      const expReward = G.ENEMIES[cb.enemyTemplate].xp;
      const goldRange = G.ENEMIES[cb.enemyTemplate].gold;
      const gold = G.randInt(goldRange[0], goldRange[1]);
      G.state.resources.gold += gold;
      G.state.stats.goldEarned = (G.state.stats.goldEarned || 0) + gold;
      const drops = G.ENEMIES[cb.enemyTemplate].drops || [];
      const dropList = [{ material:'coin', qty:gold, label:`${gold} zlata` }];
      for (const d of drops) {
        if (!G.chance(d.chance)) continue;
        const qty = G.randInt(d.qty[0], d.qty[1]);
        G.matAdd(d.material, qty, 'common');
        dropList.push({ material:d.material, qty, label:`${qty}× ${G.MATERIALS[d.material].icon} ${G.MATERIALS[d.material].name}` });
      }
      cb.dropList = dropList;
      if (cb.enemyTemplate === 'drake') G.state.stats.dragonsKilled = (G.state.stats.dragonsKilled || 0) + 1;
      for (const a of cb.ally) {
        if (!a.alive) continue;
        const u = G.getUnit(a.unitId);
        if (!u || u.dead) continue;
        G.addSkillXp(u, 'combat', expReward);
        G.addUnitXp(u, expReward * 0.7);
        G.addMood(u, 6);
        u._combatWins = (u._combatWins || 0) + 1;
        if (G.addJournal && u._combatWins === 1) {
          G.addJournal(u, `Vyhrál první souboj (${cb.enemyName}).`, '⚔️');
        }
        if (G.addJournal && cb.enemyTemplate === 'drake') {
          G.addJournal(u, 'Zúčastnil se zabití draka Ohnivce.', '🐉');
        }
        if (G.driftPersonalityCombat) G.driftPersonalityCombat(u, true);
      }
      const aliveUnits = cb.ally.filter(a => a.alive).map(a => G.getUnit(a.unitId)).filter(u => u && !u.dead);
      if (aliveUnits.length > 1 && G.onGroupSuccess) G.onGroupSuccess(aliveUnits, 8);
    } else {
      G.state.stats.combatsLost = (G.state.stats.combatsLost || 0) + 1;
      G.log(`💀 Prohra v souboji s ${cb.enemyName}.`, 'combat');
      for (const a of cb.ally) {
        const u = G.getUnit(a.unitId);
        if (!u || u.dead) continue;
        if (a.hp <= 0) {
          if (G.addJournal) G.addJournal(u, `Byl blízko smrti v souboji s ${cb.enemyName}.`, '💀');
          if (G.chance(0.25) && !u._resurrected) {
            G.die(u, 'padl v boji');
          } else {
            const inj = G.rollInjury(3);
            G.addInjury(u, inj);
            u.stamina = Math.max(0, u.stamina - 30);
            u.mood = Math.max(0, u.mood - 15);
          }
        } else {
          u.stamina = Math.max(0, u.stamina - 15);
          G.addMood(u, -8);
        }
        if (G.driftPersonalityCombat) G.driftPersonalityCombat(u, false);
      }
    }
  }

  G.closeCombat = function () {
    const cb = G.state.combat.active;
    if (!cb) return;
    G.state.combat.active = null;
    if (G.hideCombatModal) G.hideCombatModal();
    G.resumeGame();
    if (cb.result === 'lose') {
      for (const a of cb.ally) {
        const u = G.getUnit(a.unitId);
        if (u && !u.dead && a.hp <= 0) G.sendToRest(u, true);
      }
    }
  };

  G.setTactic = function (t) {
    const cb = G.state.combat.active;
    if (cb) { cb.tactic = t; if (G.updateCombatModal) G.updateCombatModal(cb); }
  };

  G.nodeDanger = function (nodeKind) { return G.NODE_DANGER[nodeKind] != null ? G.NODE_DANGER[nodeKind] : 0; };
  G.partySafety = function (units) {
    const alive = units.filter(u => u && !u.dead);
    if (!alive.length) return 0;
    let total = 0;
    for (const u of alive) {
      let p = G.unitCombatPower(u);
      p += G.unitSkill(u, 'combat') * 1.5;
      p *= G.unitTraitMod(u, 'combat', 1);
      if (G.perkSafetyMult) {
        const s1 = G.perkSafetyMult(u, 'combat');
        const s2 = G.perkSafetyMult(u, 'scouting');
        p *= 1 / Math.min(s1, s2);
      }
      if (G.personalityMod) p *= 1 / Math.max(0.5, G.personalityMod(u, 'safety'));
      total += p;
    }
    return total / Math.max(1, alive.length) * Math.sqrt(alive.length);
  };
  G.riskLabel = function (danger, units) {
    if (danger <= 0) return { id:'safe', text:'Bezpečné', color:'#8fbf7a' };
    const safety = G.partySafety(units);
    const need = danger * 22;
    const ratio = need > 0 ? safety / need : 2;
    if (ratio >= 2)   return { id:'low',     text:'Nízké riziko',    color:'#8fbf7a' };
    if (ratio >= 1.2) return { id:'medium',  text:'Střední riziko',  color:'#e0bb5e' };
    if (ratio >= 0.8) return { id:'high',    text:'Vysoké riziko',   color:'#cf8f6a' };
    return { id:'extreme', text:'Smrtelné riziko', color:'#c05a45' };
  };

  const CHECK_INTERVAL = 3;
  G.checkDanger = function (task, dt) {
    const node = G.WORLD.nodes.find(n => n.id === task.nodeId);
    if (!node) return false;
    const danger = G.nodeDanger(node.kind);
    if (danger <= 0) return false;
    const units = task.unitIds.map(id => G.getUnit(id)).filter(u => u && !u.dead);
    const active = units.filter(u => !u.resting && u.assignedTaskId === task.id);
    if (!active.length) return false;
    if (!task._dangerAccum) task._dangerAccum = 0;
    task._dangerAccum += dt;
    if (task._dangerAccum < CHECK_INTERVAL) return false;
    task._dangerAccum = 0;
    let safetyBonus = 1;
    let near = null, nd = Infinity;
    for (const s of G.WORLD.settlements) {
      const d = Math.hypot(s.x + 0.5 - node.x, s.y + 0.5 - node.y);
      if (d < nd) { nd = d; near = s; }
    }
    if (near && nd < 8 && G.settlementBonuses) {
      const b = G.settlementBonuses(near.id);
      if (b.safetyMult) safetyBonus = b.safetyMult;
    }
    const gids = new Set(active.map(u => u.groupId).filter(Boolean));
    for (const gid of gids) {
      const g = G.getGroup(gid);
      if (g) safetyBonus *= G.groupSafetyMult(g);
    }
    const timeDanger = G.timeDangerMod ? G.timeDangerMod() : 1;
    let chance = computeAccidentChance(danger, active) * safetyBonus * timeDanger;
    if (!G.chance(chance)) return false;
    if (danger >= 2 && G.chance(0.45)) {
      G.cancelTask(task.id);
      G.startCombat(node, active, { tactic: 'balanced' });
      return true;
    } else {
      let victim = active[0];
      for (const u of active) if (G.unitCombatPower(u) < G.unitCombatPower(victim)) victim = u;
      const injury = G.rollInjury(danger);
      G.addInjury(victim, injury);
      G.addMood(victim, -6);
      if (!G.state.stats.injuries) G.state.stats.injuries = 0;
      G.state.stats.injuries++;
      return true;
    }
  };
  function computeAccidentChance(danger, units) {
    const safety = G.partySafety(units);
    const need = danger * 22;
    const ratio = need > 0 ? safety / need : 2;
    let p;
    if (ratio < 0.5) p = 0.35;
    else if (ratio < 0.8) p = 0.20;
    else if (ratio < 1.2) p = 0.08;
    else if (ratio < 1.8) p = 0.03;
    else if (ratio < 3) p = 0.012;
    else p = 0.004;
    let safetyMod = 1;
    for (const u of units) {
      safetyMod *= G.unitTraitMod(u, 'safety', 1);
      if (G.perkSafetyMult) safetyMod *= G.perkSafetyMult(u, 'combat');
      if (G.personalityMod) safetyMod *= G.personalityMod(u, 'safety');
    }
    safetyMod = Math.pow(safetyMod, 1 / Math.max(1, units.length));
    return Math.min(0.6, p * safetyMod);
  }
})();
