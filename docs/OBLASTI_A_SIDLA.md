# Oblasti (multi-tile) a vzhled sídel — návrh

> **Datum:** 2026-09-15
> **Stav:** **Krok 1 hotový** (model oblastí — viz §6). Krok 2 (jezero jako terén)
> je tím částečně pokrytý; zbývá props sídel podle zaměření a LOD.

---

## 1. Co je teď (a co tím vzniká)

Uzel je **jedno políčko** (`node = { id, x, y, kind }`). Kreslím k němu krajinný
prvek, který se vizuálně rozlévá, ale klikat se dá jen na to jedno políčko
(hit-test 1,15 dlaždice) a postavy chodí přesně na jeho střed.

Z toho plynou ty nepřesnosti, které jsi našel:
- les „přes tři dlaždice" se vybere jen trefou doprostřed,
- sídlo má velký půdorys + hradby, ale výběr je stále kroužek kolem jednoho bodu,
- jezero je *terén* (plocha vody), ale rybářský uzel je jedno políčko, které
  může být i uprostřed vodní plochy.

---

## 2. Model „oblast" (co navrhuji)

Zavést do uzlu **rozsah** místo bodu:

```js
node = { id, kind, richness,
  tiles: [ [x,y], … ]      // 1..N políček, která oblast tvoří
}
```

Dopady na jednotlivá místa v kódu:

| Kde | Dnes | Po změně |
|---|---|---|
| Generování světa (`world.js`) | umístí uzel na 1 dlaždici | najde shluk vhodného terénu (les = souvislé `forest` dlaždice, jezero = vodní plocha) a zapíše `tiles` |
| Kreslení prvku (`art.js`) | kreslí kolem jednoho středu | kreslí přes `tiles` (les rozprostřený po ploše, jezero ohraničené břehem) |
| Klikání (`handleTap`) | `hypot` na jeden bod | obsah bodu v seznamu `tiles` |
| Hledání uzlu pro práci (`findNodeFor`) | vzdálenost k bodu | vzdálenost k **nejbližšímu políčku** oblasti |
| Kam postava jde (`updateUnits`) | střed uzlu | **nejbližší krajní políčko** oblasti (u jezera → břeh) |
| Nebezpečí (`checkDanger`) | podle `kind` | beze změny (danger je vlastnost druhu, ne plochy) |
| Panel místa | „poloha x, y" | „rozloha N polí" + co tu je |

**Náročnost:** střední. Je to dobře ohraničená změna na ~5 souborech
(`world.js`, `art.js`, `work.js`, `autonomy.js`, `panels.js`), žádný nový systém.
Nejvíc práce je generování shluků (najít souvislou plochu terénu) — to už v kódu
částečně je (povodňové vyplňování se dá použít pro vodní plochy; pro les stačí
vzít obdélník/rádius s vhodnými dlaždicemi).

**Přínos:** vyřeší to jednou provždy „malý kroužek u velkého objektu", klikání
na oblast i rybaření u břehu — a naváže na to LOD (při oddálení se oblast zhroutí
do jedné ikony s názvem).

---

## 3. Jezero a rybaření zvlášť

Protože jezero je v podstatě **vodní plocha**, dává smysl ho neřešit jako „uzel
uprostřed", ale jako **terén**:

1. **Vodní plocha = jedna oblast** (souvislé `water` dlaždice). Kliknutím na
   kterékoli políčko jezera se vybere „Jezero".
2. **Rybařit se dá jen z břehu** — postava jde k nejbližší vodě sousedící se zemí
   a „rybaří z břehu". Tím zmizí nesmysl „postava stojí uprostřed jezera".
3. Uzel `lake` se tím stane *aktivitou na vodní ploše*, ne samostatným bodem.

*Mezifáze (už hotová):* rybářská místa se generují jen na vodě sousedící se zemí
(`hasLandNeighbor`), takže i v současném modelu bodů už nestojí uprostřed jezera.

---

## 4. Vzhled sídel podle zaměření

**Náročnost: nízká až střední** — je to čistě vizuální vrstva, beze změny logiky.
Sídlo už dnes ví, co je zač (`s.spec`: mining / forestry / farming / trade).

Návrh — přidat k domkům **2–3 výrazné prvky podle specializace**:

| Zaměření | Přidat k půdorysu |
|---|---|
| Těžební | těžní věž + hromady rudy/kamene |
| Lesnické | pila s kládami + skládaný dřevěný plot |
| Zemědělské | silo, pole za domky, stohy sena |
| Obchodní | stánky s plachtami, vozy, zboží |

Implementačně: `drawSettlement` zavolá `drawSettlementProps(s, …)` s vypínačem
podle `s.spec` (kreslí se v `art.js`, kde už jsou pomocné tvary). Velikost sídel
se tím **nezvětší** — props sedí dovnitř stávajících hradeb. Řádově ~60–100 řádků.

---

## 6. Co je hotové (krok 1 — model oblastí)

Uzel má teď `tiles` (seznam dlaždic) a celá hra s ním zachází jako s plochou:

- **Generování** (`js/data/world.js`):
  - jezero = **celá souvislá vodní plocha** (flood fill), musí mít břeh;
  - les / hluboký les / háj / louka / močál = **shluk 2–5 dlaždic** (seeded růst);
  - důl / jeskyně / kamenolom zůstávají bodové.
- **Klikání** (`handleTap`) — vybere se uzel na kterékoli dlaždici plochy
  (`G.nodeDistance`), nejen na středu.
- **Kam postava jde** — `G.nodeAnchor` = nejbližší dlaždice (u jezera = břeh),
  takže rybář stojí na břehu, ne uprostřed.
- **Hledání práce** — `nearestNode` měří k ploše.
- **Kreslení** (`js/render/art.js`): les/háj/močál se kreslí **na každou dlaždici**,
  louka jako jedno souvislé pole přes celý shluk, jezero jako rákosí u břehu + molo,
  bodové prvky zůstávají na středu.
- **Výběr** (kroužek) se kreslí přes celou oblast.
- Panel místa ukazuje „N polí".

Hotové je i **LOD** (přehled vs. detail — viz `docs/SKALOVANI_MAPY.md` kap. 4).
Zbývá z původního plánu jen **větší svět** (40×30 → 64×48).
**Props sídel podle zaměření (kap. 4) je hotové** — `drawSettlementProps`
kreslí podle `s.spec`: těžní věž a haldy rudy (mining), kruhovou pilu a klády
(forestry), silo a stohy sena (farming), stánky s plachtou a vůz (trade).

---

## 7. Testy

`test/headless-smoke.js` (celkem 54 kontrol) nově ověřuje:
- les má alespoň 2 dlaždice a jezero alespoň 3 (plocha),
- každé jezero má břeh (dlaždici vedle země),
- `G.nodeAnchor` vrátí pozici a `G.nodeAt` najde uzel přes kteroukoli dlaždici,
- všech 9 druhů uzlů se stále vykreslí.
