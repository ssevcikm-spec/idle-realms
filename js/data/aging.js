(function () {
  const G = window.Game;

  /* ---------- časová škála ---------- */
  G.AGE_YEAR = 300;          // 1 herní rok = 300 herních sekund (5 min při ×1)
  G.AGE_CHILD = 14;          // do tohoto věku nemůže pracovat
  G.AGE_ADULT = 18;          // plnoletost
  G.AGE_MIDDLE = 40;         // střední věk
  G.AGE_OLD = 55;            // stáří
  G.AGE_ELDER = 65;          // kmetství — začíná riziko přirozené smrti
  G.AGE_MAX = 95;            // strop

  G.DEATH_CHECK_INTERVAL = 30;      // jak často (v herních sekundách) kontrolovat úmrtí
  G.BIRTH_CHECK_INTERVAL = 300;     // jak často kontrolovat těhotenství (5 min)
  G.BIRTH_CHANCE = 0.05;            // šance na dítě při kontrole, pokud je pár způsobilý

  G.LOVER_THRESHOLD = 70;
  G.GRIEF_MOOD_PENALTY = 25;        // okamžitý zásah do nálady
  G.GRIEF_DURATION = 2400;          // herní sekundy trvalého smutku (8 min při ×1)

  G.FAMILY_ENABLED = true;

  /* ---------- modifikátory podle věku ---------- */
  G.ageModifiers = function (age) {
    if (age < G.AGE_ADULT) return { str:0.65, agi:0.75, int:0.90, end:0.65, work:0.40, xp:1.60 };
    if (age < G.AGE_MIDDLE) return { str:1.00, agi:1.00, int:1.00, end:1.00, work:1.00, xp:1.00 };
    if (age < G.AGE_OLD) return { str:0.94, agi:0.90, int:1.05, end:0.94, work:0.94, xp:1.00 };
    if (age < G.AGE_ELDER) return { str:0.84, agi:0.74, int:1.10, end:0.84, work:0.84, xp:0.95 };
    return { str:0.68, agi:0.58, int:1.16, end:0.68, work:0.68, xp:0.90 };
  };

  G.naturalDeathChance = function (age) {
    if (age < G.AGE_ELDER) return 0;
    // každých 5 let nad 65 = +2 % šance za kontrolu
    return (age - G.AGE_ELDER) * 0.004 + 0.004;
  };

  /* ---------- štítky ---------- */
  G.ageLabel = function (age) {
    if (age < G.AGE_CHILD) return { text:'Dítě', color:'#7aa8e0' };
    if (age < G.AGE_ADULT) return { text:'Mladistvý', color:'#7aa8e0' };
    if (age < G.AGE_MIDDLE) return { text:'Mladý', color:'#8fbf7a' };
    if (age < G.AGE_OLD) return { text:'Zralý', color:'#9c937c' };
    if (age < G.AGE_ELDER) return { text:'Starý', color:'#e0bb5e' };
    return { text:'Kmet', color:'#c05a45' };
  };
})();
