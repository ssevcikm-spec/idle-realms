// art-assets.js — ověří vrstvu 3: ilustrace na disku + načtení a lookupy.
//
// Použití:  node test/art-assets.js
// Exit 0 = OK, exit 1 = chyba.
//
// Ilustrace (titul, 7 scén, 6 portrétů) jsou velké obrazy pro UI. Tenhle test
// hlídá, že:
//   1) každé očekávané id má na disku soubor `assets/art/<id>.png` (a nic
//      přebývajícího, co by nikdo nepoužil),
//   2) načítání jde přes `Image`, snese chybějící soubory a nezkouší to pořád,
//   3) lookupy fungují: `scene_<popup>` a `portrait_<role>`, jinak null,
//   4) vypínač `settings.art` je respektovaný (když je off, nic se nevrací).

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let failed = 0;
function check(name, fn) {
  try { fn(); console.log('  OK   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + ' :: ' + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assert selhal'); }

const pendingImg = [];
function ImageStub() {
  const self = this;
  this.width = 768; this.height = 512;
  this.onload = null; this.onerror = null;
  Object.defineProperty(this, 'src', {
    set(v) { self._src = v; pendingImg.push(self); },
    get() { return self._src; }
  });
}
global.window = { Game: {} };
global.document = { createElement: () => ({ getContext: () => ({}) }) };
global.Image = ImageStub;

vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js/render/units_ai.js'), 'utf8'),
  { filename: 'units_ai.js' });
const G = global.window.Game;
G.state = { settings: {} };

function flush(missing) {
  while (pendingImg.length) {
    const img = pendingImg.shift();
    if (missing) img.onerror(); else img.onload();
  }
}

check('kazde ocekavane id ma na disku soubor', () => {
  const ids = G.illustrationIds();
  assert(ids.length === 14, 'očekává se 14 ilustrací, je ' + ids.length);
  const dir = path.join(ROOT, 'assets', 'art');
  assert(fs.existsSync(dir), 'chybí adresář assets/art');
  const missing = ids.filter(id => !fs.existsSync(path.join(dir, id + '.png')));
  assert(missing.length === 0, 'chybí soubory: ' + missing.join(', '));
  // a nic navíc (nesmí tam zůstat osiřelý obrázek, který nikdo nepoužije)
  const onDisk = fs.readdirSync(dir).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4));
  const extra = onDisk.filter(f => ids.indexOf(f) < 0);
  assert(extra.length === 0, 'v assets/art je navíc: ' + extra.join(', '));
  console.log('       (na disku: ' + onDisk.length + ' ilustrací, ' +
    Math.round(onDisk.reduce((s, f) => s + fs.statSync(path.join(dir, f + '.png')).size, 0) / 1024) + ' kB)');
});

check('nactou se vsechny ilustrace', () => {
  G.loadIllustrations();
  assert(pendingImg.length === 14, 'nemělo se načítat 14 souborů, ale ' + pendingImg.length);
  flush(false);
  assert(G.AI_ART.ready, 'ilustrace se nenačetly');
  assert(G.AI_ART.loaded === 14, 'načetlo se ' + G.AI_ART.loaded + ' z 14');
});

check('lookupy sedi na popupy a role', () => {
  // popupy z js/data/progress.js
  const stories = ['arrival', 'mountain_message', 'forest_call', 'merchant_call',
                   'cave_shadows', 'council', 'new_beginning'];
  for (const s of stories) {
    const id = G.illustrationForStory(s);
    assert(id === 'scene_' + s, 'popup ' + s + ' -> ' + id);
    assert(G.illustrationSrc(id) !== null, 'popup ' + s + ' nemá cestu k obrázku');
  }
  // náhodné události ilustraci nemají -> null (UI pak kreslí jako dřív)
  assert(G.illustrationForStory('lost_traveler') === null, 'náhodná událost nemá mít ilustraci');
  assert(G.illustrationForStory(null) === null, 'prázdné id má vrátit null');
  // role z G.ROLES
  for (const r of ['leader', 'quarter', 'medic', 'scout', 'fighter', 'trader']) {
    assert(G.illustrationForRole(r) === 'portrait_' + r, 'role ' + r + ' nemá portrét');
  }
  assert(G.illustrationForRole('neznamy') === null, 'neznámá role má vrátit null');
});

check('vypinac ilustraci funguje', () => {
  G.setIllustrations('off');
  assert(G.illustrationsEnabled() === false, 'vypínač nezabral');
  assert(G.illustration('title') === null, 'při vypnutých ilustracích se má vracet null');
  assert(G.illustrationSrc('title') === null, 'při vypnutých ilustracích nemá být cesta');
  assert(G.illustrationForStory('arrival') === null, 'při vypnutých ilustracích nemá být lookup');
  G.setIllustrations('on');
  assert(G.illustration('title') !== null, 'po zapnutí se má obrázek vrátit');
});

check('chybejici soubory nevadi a nezkousi se opakovane', () => {
  G.AI_ART = { ready:false, loading:false, images:{}, loaded:0, failed:0, tried:false };
  G.loadIllustrations();
  flush(true);                       // všechny chybí
  assert(G.AI_ART.failed === 14, 'chyby se nepočítají: ' + G.AI_ART.failed);
  assert(G.AI_ART.ready === false, 'ready nemá být true bez souborů');
  assert(G.illustration('title') === null, 'bez souborů se má vracet null');
  G.ensureIllustrations(); G.ensureIllustrations();
  assert(pendingImg.length === 0, 'zkouší se to znovu: ' + pendingImg.length);
});

console.log('');
if (failed) {
  console.log('VYSLEDEK: CHYBA — ' + failed + ' testu selhalo');
  process.exit(1);
}
console.log('VYSLEDEK: OK — ilustrace sedí na soubory, lookupy i vypínač');
