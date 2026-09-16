(function () {
  const G = window.Game;

  G.BOSS_SPAWN_CHANCE = 0.08;
  G.BOSS_ENRAGE_HP = 0.30;
  G.ELITE_HP_MULT = 1.5;
  G.ELITE_ATK_MULT = 1.3;

  G.startCombat = function (node, units, opts) {
    opts = opts || {};
    const party = units.filter(u => !u.dead && !u.isChild && !u.resting && !u.onExpedition && !(G.hasSevereInjury && G.hasSevereInjury(u)));
    if (!party.length) return null;
    const partyPower = party.reduce((s, u) => s + G.unitCombatPower(u), 0);
    let enemy, count, isBoss = false;
    const danger = G.nodeDanger(node.kind);
    const bossChance = danger >= 3 ? G.BOSS_SPAWN_CHANCE : (danger >= 2 ? G.BOSS_SPAWN_CHANCE * 0.5 : 0);
    if (!opts.noBoss && bossChance > 0 && G.chance(bossChance)) {
      const boss = G.pickBossFor(node.kind);
      if (boss) { enemy = boss; count = 1; isBoss = true; G.log(`⚠️ ${boss.icon} ${boss.name} se vynořil z temnoty!`, 'combat'); }
    }
    if (!enemy) { enemy = G.pickEnemyFor(node.kind, partyPower); count = G.enemyCountFor(enemy, party.length); }
    const combat = {
      id: 'cb_' + Date.now(),
      nodeId: node.id, nodeKind: node.kind,
      tactic: opts.tactic || 'balanced',
      autoAbilities: false,
      round: 1, log: [],
      ally: party.map(u => {
        const s = G.unitCombatStats(u);
        const abilities = G.abilitiesForCombat ? G.abilitiesForCombat(u, 8).map(a => a.id) : [];
        const gemBonus = G.gemBonusFor ? G.gemBonusFor(u) : { atk:1, def:1, hp:1 };
        return {
          unitId: u.id,
          hp: Math.round(s.hpMax * gemBonus.hp), hpMax: Math.round(s.hpMax * gemBonus.hp),
          atk: Math.round(s.atk * gemBonus.atk), def: Math.round(s.def * gemBonus.def),
          speed: Math.round(s.speed * gemBonus.speed), crit: s.crit + gemBonus.crit, reach: s.reach,
          alive: true, abilities, cooldowns: {}, stamina: 100,
          buffs: {}, debuffs: {}, stunned: 0,
          regenPerRound: 0, stunImmune: false
        };
      }),
      enemy: [], enemyTemplate: enemy.id, enemyName: enemy.name,
      finished: false, result: null, dropList: [], isBoss
    };
    // Legendární efekty: regen, stun immune, party atk bonus
    for (const a of combat.ally) {
      const u = G.getUnit(a.unitId);
      if (!u || !u.equipment) continue;
      for (const slot in u.equipment) {
        const item = u.equipment[slot];
        if (!item) continue;
        const def = G.EQUIPMENT[item.itemId];
        if (!def || !def.effect) continue;
        if (def.effect.regenInCombat) a.regenPerRound = (a.regenPerRound || 0) + def.effect.regenInCombat;
        if (def.effect.stunImmune) a.stunImmune = true;
        if (def.effect.partyAtkBonus) {
          for (const al of combat.ally) al.atk = Math.round(al.atk * def.effect.partyAtkBonus);
        }
      }
    }
    for (let i = 0; i < count; i++) combat.enemy.push(createEnemyInstance(enemy, i, count, false));
    G.state.combat.active = combat;
    G.pauseGame();
    if (G.showCombatModal) G.showCombatModal(combat);
    return combat;
  };

  function createEnemyInstance(template, index, count, forceElite) {
    const eliteChance = template.eliteChance || 0;
    const isElite = forceElite || (template.tier >= 2 && G.chance(eliteChance));
    const isBoss = !!template.isBoss;
    const hpMult = isElite ? G.ELITE_HP_MULT : 1;
    const atkMult = isElite ? G.ELITE_ATK_MULT : 1;
    const hp = Math.round(template.hp * hpMult);
    const baseAbilities = (template.abilities || []).slice();
    let abilities = baseAbilities.slice();
    if (isElite && G.ENEMY_ABILITIES) {
      const allIds = Object.keys(G.ENEMY_ABILITIES);
      const available = allIds.filter(id => !baseAbilities.includes(id));
      if (available.length) abilities.push(G.pick(available));
    }
    return {
      id: 'e' + index,
      name: (isElite ? 'Elitní ' : '') + template.name + (count > 1 && !isElite ? ' ' + (index + 1) : ''),
      icon: isElite ? '⭐' + template.icon : template.icon,
      hp, hpMax: hp,
      atk: Math.round(template.atk * atkMult), def: template.def, speed: template.speed,
      alive: true, buffs: {}, debuffs: {}, poisons: [], stunned: 0,
      templateId: template.id, isElite, isBoss,
      abilities: abilities.map(id => ({ id, cooldown: G.ENEMY_ABILITIES[id].cooldown, currentCooldown: 0 }))
    };
  }
  G.createEnemyInstance = createEnemyInstance;

  G.combatRound = function () {
    const cb = G.state.combat.active;
    if (!cb || cb.finished) return;
    const tact = G.TACTICS[cb.tactic] || G.TACTICS.balanced;
    if (G.tickAbilityTimers) G.tickAbilityTimers(cb);
    tickEnemyCooldowns(cb);
    const turnList = [];
    for (const a of cb.ally) if (a.alive) { const u = G.getUnit(a.unitId); if (u && !u.dead) turnList.push({ side:'ally', ref:a, unit:u, speed:a.speed }); }
    for (const e of cb.enemy) if (e.alive) turnList.push({ side:'enemy', ref:e, speed:e.speed });
    turnList.sort((x, y) => (y.speed - x.speed) || (x.side === 'ally' ? -1 : 1));
    cb.log.push({ t:`— Kolo ${cb.round} —`, cls:'round' });
    for (const turn of turnList) {
      if (cb.finished) break;
      if (!turn.ref.alive) continue;
      if (turn.ref.stunned && turn.ref.stunned > 0) {
        if (turn.side === 'ally' && turn.ref.stunImmune) {
          // immune — neodečítá se
        } else {
          turn.ref.stunned--;
          const label = turn.side === 'ally' ? turn.unit.name.split(' ')[0] : turn.ref.name;
          cb.log.push({ t:`💫 ${label} je omráčen a vynechává tah.`, cls: turn.side === 'ally' ? 'enemy' : 'ally' });
          continue;
        }
      }
      if (turn.side === 'ally') executeAllyTurn(cb, turn, tact);
      else executeEnemyTurn(cb, turn.ref, tact);
      if (!cb.finished && turn.side === 'enemy' && turn.ref.isBoss && turn.ref.alive) checkBossEnrage(cb, turn.ref);
      if (!cb.enemy.some(e => e.alive)) { finishCombat('win'); break; }
      if (!cb.ally.some(a => a.alive)) { finishCombat('lose'); break; }
    }
    // Regen legendárky
    if (!cb.finished) {
      for (const a of cb.ally) {
        if (!a.alive || !a.regenPerRound) continue;
        const before = a.hp;
        a.hp = Math.min(a.hpMax, a.hp + a.regenPerRound);
        if (a.hp > before) cb.log.push({ t:`💚 Legendární regenerace: +${a.hp - before} HP`, cls:'ability' });
      }
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

  function executeAllyTurn(cb, turn, tact) {
    const aliveEnemies = cb.enemy.filter(e => e.alive);
    if (!aliveEnemies.length) return;
    let abilityUsed = false;
    if (turn.ref.queuedAbility) {
      const res = G.useAbility(cb, turn.ref, turn.ref.queuedAbility);
      turn.ref.queuedAbility = null;
      if (res.ok) { abilityUsed = true; if (res.log) for (const line of res.log) cb.log.push({ t: line, cls:'ability' }); G.state.stats.abilitiesUsed = (G.state.stats.abilitiesUsed || 0) + 1; }
    } else if (cb.autoAbilities && G.autoChooseAbility) {
      const aid = G.autoChooseAbility(turn.unit, turn.ref, cb);
      if (aid) {
        const res = G.useAbility(cb, turn.ref, aid);
        if (res.ok) { abilityUsed = true; if (res.log) for (const line of res.log) cb.log.push({ t: line, cls:'ability' }); G.state.stats.abilitiesUsed = (G.state.stats.abilitiesUsed || 0) + 1; }
      }
    }
    if (!abilityUsed) {
      const target = aliveEnemies[G.randInt(0, aliveEnemies.length - 1)];
      const dmg = calcDamage(turn.ref.atk, target.def, tact.atkMult, turn.ref.crit, turn.ref.debuffs);
      target.hp = Math.max(0, target.hp - dmg.amount);
      if (target.hp <= 0) target.alive = false;
      cb.log.push({ t:`${turn.unit.name.split(' ')[0]} útočí na ${target.name}: ${dmg.amount} dmg${dmg.crit ? ' (krit!)' : ''}`, cls:'ally' });
    }
  }

  function executeEnemyTurn(cb, enemy, tact) {
    const aliveAllies = cb.ally.filter(a => a.alive);
    if (!aliveAllies.length) return;
    if (enemy.abilities && enemy.abilities.length) {
      const ready = enemy.abilities.filter(a => a.currentCooldown <= 0);
      if (ready.length) {
        const chosen = G.pick(ready);
        const def = G.ENEMY_ABILITIES[chosen.id];
        if (def && G.chance(def.chance)) {
          const log = executeEnemyAbility(cb, enemy, def);
          chosen.currentCooldown = def.cooldown;
          for (const line of log) cb.log.push({ t: line, cls:'enemy' });
          return;
        }
      }
    }
    const target = aliveAllies[G.randInt(0, aliveAllies.length - 1)];
    const effectiveDef = Math.round(target.def * tact.defMult);
    const dmg = calcDamage(enemy.atk, effectiveDef, 1, 0.03, target.debuffs);
    target.hp = Math.max(0, target.hp - dmg.amount);
    if (target.hp <= 0) target.alive = false;
    const u = G.getUnit(target.unitId);
    cb.log.push({ t:`${enemy.name} útočí na ${u ? u.name.split(' ')[0] : '?'}: ${dmg.amount} dmg`, cls:'enemy' });
  }

  function tickEnemyCooldowns(cb) {
    for (const e of cb.enemy) { if (!e.abilities) continue; for (const ab of e.abilities) if (ab.currentCooldown > 0) ab.currentCooldown--; }
  }

  function executeEnemyAbility(cb, enemy, def) {
    const eff = def.effect; const log = [];
    switch (eff.type) {
      case 'damage': {
        const hits = eff.hits || 1;
        for (let i = 0; i < hits; i++) {
          const target = pickRandomAlive(cb.ally); if (!target) break;
          const dmg = calcDamage(enemy.atk * (eff.mult || 1), target.def, 1, 0.05, target.debuffs);
          target.hp = Math.max(0, target.hp - dmg.amount);
          if (target.hp <= 0) target.alive = false;
          const u = G.getUnit(target.unitId);
          log.push(`${def.icon} ${enemy.name} — ${def.name} na ${u ? u.name.split(' ')[0] : '?'}: ${dmg.amount} dmg${dmg.crit ? ' (krit!)' : ''}`);
        }
        if (eff.selfDebuff && enemy.alive) { enemy.buffs = enemy.buffs || {}; enemy.buffs.def = { mult: eff.selfDebuff.def, until: cb.round + eff.selfDebuff.duration }; }
        if (eff.debuff) { const target = pickRandomAlive(cb.ally); if (target) { target.debuffs = target.debuffs || {}; target.debuffs[eff.debuff.stat] = { mult: eff.debuff.mult, until: cb.round + eff.debuff.duration }; } }
        break;
      }
      case 'aoe': {
        let total = 0, hitCount = 0;
        for (const target of cb.ally) {
          if (!target.alive) continue;
          const dmg = calcDamage(enemy.atk * (eff.mult || 1), target.def, 1, 0.03, target.debuffs);
          target.hp = Math.max(0, target.hp - dmg.amount);
          if (target.hp <= 0) target.alive = false;
          total += dmg.amount; hitCount++;
        }
        log.push(`${def.icon} ${enemy.name} — ${def.name}: ${total} dmg na ${hitCount} postav`);
        if (eff.stun) { for (const target of cb.ally) { if (!target.alive || target.stunImmune) continue; target.stunned = (target.stunned || 0) + eff.stun; } log.push(`💫 Omráčení na ${eff.stun} kolo!`); }
        break;
      }
      case 'poison': {
        const targets = eff.aoe ? cb.ally.filter(a => a.alive) : [pickRandomAlive(cb.ally)].filter(Boolean);
        for (const target of targets) { target.poisons = target.poisons || []; target.poisons.push({ damage: eff.damage, roundsLeft: eff.duration, source: enemy.name }); const u = G.getUnit(target.unitId); log.push(`${def.icon} ${enemy.name} — ${def.name} na ${u ? u.name.split(' ')[0] : '?'} (${eff.damage} dmg × ${eff.duration} kol)`); }
        break;
      }
      case 'stun': {
        const target = pickRandomAlive(cb.ally); if (!target) break;
        if (target.stunImmune) { log.push(`${def.icon} ${def.name} — imunní!`); break; }
        target.stunned = (target.stunned || 0) + eff.duration;
        const u = G.getUnit(target.unitId);
        log.push(`${def.icon} ${enemy.name} — ${def.name}: ${u ? u.name.split(' ')[0] : '?'} omráčen na ${eff.duration} kolo`);
        break;
      }
      case 'heal': {
        const amount = eff.amount || Math.round(enemy.hpMax * (eff.pct || 0.2));
        const before = enemy.hp;
        enemy.hp = Math.min(enemy.hpMax, enemy.hp + amount);
        log.push(`${def.icon} ${enemy.name} se uzdravil o ${enemy.hp - before} HP`);
        break;
      }
      case 'summon': {
        const minionTpl = G.ENEMIES[eff.enemyId]; if (!minionTpl) break;
        const aliveCount = cb.enemy.filter(e => e.alive).length;
        const room = Math.max(0, 8 - aliveCount);
        const want = Math.min(eff.count || 1, room);
        let summoned = 0;
        for (let i = 0; i < want; i++) { const minion = G.createEnemyInstance(minionTpl, cb.enemy.length + i, 1, false); cb.enemy.push(minion); summoned++; }
        if (summoned > 0) log.push(`${def.icon} ${enemy.name} — ${def.name}: přivoláno ${summoned}× ${minionTpl.name}`);
        break;
      }
      case 'buff': {
        enemy.buffs = enemy.buffs || {};
        enemy.buffs[eff.stat] = { mult: eff.mult, until: cb.round + eff.duration };
        log.push(`${def.icon} ${enemy.name} — ${def.name} (${eff.stat} ×${eff.mult})`);
        if (eff.selfDebuff) enemy.buffs.def = { mult: eff.selfDebuff.def, until: cb.round + eff.selfDebuff.duration };
        break;
      }
      case 'debuff': {
        const targets = eff.target === 'party' ? cb.ally.filter(a => a.alive) : [pickRandomAlive(cb.ally)].filter(Boolean);
        for (const target of targets) { target.debuffs = target.debuffs || {}; target.debuffs[eff.stat] = { mult: eff.mult, until: cb.round + eff.duration }; }
        log.push(`${def.icon} ${enemy.name} — ${def.name} (${targets.length} cílů, ${eff.stat} ×${eff.mult})`);
        break;
      }
      case 'drain': {
        const target = pickRandomAlive(cb.ally); if (!target) break;
        const dmg = calcDamage(enemy.atk * (eff.mult || 1), target.def, 1, 0.03, target.debuffs);
        target.hp = Math.max(0, target.hp - dmg.amount);
        if (target.hp <= 0) target.alive = false;
        const heal = Math.round(dmg.amount * 0.5);
        enemy.hp = Math.min(enemy.hpMax, enemy.hp + heal);
        const u = G.getUnit(target.unitId);
        log.push(`${def.icon} ${enemy.name} — ${def.name}: ${dmg.amount} dmg na ${u ? u.name.split(' ')[0] : '?'} (+${heal} HP)`);
        break;
      }
    }
    return log;
  }

  function pickRandomAlive(arr) { const alive = arr.filter(a => a.alive); if (!alive.length) return null; return alive[G.randInt(0, alive.length - 1)]; }

  function checkBossEnrage(cb, boss) {
    if (boss.enraged) return;
    if (boss.hp / boss.hpMax > G.BOSS_ENRAGE_HP) return;
    boss.enraged = true;
    boss.atk = Math.round(boss.atk * 1.5);
    boss.def = Math.round(boss.def * 0.8);
    cb.log.push({ t:`🔥 ${boss.name} ZUŘÍ! (+50 % útok, −20 % obrana)`, cls:'enemy' });
  }

  G.queueAbility = function (allyId, abilityId) { const cb = G.state.combat.active; if (!cb) return; const a = cb.ally.find(x => x.unitId === allyId); if (!a) return; a.queuedAbility = abilityId; if (G.updateCombatModal) G.updateCombatModal(cb); };
  G.toggleAutoAbilities = function () { const cb = G.state.combat.active; if (!cb) return; cb.autoAbilities = !cb.autoAbilities; if (G.updateCombatModal) G.updateCombatModal(cb); };

  function calcDamage(atk, def, mult, critChance, debuffs) {
    let effectiveAtk = atk;
    if (debuffs && debuffs.atk && debuffs.atk.until >= (G.state.combat.active ? G.state.combat.active.round : 0)) effectiveAtk *= debuffs.atk.mult;
    let base = effectiveAtk * (0.8 + G.rand() * 0.5) * mult - def * 0.5;
    base = Math.max(1, base);
    const isCrit = G.rand() < (critChance || 0.03);
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
      const template = G.ENEMIES[cb.enemyTemplate];
      const expReward = template.xp;
      const goldRange = template.gold;
      let goldMult = 1;
      if (cb.enemy.some(e => e.isElite)) goldMult *= 2;
      if (cb.isBoss) goldMult *= 3;
      const gold = Math.round(G.randInt(goldRange[0], goldRange[1]) * goldMult);
      G.state.resources.gold += gold;
      G.state.stats.goldEarned = (G.state.stats.goldEarned || 0) + gold;
      const drops = template.drops || [];
      const dropList = [{ material:'coin', qty:gold, label:`${gold} zlata` }];
      for (const d of drops) {
        if (!G.chance(d.chance)) continue;
        let qty = G.randInt(d.qty[0], d.qty[1]);
        if (cb.enemy.some(e => e.isElite)) qty = Math.ceil(qty * 1.5);
        if (cb.isBoss) qty = Math.ceil(qty * 2);
        G.matAdd(d.material, qty, 'common');
        dropList.push({ material:d.material, qty, label:`${qty}× ${G.MATERIALS[d.material].icon} ${G.MATERIALS[d.material].name}` });
      }
      // Legendary drop z bosse
      if (cb.isBoss && G.rollLegendaryDrop) {
        const bonus = G.legendaryDropBonus ? G.legendaryDropBonus() : 0;
        const legend = G.rollLegendaryDrop(cb.enemyTemplate, bonus);
        if (legend) {
          const item = G.equipAdd(legend.id, { quality: 'superior' });
          if (item) {
            G.state.equipment.push(item);
            dropList.push({ material:'legendary', qty:1, label:`✨ ${legend.name} (legendární!)` });
            G.log(`✨ LEGENDÁRNÍ DROP: ${legend.name}!`, 'combat');
          }
        }
      }
      cb.dropList = dropList;
      if (cb.enemyTemplate === 'drake') G.state.stats.dragonsKilled = (G.state.stats.dragonsKilled || 0) + 1;
      const tplQ = G.ENEMIES[cb.enemyTemplate];
      if (tplQ && G.recordKill) {
        const beastIds = ['rat','slime','boar','wolf','spider','bat','bear','werewolf','scorpion','harpy','serpent'];
        const humanIds = ['bandit','orc','goblin','bandit_leader','warlord','minotaur'];
        let killType = 'monster';
        if (beastIds.includes(tplQ.id)) killType = 'beast';
        else if (humanIds.includes(tplQ.id)) killType = 'humanoid';
        G.recordKill(killType, 1);
      }
      if (cb.isBoss) {
        G.state.stats.bossesKilled = (G.state.stats.bossesKilled || 0) + 1;
        G.log(`🏆 Poražen boss: ${template.name}!`, 'combat');
      }
      for (const a of cb.ally) {
        if (!a.alive) continue;
        const u = G.getUnit(a.unitId);
        if (!u || u.dead) continue;
        let xpMult = 1;
        if (G.setBonusFor) { const s = G.setBonusFor(u); if (s.bonuses.xpBonus) xpMult *= (1 + s.bonuses.xpBonus / 100); }
        G.addSkillXp(u, 'combat', expReward * xpMult);
        G.addUnitXp(u, expReward * 0.7 * xpMult);
        G.addMood(u, 6);
        u._combatWins = (u._combatWins || 0) + 1;
        if (G.addJournal && u._combatWins === 1) G.addJournal(u, `Vyhrál první souboj.`, '⚔️');
        if (G.addJournal && cb.isBoss) G.addJournal(u, `Porazil bosse ${template.name}.`, '🏆');
        if (G.driftPersonalityCombat) G.driftPersonalityCombat(u, true);
      }
      const aliveUnits = cb.ally.filter(a => a.alive).map(a => G.getUnit(a.unitId)).filter(u => u && !u.dead);
      if (aliveUnits.length > 1 && G.onGroupSuccess) G.onGroupSuccess(aliveUnits, cb.isBoss ? 15 : 8);
    } else {
      G.state.stats.combatsLost = (G.state.stats.combatsLost || 0) + 1;
      G.log(`💀 Prohra v souboji s ${cb.enemyName}.`, 'combat');
      for (const a of cb.ally) {
        const u = G.getUnit(a.unitId);
        if (!u || u.dead) continue;
        if (a.hp <= 0) {
          const deathChance = (G.currentDifficulty ? G.currentDifficulty().combatDeathChance : 0.12);
          if (G.chance(deathChance) && !u._resurrected) G.die(u, 'padl v boji');
          else { G.addInjury(u, G.rollInjury(3)); u.stamina = Math.max(0, u.stamina - 30); G.addMood(u, -15); }
        } else { u.stamina = Math.max(0, u.stamina - 15); G.addMood(u, -8); }
        if (!u.dead && G.driftPersonalityCombat) G.driftPersonalityCombat(u, false);
      }
    }
  }

  G.closeCombat = function () {
    const cb = G.state.combat.active;
    if (!cb) return;
    G.state.combat.active = null;
    if (G.hideCombatModal) G.hideCombatModal();
    G.resumeGame();
    if (cb.result === 'lose') { for (const a of cb.ally) { const u = G.getUnit(a.unitId); if (u && !u.dead && a.hp <= 0) G.sendToRest(u, true); } }
  };

  G.setTactic = function (t) { const cb = G.state.combat.active; if (cb) { cb.tactic = t; if (G.updateCombatModal) G.updateCombatModal(cb); } };
  G.nodeDanger = function (nodeKind) { return G.NODE_DANGER[nodeKind] != null ? G.NODE_DANGER[nodeKind] : 0; };
  G.partySafety = function (units) {
    const alive = units.filter(u => u && !u.dead);
    if (!alive.length) return 0;
    let total = 0;
    for (const u of alive) {
      let p = G.unitCombatPower(u);
      p += G.unitSkill(u, 'combat') * 1.5;
      p *= G.unitTraitMod(u, 'combat', 1);
      if (G.perkSafetyMult) { const s1 = G.perkSafetyMult(u, 'combat'); const s2 = G.perkSafetyMult(u, 'scouting'); p *= 1 / Math.min(s1, s2); }
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
    let danger = G.nodeDanger(node.kind);
    // zapečetěná jeskyně (příběhová volba) je bezpečnější
    if (danger > 0 && node.kind === 'cave' && G.storyFlag && G.storyFlag('cave_sealed')) danger *= 0.6;
    if (danger <= 0) return false;
    const units = task.unitIds.map(id => G.getUnit(id)).filter(u => u && !u.dead && !u.isChild);
    const active = units.filter(u => !u.resting && u.assignedTaskId === task.id);
    if (!active.length) return false;
    if (!task._dangerAccum) task._dangerAccum = 0;
    task._dangerAccum += dt;
    if (task._dangerAccum < CHECK_INTERVAL) return false;
    task._dangerAccum = 0;
    let safetyBonus = 1;
    let near = null, nd = Infinity;
    for (const s of G.WORLD.settlements) { const d = Math.hypot(s.x + 0.5 - node.x, s.y + 0.5 - node.y); if (d < nd) { nd = d; near = s; } }
    if (near && nd < 8 && G.settlementBonuses) { const b = G.settlementBonuses(near.id); if (b.safetyMult) safetyBonus = b.safetyMult; }
    const gids = new Set(active.map(u => u.groupId).filter(Boolean));
    for (const gid of gids) { const g = G.getGroup(gid); if (g) safetyBonus *= G.groupSafetyMult(g); }
    const timeDanger = G.timeDangerMod ? G.timeDangerMod() : 1;
    let chance = computeAccidentChance(danger, active) * safetyBonus * timeDanger;
    if (!G.chance(chance)) return false;
    // Nebezpečí 1 = jen zranění; nebezpečí 2+ = šance, že se z toho stane přepadení (souboj)
    const combatChance = danger >= 2 ? 0.45 : 0.25;
    if (danger >= 1 && G.chance(combatChance)) {
      G.cancelTask(task.id);
      G.startCombat(node, active, { tactic: 'balanced' });
      return true;
    } else {
      let victim = active[0];
      for (const u of active) if (G.unitCombatPower(u) < G.unitCombatPower(victim)) victim = u;
      G.addInjury(victim, G.rollInjury(danger));
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
    for (const u of units) { safetyMod *= G.unitTraitMod(u, 'safety', 1); if (G.perkSafetyMult) safetyMod *= G.perkSafetyMult(u, 'combat'); if (G.personalityMod) safetyMod *= G.personalityMod(u, 'safety'); }
    safetyMod = Math.pow(safetyMod, 1 / Math.max(1, units.length));
    return Math.min(0.6, p * safetyMod);
  }
})();
