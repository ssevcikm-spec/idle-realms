(function () {
  const G = window.Game;

  G.ensurePolitics = function () {
    if (!G.state.politics) G.state.politics = { factions: {}, lastCheck: 0 };
    if (!G.state.politics.factions) G.state.politics.factions = {};
    for (const fid in G.FACTIONS) {
      if (!G.state.politics.factions[fid]) {
        G.state.politics.factions[fid] = {
          nextElection: G.state.time + G.POLITICS.electionInterval * (0.7 + G.rand() * 0.6),
          phase: 'idle', phaseEndsAt: 0, candidates: [], winner: null,
          playerSupport: 0, playerCandidateId: null, history: []
        };
      }
    }
  };

  function startElection(fid) {
    const st = G.state.politics.factions[fid];
    const candidateCount = G.randInt(2, 3);
    const programs = Object.keys(G.POLITICAL_PROGRAMS);
    const used = new Set();
    const candidates = [];
    for (let i = 0; i < candidateCount; i++) {
      const name = G.pick(G.CANDIDATE_NAMES.first) + ' ' + G.pick(G.CANDIDATE_NAMES.last);
      let progId;
      do { progId = G.pick(programs); } while (used.has(progId) && used.size < programs.length);
      used.add(progId);
      candidates.push({ id: 'c' + Date.now() + '_' + i, name, program: progId, support: G.randInt(1, 5) });
    }
    if (G.getRep(fid) >= G.POLITICS.candidacyReputation) {
      st.playerCandidateId = 'player_' + fid;
      candidates.push({ id: st.playerCandidateId, name: G.state.playerName || 'Ty', program: 'traditional', support: 0, isPlayer: true });
    } else st.playerCandidateId = null;
    st.candidates = candidates;
    st.playerSupport = 0;
    st.phase = 'election';
    st.phaseEndsAt = G.state.time + G.POLITICS.electionPhaseDuration;
    const f = G.FACTIONS[fid];
    G.log(`🏛️ ${f.icon} ${f.name}: začínají volby! ${candidates.length} kandidátů.`);
  }

  function resolveElection(fid) {
    const st = G.state.politics.factions[fid];
    if (!st.candidates.length) { st.phase = 'idle'; scheduleNext(fid); return; }
    let winner = st.candidates[0];
    for (const c of st.candidates) if ((c.support || 0) > (winner.support || 0)) winner = c;
    const f = G.FACTIONS[fid];
    if (winner.isPlayer) {
      G.log(`🎉 ${f.icon} ${f.name}: Vyhrál jsi volby! Program: ${G.POLITICAL_PROGRAMS[winner.program].name}.`);
      G.state.resources.renown += 30;
      if (!G.state.stats.electionsWon) G.state.stats.electionsWon = 0;
      G.state.stats.electionsWon++;
    } else {
      const prog = G.POLITICAL_PROGRAMS[winner.program];
      G.log(`🏛️ ${f.icon} ${f.name}: volby vyhrál ${winner.name} (${prog.name}).`);
    }
    if (st.playerSupport > 0) {
      const supported = st.candidates.find(c => c.id === st.supportedCandidateId);
      if (supported && supported.id === winner.id) {
        G.addRep(fid, 10);
        G.log(`📈 Podpořil jsi vítěze — reputace s ${f.name} +10.`);
      } else {
        G.addRep(fid, -5);
        G.log(`📉 Podpořil jsi poraženého — reputace s ${f.name} −5.`);
      }
    }
    st.history.push({ t: G.state.time, winnerId: winner.id, winnerName: winner.name, program: winner.program });
    if (st.history.length > 10) st.history.shift();
    st.winner = winner;
    st.phase = 'idle';
    st.candidates = [];
    scheduleNext(fid);
  }

  function scheduleNext(fid) {
    const st = G.state.politics.factions[fid];
    st.nextElection = G.state.time + G.POLITICS.electionInterval;
  }

  let tickTimer = 0;
  const TICK = 10;
  G.tickPolitics = function (dt) {
    tickTimer += dt;
    if (tickTimer < TICK) return;
    tickTimer = 0;
    G.ensurePolitics();
    for (const fid in G.state.politics.factions) {
      const st = G.state.politics.factions[fid];
      if (st.phase === 'idle' && G.state.time >= st.nextElection) startElection(fid);
      else if (st.phase === 'election' && G.state.time >= st.phaseEndsAt) resolveElection(fid);
    }
  };

  G.supportCandidate = function (fid, candidateId) {
    const st = G.state.politics.factions[fid];
    if (!st || st.phase !== 'election') return { ok:false, reason:'Žádné volby.' };
    const c = st.candidates.find(x => x.id === candidateId);
    if (!c) return { ok:false, reason:'Kandidát neexistuje.' };
    const price = G.supportPrice(fid);
    if (G.state.resources.gold < price) return { ok:false, reason:`Potřebuješ ${price} zlata.` };
    G.state.resources.gold -= price;
    st.playerSupport = (st.playerSupport || 0) + 1;
    st.supportedCandidateId = candidateId;
    c.support = (c.support || 0) + G.randInt(2, 4);
    const f = G.FACTIONS[fid];
    G.log(`🤝 Podpořil jsi ${c.name} ve volbách (${f.name}) za ${price} zlata.`);
    return { ok:true };
  };

  G.politicsOverview = function () {
    G.ensurePolitics();
    const out = [];
    for (const fid in G.FACTIONS) {
      const f = G.FACTIONS[fid];
      const st = G.state.politics.factions[fid];
      out.push({
        faction: f, phase: st.phase, nextElection: st.nextElection,
        phaseEndsAt: st.phaseEndsAt, candidates: st.candidates,
        winner: st.winner, playerSupport: st.playerSupport || 0
      });
    }
    return out;
  };

  G.politicalPriceMult = function (settlementId, matId) {
    const fid = G.SETTLEMENT_FACTION[settlementId];
    if (!fid) return 1;
    const mods = G.politicsMods(fid);
    if (!mods || !mods.priceMods) return 1;
    if (mods.priceMods[matId] != null) return mods.priceMods[matId];
    if (mods.priceMods.all != null) return mods.priceMods.all;
    return 1;
  };

  G.politicalXpMult = function (settlementId) {
    const fid = G.SETTLEMENT_FACTION[settlementId];
    if (!fid) return 1;
    const mods = G.politicsMods(fid);
    return (mods && mods.xpBonus) || 1;
  };
})();
