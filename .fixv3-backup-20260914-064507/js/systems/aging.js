(function () {
  const G = window.Game;
  let deathTimer = 0;
  let birthTimer = 0;

  G.unitAge = function (u) {
    if (u.dead) return u.deathAge || 0;
    const bt = u.birthTime != null ? u.birthTime : -20 * G.AGE_YEAR;
    return Math.max(0, (G.state.time - bt) / G.AGE_YEAR);
  };

  G.ageMod = function (u, key) {
    const m = G.ageModifiers(G.unitAge(u));
    return m[key] != null ? m[key] : 1;
  };

  G.tickAging = function (dt) {
    deathTimer += dt;
    birthTimer += dt;
    if (deathTimer >= G.DEATH_CHECK_INTERVAL) {
      deathTimer = 0;
      for (const u of G.state.units.slice()) {
        if (u.dead) continue;
        if (u.ageProtected) continue;
        const age = G.unitAge(u);
        const chance = G.naturalDeathChance(age);
        if (chance > 0 && G.chance(chance)) G.die(u, 'stáří');
      }
    }
    if (G.FAMILY_ENABLED && birthTimer >= G.BIRTH_CHECK_INTERVAL) {
      birthTimer = 0;
      G.tickFamily();
    }
  };

  G.tickFamily = function () {
    if (!G.state.family) G.state.family = { children: [] };
    const alive = G.state.units.filter(u => !u.dead && !u.isChild);
    const couples = [];
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        const relA = (a.relationships || {})[b.id] || 0;
        const relB = (b.relationships || {})[a.id] || 0;
        if (relA < G.LOVER_THRESHOLD || relB < G.LOVER_THRESHOLD) continue;
        const aAge = G.unitAge(a), bAge = G.unitAge(b);
        if (aAge < G.AGE_ADULT || aAge > 48) continue;
        if (bAge < G.AGE_ADULT || bAge > 48) continue;
        couples.push([a, b]);
      }
    }
    if (couples.length && G.chance(G.BIRTH_CHANCE)) {
      const [a, b] = G.pick(couples);
      G.createChild(a, b);
    }
    for (const c of G.state.family.children.slice()) {
      const age = (G.state.time - c.birthTime) / G.AGE_YEAR;
      if (age >= G.AGE_ADULT) G.promoteChild(c);
    }
  };

  G.createChild = function (a, b) {
    const childAttrs = {};
    for (const k of G.ATTRS) {
      const avg = ((a.attrs[k] || 5) + (b.attrs[k] || 5)) / 2;
      childAttrs[k] = Math.max(3, Math.round(avg + G.randInt(-1, 2)));
    }
    const parentTraits = [];
    for (const t of (a.traits || [])) if (!parentTraits.some(x => x.id === t.id)) parentTraits.push(t);
    for (const t of (b.traits || [])) if (!parentTraits.some(x => x.id === t.id)) parentTraits.push(t);
    const picked = [];
    const pool = parentTraits.slice();
    const n = G.randInt(1, 2);
    for (let i = 0; i < n && pool.length; i++) {
      picked.push(pool.splice(G.randInt(0, pool.length - 1), 1)[0]);
    }
    if (!picked.length) picked.push(...G.rollTraits());
    const parentName = G.pick([a.name, b.name]);
    const parts = parentName.split(' ');
    const childName = G.pick(G.NAMES.first) + (parts[1] ? ' ' + parts[1] : '');
    const child = {
      id: 'ch' + Date.now() + '_' + G.randInt(0, 9999),
      name: childName,
      parentA: a.id, parentB: b.id,
      birthTime: G.state.time,
      attrs: childAttrs,
      traits: picked,
      color: G.pick([a.color, b.color])
    };
    if (!G.state.family) G.state.family = { children: [] };
    G.state.family.children.push(child);
    if (G.assignChildDynasty) G.assignChildDynasty(child, a, b);
    G.state.stats.births = (G.state.stats.births || 0) + 1;
    G.log(`👶 ${a.name.split(' ')[0]} a ${b.name.split(' ')[0]} mají dítě: ${child.name}.`, 'social');
    G.addMood(a, 15);
    G.addMood(b, 15);
    if (G.addJournal) {
      G.addJournal(a, `Narodil se mu potomek: ${child.name}.`, '👶');
      G.addJournal(b, `Narodilo se jí dítě: ${child.name}.`, '👶');
    }
    return child;
  };

  G.promoteChild = function (c) {
    const u = G.createUnit(c.name);
    u.birthTime = c.birthTime;
    u.attrs = Object.assign({}, c.attrs);
    u.color = c.color;
    if (c.traits && c.traits.length) u.traits = c.traits.slice();
    u.parentIds = [c.parentA, c.parentB];
    const a = G.getUnit(c.parentA), b = G.getUnit(c.parentB);
    u.generation = Math.max((a && a.generation) || 1, (b && b.generation) || 1) + 1;
    if (G.inheritLegacy) G.inheritLegacy(u, a, b);
    G.refreshGearVisual(u);
    G.state.units.push(u);
    G.state.family.children = G.state.family.children.filter(x => x.id !== c.id);
    if (G.state.dynasty) G.state.dynasty.generations = Math.max(G.state.dynasty.generations, u.generation);
    G.log(`🎂 ${u.name} dospěl (generace ${u.generation}) a přidal se k tvé skupině.`, 'story');
    if (G.addJournal) G.addJournal(u, `Dospěl a přidal se ke skupině (generace ${u.generation}).`, '🎂');
    return u;
  };

  G.aliveUnits = function () { return G.state.units.filter(u => !u.dead); };
  G.deadUnits = function () { return G.state.units.filter(u => u.dead); };
})();
