(function () {
  const G = window.Game;

  const EVENTS = [
    { id:'lost_traveler', title:'Ztracený poutník', text:'U cesty jste potkali vyčerpaného poutníka.',
      choices:[
        { text:'Pomoci mu', effects:[ { type:'mat', material:'bread', qty:1 }, { type:'renown', value:2 }, { type:'log', text:'🙏 Poutník poděkoval.' } ] },
        { text:'Nechat ho být', effects:[ { type:'log', text:'Prošli jste kolem.' } ] },
        { text:'Okrást ho', effects:[ { type:'gold', value:6 }, { type:'renown', value:-2 }, { type:'log', text:'💰 Získali jste 6 zlata.' } ] }
      ] },
    { id:'rich_vein', title:'Bohatá žíla', text:'Objevili jste vzácnou žílu.', choices:[
      { text:'Vytěžit hned', effects:[ { type:'mat', material:'iron_ore', qty:6 }, { type:'log', text:'⛏️ Vytěžili jste 6 rudy.' } ] },
      { text:'Označit', effects:[ { type:'mat', material:'iron_ore', qty:2, quality:'fine' }, { type:'renown', value:1 } ] }
    ] },
    { id:'wolf', title:'Vlk v lese', text:'Cestu vám zkřížil vlk.', choices:[
      { text:'Bojovat', effects:[ { type:'combat', difficulty:3 } ] },
      { text:'Utéct', effects:[ { type:'mat', material:'hide', qty:-1 }, { type:'log', text:'💨 Utekli jste.' } ] }
    ] },
    { id:'merchant', title:'Potulný obchodník', text:'Nabízí výhodnou koupi.', choices:[
      { text:'Koupit byliny (3 zlata)', effects:[ { type:'gold', value:-3 }, { type:'mat', material:'herb', qty:4 } ] },
      { text:'Koupit rudu (8 zlat)', effects:[ { type:'gold', value:-8 }, { type:'mat', material:'iron_ore', qty:4 } ] },
      { text:'Odmítnout', effects:[ { type:'log', text:'Odmítli jste.' } ] }
    ] },
    { id:'abandoned_cart', title:'Opuštěný vůz', text:'Na kraji cesty stojí opuštěný vůz.', choices:[
      { text:'Prohledat', effects:[ { type:'loot', table:[ { chance:0.5, material:'plank', qty:3 }, { chance:0.3, material:'iron_ingot', qty:1, quality:'fine' }, { chance:0.2, material:'cloth', qty:2 }, { chance:0.15, material:'jewel', qty:1 } ] } ] },
      { text:'Jít dál', effects:[ { type:'log', text:'Nechali jste vůz být.' } ] }
    ] }
  ];
  let eventTimer = 0;
  const CHECK_EVERY = 55, CHANCE = 0.25;

  G.tickEvents = function (dt) {
    if (G.simulating) return;
    if (G.state.pendingEvents.length) return;
    eventTimer += dt;
    if (eventTimer < CHECK_EVERY) return;
    eventTimer = 0;
    if (!G.chance(CHANCE)) return;
    const ev = EVENTS[G.randInt(0, EVENTS.length - 1)];
    const instance = Object.assign({}, ev, { instanceId:'e' + Date.now() + '_' + G.randInt(0, 9999) });
    G.state.pendingEvents.push(instance);
    G.pauseGame();
    G.showEventModal(instance);
  };

  G.resolveEvent = function (instanceId, choiceIndex) {
    const idx = G.state.pendingEvents.findIndex(e => e.instanceId === instanceId);
    if (idx < 0) return;
    const ev = G.state.pendingEvents[idx];
    const choice = ev.choices[choiceIndex];
    if (!choice) return;
    applyEffects(choice.effects || []);
    G.state.pendingEvents.splice(idx, 1);
    if (G.state.pendingEvents.length > 0) G.showEventModal(G.state.pendingEvents[0]);
    else { G.hideEventModal(); G.resumeGame(); }
  };

  function applyEffects(effects) {
    for (const e of effects) {
      if (e.type === 'mat') { if (e.qty >= 0) G.matAdd(e.material, e.qty, e.quality || 'common'); else G.matRemove(e.material, -e.qty); }
      else if (e.type === 'gold') { G.state.resources.gold = Math.max(0, G.state.resources.gold + e.value); if (e.value > 0) G.log(`🪙 +${e.value} zlata.`); }
      else if (e.type === 'renown') { G.state.resources.renown = Math.max(0, G.state.resources.renown + e.value); }
      else if (e.type === 'log') G.log(e.text);
      else if (e.type === 'combat') { const idle = G.state.units.filter(u => !u.resting && !(G.hasSevereInjury && G.hasSevereInjury(u))); if (idle.length) { const node = G.WORLD.nodes.find(n => G.NODE_DANGER[n.kind] >= 2) || G.WORLD.nodes[0]; G.startCombat(node, idle, { tactic:'balanced' }); } }
      else if (e
