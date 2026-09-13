(function () {
  const G = window.Game;

  /* ============================================================
     NÁLADA
     ============================================================ */
  G.moodLabel = function (v) {
    if (v >= 80) return { text:'Nadšený', color:'#8fbf7a' };
    if (v >= 50) return { text:'Spokojený', color:'#9ed48c' };
    if (v >= 25) return { text:'Nespokojený', color:'#e0bb5e' };
    return { text:'Zoufalý', color:'#c05a45' };
  };
  G.moodWorkMult = function (unit) {
    const m = unit.mood == null ? 70 : unit.mood;
    if (m >= 80) return 1.15;
    if (m >= 50) return 1.00;
    if (m >= 25) return 0.85;
    return 0.60;
  };
  G.addMood = function (unit, delta) {
    if (unit.mood == null) unit.mood = 70;
    unit.mood = G.clamp(unit.mood + delta, 0, 100);
  };

  /** Odmítne postava pracovat kvůli náladě? */
  G.unitRefusesWork = function (unit) {
    if (unit.mood == null) return false;
    return unit.mood < 20;
  };

  /** Má postava inspiraci? */
  G.hasInspiration = function (unit) {
    return unit.inspirationUntil && G.state.time < unit.inspirationUntil;
  };

  G.tryInspiration = function (unit) {
    if (unit.mood == null || unit.mood < 90) return;
    if (G.hasInspiration(unit)) return;
    if (unit._inspirationChecked && G.state.time - unit._inspirationChecked < 600) return;
    unit._inspirationChecked = G.state.time;
    if (G.chance(0.15)) {
      unit.inspirationUntil = G.state.time + 600;
      G.log(`✨ ${unit.name} má inspiraci! (+30 % kvalita na 10 min)`);
    }
  };

  let moodTimer = 0;
  const MOOD_TICK = 5;
  G.tickMood = function (dt) {
    moodTimer += dt;
    if (moodTimer < MOOD_TICK) return;
    const step = moodTimer; moodTimer = 0;

    for (const u of G.state.units) {
      if (u.dead) continue;
      if (u.mood == null) u.mood = 70;

      let delta = 0;

      // odpočinek
      if (u.resting) delta += 0.6;

      // hlad (skupinové zásoby)
      if (u.groupId) {
        const g = G.getGroup(u.groupId);
        if (g && g.supplies) {
          if (g.supplies.food <= 0) delta -= 0.4;
          else delta += 0.05;
        }
      }

      // zranění
      if (u.injuries && u.injuries.length) delta -= 0.15 * u.injuries.length;

      // vyčerpání
      if (u.assignedTaskId && !u.resting && u.stamina < 30) delta -= 0.2;

      // truchlení
      if (u.griefUntil && G.state.time < u.griefUntil) delta -= 0.3;
      else if (u.griefUntil && G.state.time >= u.griefUntil) {
        u.griefUntil = null;
        G.log(`🕊️ ${u.name} se vyrovnal se ztrátou.`);
      }

      // milenci poblíž
      if (u.groupId) {
        const g = G.getGroup(u.groupId);
        if (g) {
          for (const other of G.groupMembers(g)) {
            if (other.id === u.id || other.dead) continue;
            const rel = (u.relationships || {})[other.id] || 0;
            if (rel >= G.LOVER_THRESHOLD) delta += 0.15;
            else if (rel <= -60) delta -= 0.15;
          }
        }
      }

      // vlastnosti
      const traitRegen = G.unitTraitMod(u, 'moodRegen', 1);
      if (delta > 0) delta *= traitRegen;
      if (G.personalityMod) {
        const pm = G.personalityMod(u, 'moodRegen');
        if (delta > 0) delta *= pm;
      }

      // návrat k base
      const base = 65;
      delta += (base - u.mood) * 0.01;

      G.addMood(u, delta * step);

      // inspirace
      if (u.mood >= 90) G.tryInspiration(u);
    }
  };

  /* ============================================================
     DEZERCE
     ============================================================ */
  let deserTimer = 0;
  const DESER_CHECK = 30;
  G.tickDesertion = function (dt) {
    deserTimer += dt;
    if (deserTimer < DESER_CHECK) return;
    deserTimer = 0;

    for (const u of G.state.units) {
      if (u.dead || u.isChild) continue;
      if (u.mood == null || u.mood >= 10) continue;
      if (u._desertRolledAt && G.state.time - u._desertRolledAt < 60) continue;
      u._desertRolledAt = G.state.time;
      if (!G.chance(0.04)) continue;

      // pokus odejít
      if (u.groupId) {
        const g = G.getGroup(u.groupId);
        if (g && g.roles && g.roles.leader === u.id) {
          G.log(`⚠️ ${u.name} (vůdce) je na pokraji zoufalství, ale zůstává.`);
          continue;
        }
      }
      G.desertUnit(u);
    }
  };

  G.desertUnit = function (u) {
    G.log(`🚪 ${u.name} opustil tvou skupinu. Byl příliš zoufalý.`);
    G.removeUnitFromGroup(u.id);
    if (u.assignedTaskId) G.cancelTask(u.assignedTaskId);
    u.merchantState = null;
    u.merchantRoute = null;
    u.role = null;
    u.deserted = true;
    u.dead = true;               // používáme stejnou logiku odstranění
    u.desertedAt = G.state.time;
    u.deathTime = G.state.time;
    // ostatní truchlí mírně
    for (const other of G.state.units) {
      if (other.id === u.id || other.dead) continue;
      const rel = (other.relationships || {})[u.id] || 0;
      if (rel > 30) G.addMood(other, -5);
    }
  };

  /* ============================================================
     VZTAHY
     ============================================================ */
  G.relOf = function (a, b) {
    if (!a.relationships) a.relationships = {};
    return a.relationships[b.id] || 0;
  };
  G.addRel = function (a, b, delta) {
    if (!a.relationships) a.relationships = {};
    if (!b.relationships) b.relationships = {};
    let mult = G.unitTraitMod(a, 'relationship', 1);
    if (G.personalityMod) mult *= G.personalityMod(a, 'relationship');
    a.relationships[b.id] = G.clamp((a.relationships[b.id] || 0) + delta * mult, -100, 100);
    b.relationships[a.id] = G.clamp((b.relationships[a.id] || 0) + delta * mult, -100, 100);
  };
  G.relLabel = function (v) {
    if (v >= 80) return { text:'Milenci', color:'#e0bb5e' };
    if (v >= 60) return { text:'Blízcí', color:'#d8b45a' };
    if (v >= 30) return { text:'Přátelé', color:'#8fbf7a' };
    if (v >= 5) return { text:'Známí', color:'#9ed48c' };
    if (v >= -5) return { text:'Neutrální', color:'#9c937c' };
    if (v >= -30) return { text:'Nesympatie', color:'#cf8f6a' };
    if (v >= -60) return { text:'Rivalové', color:'#cf8f6a' };
    return { text:'Nepřátelé', color:'#c05a45' };
  };

  let relTimer = 0;
  G.tickRelationships = function (dt) {
    if (G.simulating) return;
    relTimer += dt;
    if (relTimer < 10) return;
    relTimer = 0;

    // spolupráce na úkolu
    for (const t of G.state.tasks) {
      if (t.unitIds.length < 2) continue;
      const members = t.unitIds.map(id => G.getUnit(id)).filter(u => u && !u.dead);
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          G.addRel(members[i], members[j], 0.6);
        }
      }
    }

    // nepřátelé se vzájemně dráždí
    for (const u of G.state.units) {
      if (u.dead) continue;
      if (!u.groupId) continue;
      const g = G.getGroup(u.groupId);
      if (!g) continue;
      for (const other of G.groupMembers(g)) {
        if (other.id === u.id || other.dead) continue;
        const rel = (u.relationships || {})[other.id] || 0;
        if (rel <= -60 && G.chance(0.05)) {
          G.addMood(u, -2); G.addMood(other, -2);
        }
      }
    }
  };

  G.onGroupSuccess = function (units, amount) {
    for (const u of units) {
      if (u.dead) continue;
      G.addMood(u, amount || 4);
      for (const o of units) if (o.id !== u.id && !o.dead) G.addRel(u, o, (amount || 4) * 0.3);
    }
  };

  /* ============================================================
     SMRT A TRUCHLENÍ
     ============================================================ */
  G.onCompanionLoss = function (unit, reason) {
    for (const u of G.state.units) {
      if (u.id === unit.id || u.dead) continue;
      const rel = G.relOf(u, unit);
      let penalty = 0;
      if (rel >= G.LOVER_THRESHOLD) penalty = G.GRIEF_MOOD_PENALTY;
      else if (rel >= 60) penalty = 15;
      else if (rel >= 30) penalty = 8;
      else if (rel > 0) penalty = 3;
      if (penalty > 0) {
        G.addMood(u, -penalty);
        u.griefUntil = G.state.time + G.GRIEF_DURATION;
      }
    }
  };

  /* ============================================================
     OSOBNOSTNÍ DRIFT Z AKTIVIT
     ============================================================ */
  let driftTimer = 0;
  const DRIFT_TICK = 30;
  G.tickPersonalityDrift = function (dt) {
    driftTimer += dt;
    if (driftTimer < DRIFT_TICK) return;
    const step = driftTimer; driftTimer = 0;
    for (const t of G.state.tasks) {
      const act = G.ACTIVITIES[t.activityId];
      if (!act) continue;
      for (const uid of t.unitIds) {
        const u = G.getUnit(uid);
        if (!u || u.dead || u.assignedTaskId !== t.id) continue;
        if (G.driftPersonality) G.driftPersonality(u, act.skill, step / 60 * 0.5);
      }
    }
  };

  /* ============================================================
     OSOBNOSTNÍ REAKCE (občasné)
     ============================================================ */
  let reactTimer = 0;
  const REACT_TICK = 60;
  G.tickPersonalityReactions = function (dt) {
    if (G.simulating) return;
    reactTimer += dt;
    if (reactTimer < REACT_TICK) return;
    reactTimer = 0;

    for (const u of G.state.units) {
      if (u.dead || u.isChild) continue;
      if (u.assignedTaskId == null) continue;
      const t = G.state.tasks.find(x => x.id === u.assignedTaskId);
      if (!t) continue;
      const act = G.ACTIVITIES[t.activityId];
      if (!act) continue;

      const p = u.personality || {};
      // vysoká otevřenost - objev
      if ((p.openness || 50) >= 75 && G.chance(0.02)) {
        const mat = G.pick(['coin','jewel','crystal','herb']);
        const q = G.randInt(1, 3);
        G.matAdd(mat, q, 'common');
        G.log(`🔍 ${u.name} objevil ${q}× ${G.MATERIALS[mat].icon} ${G.MATERIALS[mat].name} díky zvídavosti.`);
      }
      // nízká svědomitost - chyba
      if ((p.conscientious || 50) <= 25 && G.chance(0.03)) {
        const broke = G.randInt(1, 2);
        const target = G.pick(['wood','stone','fiber','herb']);
        if (G.matRemove(target, broke)) {
          G.log(`💥 ${u.name} nechtěně zničil ${broke}× ${G.MATERIALS[target].icon} ${G.MATERIALS[target].name}.`);
          G.addMood(u, -2);
        }
      }
      // nízká stabilita - odmítne práci (i když jen krátce)
      if ((p.stability || 50) <= 20 && G.chance(0.02)) {
        if (u.stamina < 50) {
          G.cancelTask(t.id);
          G.log(`😰 ${u.name} dostal záchvat úzkosti a přestal pracovat.`);
          u._refuseUntil = G.state.time + 120;
          continue;
        }
      }
    }
  };
})();
