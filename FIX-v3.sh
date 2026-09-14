#!/bin/bash
# FIX-v3.sh — 30 oprav z revizí 1, 2 a oblasti Combat
#
# Kritické:
#   K1 - Ironman: noExport guard v exportSave + exportPanel
#   K2 - Ironman: permaDeath guard v resurrect + deadCard
#   K3 - Hardcore: defeat trigger v endgame
#   C1 - Mrtví jednají ve stejném kole (combat round)
#   A1 - Kill/Explore questy používají kumulativní počítadla
#   A2 - Prestige ztratí obtížnost
#   A3 - Orphan state (combat.active, pendingEvents, pendingStory) po loadu
#
# Středně důležité:
#   A4 - findCraftsman nezohledňuje resting/expedition
#   A5 - craft XP dává mrtvým
#   A6 - resurrect NaN birthTime
#   A7 - camera.zoom bez validace
#   A9 - promoteChild nepřidá do skupiny
#   A10 - startEvent nededuplikuje
#   A12 - groupMembers(null) shodí
#   A13 - addJournal divný early return
#   A15 - checkDanger bez isChild filtru
#   S1 - lucky_craft unlock se nepoužívá
#   S2 - world_knowledge unlock se nepoužívá
#   S3 - new_region unlock nic nedělá (odstranit)
#   S4 - addUnitXp neaplikuje xpMult z obtížnosti
#   S5 - start_units unlock nepřidá do skupiny
#
# Kosmetika/data:
#   A8 - guard pro neznámý item v renderSlot + sellEquipment
#   A11 - runSummary.masterworks se nezobrazuje v modalech
#   M1 - honorTitle se nezobrazuje
#   C2 - solo part vždy 2+ T1 nepřátel
#   C3 - damageVsBeast, potionStrength mrtvé efekty legendárek
#   C4 - bossTemplateId nepoužit v rollLegendaryDrop
#   C5 - nekonzistentní clamping nálady
#   C6 - driftPersonalityCombat na mrtvých
#   C8 - chybí tie-breaker v sortu podle rychlosti
#
# Použití: bash FIX-v3.sh
# Skript je idempotentní. Při selhání je záloha v .fixv3-backup-TIMESTAMP/

set -e
cd "$(dirname "$0")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo ""
echo -e "${CYAN}=== Idle Realms — FIX v3 (30 oprav) ===${NC}"
echo ""

if [ ! -f "index.html" ] || [ ! -d "js" ]; then
  echo -e "${RED}CHYBA: Nejsi v kořeni repa.${NC}"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo -e "${RED}Potřebuji python3. Nainstaluj: pkg install python${NC}"
  exit 1
fi

BACKUP_DIR=".fixv3-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo -e "${YELLOW}Záloha: $BACKUP_DIR${NC}"

for f in js/core/state.js js/main.js js/systems/combat.js js/systems/misc.js js/systems/units.js \
         js/systems/crafting.js js/systems/events.js js/systems/endgame.js js/systems/prestige.js \
         js/systems/groups.js js/systems/aging.js js/systems/journal.js \
         js/data/workshops.js js/data/unlocks.js js/data/legendaries.js js/data/combat.js \
         js/ui/ui.js js/ui/panels.js js/ui/trade.js js/ui/debug.js; do
  if [ -f "$f" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp "$f" "$BACKUP_DIR/$f"
  fi
done
echo -e "${GREEN}  ✓ Záloha hotova${NC}"
echo ""
echo -e "${CYAN}--- Aplikuji opravy ---${NC}"

python3 << 'PYEOF'

import sys

def read(p):
    try:
        with open(p, encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        return None

def write(p, s):
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(s)

PATCHES = [
    # ============================================================
    # K1 - Ironman noExport guard
    # ============================================================
    ('js/core/state.js',
     """  G.exportSave = function () {
    if (!G.state) return null;
    try {""",
     """  G.exportSave = function () {
    if (!G.state) return null;
    if (G.currentDifficulty && G.currentDifficulty().noExport) return null;
    try {""",
     'K1a exportSave guard pro ironman'),

    ('js/ui/ui.js',
     """  function exportPanel() {
    const b64 = G.exportSave();
    if (!b64) return `<div class="perk-panel"><div class="perk-header">Export selhal</div><div class="perk-actions"><button class="btn" data-action="close-modal">Zavřít</button></div></div>`;""",
     """  function exportPanel() {
    const diff = G.currentDifficulty ? G.currentDifficulty() : null;
    if (diff && diff.noExport) {
      return `<div class="perk-panel"><div class="perk-header">🚫 Export zakázán</div><div class="perk-hint">Na obtížnosti <b>${G.esc(diff.name)}</b> nelze ukládat mimo hru.</div><div class="perk-actions"><button class="btn" data-action="close-modal">Zavřít</button></div></div>`;
    }
    const b64 = G.exportSave();
    if (!b64) return `<div class="perk-panel"><div class="perk-header">Export selhal</div><div class="perk-actions"><button class="btn" data-action="close-modal">Zavřít</button></div></div>`;""",
     'K1b exportPanel guard'),

    # ============================================================
    # K2 - Ironman permaDeath guard v resurrect
    # ============================================================
    ('js/systems/misc.js',
     """  G.resurrect = function (unitId) {
    const u = G.getUnit(unitId);
    if (!u || !u.dead) return { ok:false, reason:'Postava není mrtvá.' };
    if (u.deserted) return { ok:false, reason:'Dezertér se nechce vrátit.' };
    const cost = G.resurrectCost();""",
     """  G.resurrect = function (unitId) {
    const u = G.getUnit(unitId);
    if (!u || !u.dead) return { ok:false, reason:'Postava není mrtvá.' };
    if (u.deserted) return { ok:false, reason:'Dezertér se nechce vrátit.' };
    if (G.currentDifficulty && G.currentDifficulty().permaDeath) return { ok:false, reason:'Na této obtížnosti je smrt trvalá.' };
    const cost = G.resurrectCost();""",
     'K2a resurrect permaDeath guard'),

    ('js/ui/panels.js',
     """    const canRes = !u.deserted && G.matCount('potion') >= 3 && G.state.resources.gold >= G.resurrectCost();""",
     """    const perma = G.currentDifficulty && G.currentDifficulty().permaDeath;
    const canRes = !u.deserted && !perma && G.matCount('potion') >= 3 && G.state.resources.gold >= G.resurrectCost();""",
     'K2b deadCard permaDeath guard'),

    # ============================================================
    # K3 - Hardcore defeat trigger
    # ============================================================
    ('js/systems/endgame.js',
     """    const diff = G.currentDifficulty ? G.currentDifficulty() : null;
    if (diff && diff.permaDeath && !G.state.defeatReached) {""",
     """    const diff = G.currentDifficulty ? G.currentDifficulty() : null;
    const shouldCheck = diff && (diff.permaDeath || diff.id === 'hardcore');
    if (shouldCheck && !G.state.defeatReached) {""",
     'K3 hardcore defeat trigger'),

    # ============================================================
    # C1 - Mrtví jednají ve stejném kole
    # ============================================================
    ('js/systems/combat.js',
     """    for (const turn of turnList) {
      if (cb.finished) break;
      if (turn.ref.stunned && turn.ref.stunned > 0) {""",
     """    for (const turn of turnList) {
      if (cb.finished) break;
      if (!turn.ref.alive) continue;
      if (turn.ref.stunned && turn.ref.stunned > 0) {""",
     'C1 mrtví nejednají ve stejném kole'),

    # ============================================================
    # C5 + C6 - mood clamp + drift dead
    # ============================================================
    ('js/systems/combat.js',
     """        if (a.hp <= 0) {
          const deathChance = (G.currentDifficulty ? G.currentDifficulty().combatDeathChance : 0.12);
          if (G.chance(deathChance) && !u._resurrected) G.die(u, 'padl v boji');
          else { G.addInjury(u, G.rollInjury(3)); u.stamina = Math.max(0, u.stamina - 30); u.mood = Math.max(0, u.mood - 15); }
        } else { u.stamina = Math.max(0, u.stamina - 15); G.addMood(u, -8); }
        if (G.driftPersonalityCombat) G.driftPersonalityCombat(u, false);""",
     """        if (a.hp <= 0) {
          const deathChance = (G.currentDifficulty ? G.currentDifficulty().combatDeathChance : 0.12);
          if (G.chance(deathChance) && !u._resurrected) G.die(u, 'padl v boji');
          else { G.addInjury(u, G.rollInjury(3)); u.stamina = Math.max(0, u.stamina - 30); G.addMood(u, -15); }
        } else { u.stamina = Math.max(0, u.stamina - 15); G.addMood(u, -8); }
        if (!u.dead && G.driftPersonalityCombat) G.driftPersonalityCombat(u, false);""",
     'C5+C6 mood clamp + drift dead'),

    # ============================================================
    # C8 - tie-breaker v sortu
    # ============================================================
    ('js/systems/combat.js',
     """    turnList.sort((x, y) => y.speed - x.speed);""",
     """    turnList.sort((x, y) => (y.speed - x.speed) || (x.side === 'ally' ? -1 : 1));""",
     'C8 tie-breaker v sortu podle rychlosti'),

    # ============================================================
    # A15 - checkDanger isChild filter
    # ============================================================
    ('js/systems/combat.js',
     """    const units = task.unitIds.map(id => G.getUnit(id)).filter(u => u && !u.dead);
    const active = units.filter(u => !u.resting && u.assignedTaskId === task.id);""",
     """    const units = task.unitIds.map(id => G.getUnit(id)).filter(u => u && !u.dead && !u.isChild);
    const active = units.filter(u => !u.resting && u.assignedTaskId === task.id);""",
     'A15 checkDanger isChild filter'),

    # ============================================================
    # A1a - kill/explore snapshot při accept
    # ============================================================
    ('js/systems/events.js',
     """    q.status = 'active'; q.acceptedAt = G.state.time; q.expiresAt = G.state.time + q.deadline;
    G.log(`📜 Přijata zakázka: ${q.text}`);""",
     """    q.status = 'active'; q.acceptedAt = G.state.time; q.expiresAt = G.state.time + q.deadline;
    q.killCountAtAccept = (G.state.killCounts && G.state.killCounts[q.killType]) || 0;
    q.visitedAtAccept = (G.state.stats.settlementsVisited || []).length;
    G.log(`📜 Přijata zakázka: ${q.text}`);""",
     'A1a quest snapshot při accept'),

    # ============================================================
    # A1b - kill/explore používá delta
    # ============================================================
    ('js/ui/trade.js',
     """      } else if (q.kind === 'kill') {
        const have = (G.state.killCounts && G.state.killCounts[q.killType]) || 0;
        canTurnIn = have >= (q.killCount || 0);
      } else if (q.kind === 'explore') {
        const have = (G.state.stats.settlementsVisited || []).length;
        canTurnIn = have >= (q.exploreCount || 0);
      }""",
     """      } else if (q.kind === 'kill') {
        const have = ((G.state.killCounts && G.state.killCounts[q.killType]) || 0) - (q.killCountAtAccept || 0);
        canTurnIn = have >= (q.killCount || 0);
      } else if (q.kind === 'explore') {
        const have = (G.state.stats.settlementsVisited || []).length - (q.visitedAtAccept || 0);
        canTurnIn = have >= (q.exploreCount || 0);
      }""",
     'A1b quest delta od acceptedAt'),

    # ============================================================
    # A2 - Prestige zachová obtížnost
    # ============================================================
    ('js/systems/prestige.js',
     """    // Reset stavu, ale zachovej prestige info
    G.state = G.newState();
    G.state.worldSeed = newSeed;
    G.state.prestige = {""",
     """    // Reset stavu, ale zachovej prestige info a obtížnost
    const oldDiff = (G.state.settings && G.state.settings.difficulty) || 'normal';
    G.state = G.newState();
    G.state.worldSeed = newSeed;
    G.state.settings = { difficulty: oldDiff, tutorial: false };
    G.state.prestige = {""",
     'A2 prestige zachová obtížnost'),

    # ============================================================
    # A3 - Orphan state po loadu
    # ============================================================
    ('js/main.js',
     """      G.state = saved;
      G.state.worldSeed = seed;
      ensureDefaults();
      restoreSequences();""",
     """      G.state = saved;
      G.state.worldSeed = seed;
      // Odstraň orphan interaktivní stav (zavřený prohlížeč v průběhu)
      if (!Array.isArray(G.state.log)) G.state.log = [];
      if (G.state.combat && G.state.combat.active) {
        G.state.combat.active = null;
        G.log('⚔️ Nedokončený souboj byl zrušen.', 'info');
      }
      if (G.state.pendingEvents && G.state.pendingEvents.length) {
        G.state.pendingEvents = [];
        G.log('🎲 Nevyřešené události byly zrušeny.', 'info');
      }
      if (G.state.pendingStory) {
        G.state.pendingStory = null;
        G.log('📖 Nevyřešený příběh byl zrušen.', 'info');
      }
      ensureDefaults();
      restoreSequences();""",
     'A3 orphan state cleanup'),

    # ============================================================
    # A4 - findCraftsman resting/expedition filter
    # ============================================================
    ('js/data/workshops.js',
     """    for (const u of G.state.units) {
      if (u.merchantState && u.merchantState.active) continue;
      const lvl = G.unitSkill(u, r.skill);""",
     """    for (const u of G.state.units) {
      if (u.dead || u.isChild || u.resting || u.onExpedition) continue;
      if (u.merchantState && u.merchantState.active) continue;
      const lvl = G.unitSkill(u, r.skill);""",
     'A4 findCraftsman resting/expedition filter'),

    # ============================================================
    # A5a - craft XP jen živým
    # ============================================================
    ('js/systems/crafting.js',
     """    for (const u of G.state.units) if (G.unitSkill(u, r.skill) >= (r.reqLevel || 1) - 1) G.addSkillXp(u, r.skill, r.xp || 5);""",
     """    for (const u of G.state.units) if (!u.dead && !u.isChild && G.unitSkill(u, r.skill) >= (r.reqLevel || 1) - 1) G.addSkillXp(u, r.skill, r.xp || 5);""",
     'A5a craft XP jen živým'),

    # ============================================================
    # A5b - crafter jen živý a volný
    # ============================================================
    ('js/systems/crafting.js',
     """    else { for (const u of G.state.units) { if (u.merchantState && u.merchantState.active) continue; const lv = G.unitSkill(u, r.skill); if (lv > bestLvl) { bestLvl = lv; crafter = u; } } }""",
     """    else { for (const u of G.state.units) { if (u.dead || u.isChild || u.resting || u.onExpedition) continue; if (u.merchantState && u.merchantState.active) continue; const lv = G.unitSkill(u, r.skill); if (lv > bestLvl) { bestLvl = lv; crafter = u; } } }""",
     'A5b crafter jen živý a volný'),

    # ============================================================
    # A6 - resurrect NaN birthTime
    # ============================================================
    ('js/systems/misc.js',
     """    u.birthTime = G.state.time - Math.max(20, (u.deathAge - 5)) * G.AGE_YEAR;""",
     """    const safeDeathAge = (u.deathAge && isFinite(u.deathAge)) ? u.deathAge : 30;
    u.birthTime = G.state.time - Math.max(20, (safeDeathAge - 5)) * G.AGE_YEAR;""",
     'A6 resurrect NaN birthTime'),

    # ============================================================
    # A7 - camera.zoom validace
    # ============================================================
    ('js/main.js',
     """    s.camera = s.camera || { x: 7, y: 22, zoom: 1 };
    s.selected = s.selected || null;""",
     """    s.camera = s.camera || { x: 7, y: 22, zoom: 1 };
    s.camera.zoom = G.clamp(s.camera.zoom || 1, 0.55, 2.0);
    s.camera.x = G.clamp(s.camera.x || 7, 0, 40);
    s.camera.y = G.clamp(s.camera.y || 22, 0, 30);
    s.selected = s.selected || null;""",
     'A7 camera.zoom validace'),

    # ============================================================
    # A8a - renderSlot guard
    # ============================================================
    ('js/ui/panels.js',
     """    const def = G.EQUIPMENT[item.itemId];
    const durPct = Math.round(item.durability / def.durability * 100);""",
     """    const def = G.EQUIPMENT[item.itemId];
    if (!def) return `<div class="equip-slot broken"><span class="equip-label">${label}</span><span class="equip-item">— neznámý předmět (${item.itemId}) —</span></div>`;
    const durPct = Math.round(item.durability / def.durability * 100);""",
     'A8a renderSlot guard pro neznámý item'),

    # ============================================================
    # A8b - sellEquipment guard
    # ============================================================
    ('js/systems/misc.js',
     """  G.sellEquipment = function (instanceId) {
    const item = G.equipFind(instanceId);
    if (!item) return { ok:false, reason:'Předmět nenalezen.' };
    const def = G.EQUIPMENT[item.itemId];
    if (def.legendary) return { ok:false, reason:'Legendární předměty nelze prodat.' };""",
     """  G.sellEquipment = function (instanceId) {
    const item = G.equipFind(instanceId);
    if (!item) return { ok:false, reason:'Předmět nenalezen.' };
    const def = G.EQUIPMENT[item.itemId];
    if (!def) return { ok:false, reason:'Neznámý předmět.' };
    if (def.legendary) return { ok:false, reason:'Legendární předměty nelze prodat.' };""",
     'A8b sellEquipment guard'),

    # ============================================================
    # A9 - promoteChild do skupiny
    # ============================================================
    ('js/systems/aging.js',
     """    G.state.units.push(u);
    G.state.family.children = G.state.family.children.filter(x => x.id !== c.id);""",
     """    G.state.units.push(u);
    if (a && a.groupId) { const pg = G.getGroup(a.groupId); if (pg) G.addUnitToGroup(u.id, pg.id); }
    else if (b && b.groupId) { const pg = G.getGroup(b.groupId); if (pg) G.addUnitToGroup(u.id, pg.id); }
    G.state.family.children = G.state.family.children.filter(x => x.id !== c.id);""",
     'A9 promoteChild do skupiny rodiče'),

    # ============================================================
    # A10a - startEvent dedupe + duration mult
    # ============================================================
    ('js/systems/events.js',
     """  G.startEvent = function (templateId) {
    const tpl = G.WORLD_EVENTS[templateId]; if (!tpl) return null;
    const ev = { id:'we'+(weSeq++), templateId, startedAt: G.state.time, endsAt: G.state.time + tpl.duration };
    if (!G.state.worldEvents) G.state.worldEvents = [];
    G.state.worldEvents.push(ev);
    G.log(`${tpl.icon} Světová událost: ${tpl.name} — ${tpl.desc}`);
    return ev;
  };""",
     """  G.startEvent = function (templateId, force) {
    const tpl = G.WORLD_EVENTS[templateId]; if (!tpl) return null;
    if (!G.state.worldEvents) G.state.worldEvents = [];
    if (!force) {
      if (G.state.worldEvents.some(e => e.templateId === templateId)) return null;
      if (G.state.worldEvents.length >= G.WORLD_EVENT_MAX) return null;
    }
    const evMult = G.unlockEventDurationMult ? G.unlockEventDurationMult() : 1;
    const ev = { id:'we'+(weSeq++), templateId, startedAt: G.state.time, endsAt: G.state.time + tpl.duration * evMult };
    G.state.worldEvents.push(ev);
    G.log(`${tpl.icon} Světová událost: ${tpl.name} — ${tpl.desc}`);
    return ev;
  };""",
     'A10a startEvent dedupe + duration mult'),

    # ============================================================
    # A10b - debug force
    # ============================================================
    ('js/ui/debug.js',
     """    else if (a === 'event') G.startEvent(el.dataset.event);""",
     """    else if (a === 'event') G.startEvent(el.dataset.event, true);""",
     'A10b debug startEvent force'),

    # ============================================================
    # A11 - masterworks v obou modalech
    # ============================================================
    ('js/ui/ui.js',
     """        <div class="summary-item"><span>Zakázek</span><span>${sm.questsCompleted}</span></div>
        <div class="summary-item"><span>Expedic</span><span>${sm.expeditions}</span></div>""",
     """        <div class="summary-item"><span>Zakázek</span><span>${sm.questsCompleted}</span></div>
        <div class="summary-item"><span>Expedic</span><span>${sm.expeditions}</span></div>
        <div class="summary-item"><span>Mistrovská díla</span><span>${sm.masterworks}</span></div>""",
     'A11 masterworks ve victory modalu'),

    # ============================================================
    # A12 - groupMembers(null)
    # ============================================================
    ('js/systems/groups.js',
     """  G.groupMembers = function (g) { return g.memberIds.map(id => G.getUnit(id)).filter(Boolean); };""",
     """  G.groupMembers = function (g) { if (!g) return []; return g.memberIds.map(id => G.getUnit(id)).filter(Boolean); };""",
     'A12 groupMembers guard null'),

    # ============================================================
    # A13 - addJournal early return
    # ============================================================
    ('js/systems/journal.js',
     """    if (!unit || unit.dead === undefined) return;""",
     """    if (!unit) return;""",
     'A13 addJournal fix early return'),

    # ============================================================
    # S1 - lucky_craft do crafting
    # ============================================================
    ('js/systems/crafting.js',
     """    let synQuality = 0;
    if (crafter && G.synergyBonus) synQuality = G.synergyBonus(crafter, 'craftQuality');
    let q;""",
     """    let synQuality = 0;
    if (crafter && G.synergyBonus) synQuality = G.synergyBonus(crafter, 'craftQuality');
    if (G.unlockCraftQualityBonus) synQuality += G.unlockCraftQualityBonus();
    let q;""",
     'S1 lucky_craft do rollQuality'),

    # ============================================================
    # S2 - world_knowledge do tickWorldEvents
    # ============================================================
    ('js/systems/events.js',
     """    weTimer = 0;
    weNextIn = G.WORLD_EVENT_INTERVAL[0] + G.rand() * (G.WORLD_EVENT_INTERVAL[1] - G.WORLD_EVENT_INTERVAL[0]);""",
     """    weTimer = 0;
    const weDurMult = G.unlockEventDurationMult ? G.unlockEventDurationMult() : 1;
    weNextIn = (G.WORLD_EVENT_INTERVAL[0] + G.rand() * (G.WORLD_EVENT_INTERVAL[1] - G.WORLD_EVENT_INTERVAL[0])) / weDurMult;""",
     'S2 world_knowledge do event intervalu'),

    # ============================================================
    # S3 - odstranit new_region z UNLOCKS
    # ============================================================
    ('js/data/unlocks.js',
     """  G.UNLOCKS = {
    new_region: {
      id: 'new_region', name: 'Nové území', icon: '🗺️',
      desc: 'Odemkne 5. region světa (Zapomenutý ostrov).',
      kind: 'world'
    },
    start_gold: {""",
     """  G.UNLOCKS = {
    start_gold: {""",
     'S3 new_region odstraněn'),

    # ============================================================
    # S4 - addUnitXp s xpMult
    # ============================================================
    ('js/systems/units.js',
     """    unit.xp += amount; let leveled = false;
    while (unit.xp >= G.unitXpForLevel(unit.level)) {""",
     """    if (G.currentDifficulty) amount *= G.currentDifficulty().xpMult;
    unit.xp += amount; let leveled = false;
    while (unit.xp >= G.unitXpForLevel(unit.level)) {""",
     'S4 addUnitXp aplikuje xpMult'),

    # ============================================================
    # S5 - start_units přidat do skupiny
    # ============================================================
    ('js/data/unlocks.js',
     """    if (unlocks.includes('start_units')) {
      const extra = G.UNLOCKS.start_units.value;
      for (let i = 0; i < extra; i++) {
        const u = G.createUnit();
        applyStartUnitBoost(u, unlocks);
        G.state.units.push(u);
      }
    }""",
     """    if (unlocks.includes('start_units')) {
      const extra = G.UNLOCKS.start_units.value;
      for (let i = 0; i < extra; i++) {
        const u = G.createUnit();
        applyStartUnitBoost(u, unlocks);
        G.state.units.push(u);
        const g = G.state.groups.find(x => x.name === 'Dobrodruzi');
        if (g) G.addUnitToGroup(u.id, g.id);
      }
    }""",
     'S5 start_units do skupiny'),

    # ============================================================
    # C2 - solo part 1 T1 nepřítel
    # ============================================================
    ('js/data/combat.js',
     """    if (enemy.tier <= 1) return G.randInt(1, Math.min(4, Math.max(2, partySize)));""",
     """    if (enemy.tier <= 1) return G.randInt(1, Math.min(4, Math.max(1, partySize)));""",
     'C2 solo part 1 T1 nepřítel'),

    # ============================================================
    # C3 - dead legendary effects
    # ============================================================
    ('js/data/legendaries.js',
     """      mods:{}, unique:'+20 % poškození proti zvířatům',
      effect:{ damageVsBeast:1.20 }""",
     """      mods:{}, unique:'+28 bojový bonus'""",
     'C3a wolf_fang dead effect odstraněn'),

    ('js/data/legendaries.js',
     """      unique:'Lektvary léčí +50 %',
      effect:{ potionStrength:50 }""",
     """      unique:'+40 % alchymie, +30 % bylinkářství'""",
     'C3b witch_charm dead effect odstraněn'),

    # ============================================================
    # C4 - bossTemplateId mapping
    # ============================================================
    ('js/data/legendaries.js',
     """  G.rollLegendaryDrop = function (bossTemplateId, bonus) {
    bonus = bonus || 0;
    const baseChance = 0.05;
    const chance = Math.min(0.5, baseChance * (1 + bonus));
    if (!G.chance(chance)) return null;
    const pool = Object.values(G.LEGENDARIES);
    return G.pick(pool);
  };""",
     """  G.LEGENDARY_DROPS_BY_BOSS = {
    ancient_treant: ['treant_heart'],
    alpha_werewolf: ['wolf_fang'],
    warlord:        ['warlord_banner'],
    colossus:       ['colossus_core'],
    bog_witch:      ['witch_charm'],
    leviathan:      ['leviathan_scale']
  };

  G.rollLegendaryDrop = function (bossTemplateId, bonus) {
    bonus = bonus || 0;
    const baseChance = 0.05;
    const chance = Math.min(0.5, baseChance * (1 + bonus));
    if (!G.chance(chance)) return null;
    const ids = G.LEGENDARY_DROPS_BY_BOSS[bossTemplateId];
    const pool = ids
      ? ids.map(id => G.LEGENDARIES[id]).filter(Boolean)
      : Object.values(G.LEGENDARIES);
    return pool.length ? G.pick(pool) : null;
  };""",
     'C4 bossTemplateId mapping pro legendárky'),

    # ============================================================
    # M1 - honorTitle ve victory modalu
    # ============================================================
    ('js/ui/ui.js',
     """        <div class="summary-item"><span>Obtížnost</span><span>${sm.difficulty.icon} ${G.esc(sm.difficulty.name)}</span></div>
        <div class="summary-item"><span>Odehráno</span><span>${formatTime(sm.timePlayed)}</span></div>
        <div class="summary-item"><span>Živé postavy</span><span>${sm.unitsAlive}</span></div>""",
     """        <div class="summary-item"><span>Obtížnost</span><span>${sm.difficulty.icon} ${G.esc(sm.difficulty.name)}</span></div>
        <div class="summary-item"><span>Titul</span><span>${G.esc(sm.difficulty.honorTitle || '—')}</span></div>
        <div class="summary-item"><span>Odehráno</span><span>${formatTime(sm.timePlayed)}</span></div>
        <div class="summary-item"><span>Živé postavy</span><span>${sm.unitsAlive}</span></div>""",
     'M1 honorTitle ve victory modalu'),
]

applied = 0
already = 0
failed = 0

for path, old, new, desc in PATCHES:
    s = read(path)
    if s is None:
        print(f'  \u2717 MISSING {path}: {desc}')
        failed += 1
        continue
    if old in s:
        write(path, s.replace(old, new, 1))
        print(f'  \u2713 {path}: {desc}')
        applied += 1
    elif new in s:
        print(f'  - {path}: {desc} (ji\u017e hotovo)')
        already += 1
    else:
        print(f'  \u26a0 {path}: {desc} \u2014 pattern NENALEZEN')
        failed += 1

print('')
print(f'Aplikov\u00e1no: {applied}  |  Ji\u017e hotovo: {already}  |  Selhalo: {failed}')
if failed > 0:
    sys.exit(2)
PYEOF

echo ""
echo -e "${CYAN}--- Verifikace klíčových patternů ---${NC}"

verify() {
  if grep -q "$2" "$1" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} $1: $3"
  else
    echo -e "  ${RED}✗${NC} $1: $3 — CHYBÍ"
  fi
}

verify js/core/state.js 'noExport' 'K1a guard v exportSave'
verify js/ui/ui.js 'Export zakázán' 'K1b exportPanel guard'
verify js/systems/misc.js 'je smrt trvalá' 'K2a resurrect permaDeath'
verify js/ui/panels.js 'permaDeath' 'K2b deadCard guard'
verify js/systems/endgame.js "diff.id === 'hardcore'" 'K3 hardcore defeat'
verify js/systems/combat.js 'if (!turn.ref.alive) continue' 'C1 mrtví nejednají'
verify js/systems/combat.js "x.side === 'ally' ? -1 : 1" 'C8 tie-breaker'
verify js/systems/combat.js '!u.dead && G.driftPersonalityCombat' 'C6 drift dead'
verify js/systems/combat.js 'G.addMood(u, -15)' 'C5 mood clamp'
verify js/systems/combat.js '!u.isChild' 'A15 checkDanger'
verify js/systems/events.js 'killCountAtAccept' 'A1a snapshot'
verify js/ui/trade.js 'visitedAtAccept' 'A1b delta'
verify js/systems/prestige.js 'oldDiff' 'A2 prestige difficulty'
verify js/main.js 'Nedokončený souboj byl zrušen' 'A3 orphan cleanup'
verify js/data/workshops.js 'u.resting || u.onExpedition' 'A4 findCraftsman'
verify js/systems/crafting.js 'unlockCraftQualityBonus' 'S1 lucky_craft'
verify js/systems/events.js 'unlockEventDurationMult' 'S2 world_knowledge'
verify js/systems/events.js 'if (!force)' 'A10 startEvent dedupe'
verify js/data/unlocks.js 'if (g) G.addUnitToGroup' 'S5 start_units group'
verify js/systems/units.js 'G.currentDifficulty().xpMult' 'S4 unit XP mult'
verify js/data/legendaries.js 'LEGENDARY_DROPS_BY_BOSS' 'C4 boss mapping'
verify js/data/combat.js 'Math.max(1, partySize)' 'C2 solo party'

echo ""
echo -e "${CYAN}--- Syntax check (node) ---${NC}"

if command -v node >/dev/null 2>&1; then
  OK=0; FAIL=0
  for f in js/core/state.js js/main.js js/systems/combat.js js/systems/misc.js js/systems/units.js \
           js/systems/crafting.js js/systems/events.js js/systems/endgame.js js/systems/prestige.js \
           js/systems/groups.js js/systems/aging.js js/systems/journal.js \
           js/data/workshops.js js/data/unlocks.js js/data/legendaries.js js/data/combat.js \
           js/ui/ui.js js/ui/panels.js js/ui/trade.js js/ui/debug.js; do
    if [ ! -f "$f" ]; then continue; fi
    if node --check "$f" 2>/dev/null; then
      OK=$((OK+1))
    else
      echo -e "  ${RED}✗${NC} $f"
      node --check "$f" 2>&1 | head -3
      FAIL=$((FAIL+1))
    fi
  done
  if [ "$FAIL" -eq 0 ]; then
    echo -e "  ${GREEN}Syntax: $OK OK, 0 FAIL${NC}"
  else
    echo -e "  ${RED}Syntax: $OK OK, $FAIL FAIL${NC}"
    echo ""
    echo -e "${RED}Pozor: syntax error! Obnov: cp -r $BACKUP_DIR/* .${NC}"
    exit 1
  fi
else
  echo -e "${YELLOW}(node nen\u00ed, syntax check p\u0159esko\u010den)${NC}"
fi

echo ""
echo -e "${GREEN}=== Hotovo! ===${NC}"
echo ""
echo "Ov\u011b\u0159 v prohl\u00ed\u017ee\u010di:"
echo "  1) test/smoke.html \u2192 v\u0161e zelen\u00e9"
echo "  2) index.html \u2192 nov\u00e1 hra, vyber obt\u00ed\u017enost"
echo "  3) Hardcore: dynastie vyhyne + zlato dojde \u2192 modal KONEC"
echo "  4) Ironman: export save \u2192 chyba 'Export zakázán'; vzk\u0159\u00ed\u0161en\u00ed \u2192 chyba"
echo "  5) Boj: nech\u00e1 postavu zem\u0159\u00edt uprost\u0159ed kola \u2192 mrtv\u00fd nejedn\u00e1"
echo "  6) Zak\u00e1zka 'poraz 10 bandit\u016f' \u2192 po p\u0159ijet\u00ed po\u010d\u00edtadlo za\u010d\u00edn\u00e1 od 0"
echo ""
echo -e "${YELLOW}Z\u00e1loha:${NC} $BACKUP_DIR"
echo "Obnoven\u00ed: cp -r $BACKUP_DIR/* ."
echo ""
echo -e "${CYAN}Commit:${NC}"
echo "  git add -A"
echo "  git commit -m 'fix: 30 oprav z revizí 1, 2 a oblasti Combat'"
echo "  git push"
echo ""
