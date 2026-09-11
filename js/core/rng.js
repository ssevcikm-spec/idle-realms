(function () {
  const G = window.Game = window.Game || {};
  let seed = (Date.now() ^ 0x9e3779b9) | 0;
  G.setSeed = function (s) { seed = (s | 0) || 1; };
  G.getSeed = function () { return seed; };
  G.rand = function () {
    seed ^= seed << 13; seed |= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5;  seed |= 0;
    return (seed >>> 0) / 4294967296;
  };
  G.randInt = function (a, b) { return a + Math.floor(G.rand() * (b - a + 1)); };
  G.pick = function (arr) { return arr[Math.floor(G.rand() * arr.length)]; };
  G.chance = function (p) { return G.rand() < p; };
  G.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  G.rngFrom = function (s) {
    let x = (s | 0) || 1;
    return function () {
      x ^= x << 13; x |= 0;
      x ^= x >>> 17;
      x ^= x << 5;  x |= 0;
      return (x >>> 0) / 4294967296;
    };
  };
})();
