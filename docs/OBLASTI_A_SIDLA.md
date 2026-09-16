# Oblasti (multi-tile) a vzhled sídel — návrh

> **Datum:** 2026-09-15
> **Podnět:** „Některé prvky by mohly být přes více dlaždic … lesy by se daly
> vybrat kliknutím jako celá oblast … hezčí by bylo vybrat oblast jezera …
> jak náročné by bylo upravit design sídel podle zaměření."

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

## 5. Doporučené pořadí

1. **Oblast model** (kap. 2) — vyřeší klikání na plochu, výběr sídel a jezero.
2. **Jezero = terén s rybařením z břehu** (kap. 3) — přirozený důsledek bodu 1.
3. **Props sídel podle zaměření** (kap. 4) — samostatný, čistě vizuální krok.
4. LOD a větší svět (z `docs/SKALOVANI_MAPY.md`) — až po oblastním modelu.

Body 1+2 spolu souvisí a dává smysl je udělat jako jednu fázi; bod 3 jde kdykoli
zvlášť.
