# Idle Realms — Design dokument

> **Verze:** 4.0
> **Datum:** 13. 9. 2026
> **Navazující dokumenty:** `TECHNICKY_DOKUMENT.md`, `PLAN_VYVOJE.md`, `ROADMAP_OBSAHU.md`

## 0. Changelog

### v4.0 (13. 9. 2026)
- **Fáze 8 (Výbava a loot):** 6 legendárních předmětů, 3 sety (2/3/5), 6 gemů, socketing, kvalita ovlivňuje staty.
- **Fáze 9 (Zakázky a expedice):** 8 nových typů zakázek (kill/escort/explore), 10 nových expedic (celkem 15), eventy na cestě.
- **Fáze 10 (Budovy):** 6 nových budov sídel (specializované), 6 nových budov základny (včetně gem smithy a legendary forge).

### v3.0 (13. 9. 2026)
- 33 schopností hráče, 7 synergií.

### v2.0
- 5-tab navigace, 34 nepřátel, 34 achievementů.

### v1.0
- Počáteční design.

## 1. Přehled

Idle RPG s managementem skupiny, živým světem, dynastií a prestiží. Vanilla JS, bez závislostí.

## 2. Herní smyčky

**Core:** Vybrat místo → Přiřadit práci → Materiály → Vyrábět/Obchodovat/Bojovat.

**Meta:** Nová hra → Základna → Dynastie → Prestiž → Nová mapa.

**Offline:** Uložení při odchodu, 4 h dopočtu.

## 3. Progrese

- **11 dovedností** × perky na L5/L10/L20
- **5 atributů**
- **33 schopností** (3 per dovednost: L3/L8/L15)
- **7 synergií** (2 dovednosti na L10+)
- **Meta:** Dynastie, prestiž

## 4. Systémy

### 4.1 Postavy
Osobnost (5 os), nálada, ambice, deník, manuální režim, 10 povolání, 16 traitů.

### 4.2 Skupiny
6 rolí, chemie (Harmonie/Rozpad).

### 4.3 Práce a výroba
12 aktivit, 10 receptů. Kvalita: crude → common → fine → superior → **masterwork**.

### 4.4 Boj
34 nepřátel, 6 bossů, ~35 enemy abilities, elita (⭐), boss enrage.

### 4.5 Výbava (Fáze 8)
- **14 základních předmětů**
- **6 legendárních** (drop z bossů s 5% šancí + legendary forge bonus)
- **3 sety**: Lovcova výbava (3 ks), Válečná zbroj (3 ks), Učencova moudrost (3 ks)
- **6 gemů** (ruby, sapphire, emerald, topaz, amethyst, diamond) — socket do zbroje/zbraně
- **Kvalita** výbavy (common/fine/…) ovlivňuje staty

### 4.6 Ekonomika
6 sídel, dynamické ceny (7 vrstev), reputace, diminishing returns.

### 4.7 Obchodník
Role `trader`, cestuje, prodává/grupuje.

### 4.8 Autonomie
Směrnice (focusMaterial, avoidDanger), vážený výběr.

### 4.9 Čas a stárnutí
Den = 300 s, rok = 4 sezóny. Věk od dítěte po kmeta (95 let).

### 4.10 Rodina a dynastie
Pár (vztah 70+), děti, legacy (+2 % XP za bod), generace.

### 4.11 Politika
4 frakce, 5 programů, volby, `electionsWon`.

### 4.12 Expedice (Fáze 9)
- **15 expedic** (5 základních + 10 nových)
- **Jídlo** 0,5×/postava/den, výdrž ×0,7
- **Eventy na cestě** (35% šance): loot, ztráta, zkrácení/prodloužení, zranění, XP, renomé…

### 4.13 Zakázky (Fáze 9)
- **Deliver** (8 šablon) — původní
- **Kill** (3 šablony) — poraz N nepřátel
- **Escort** (2 šablony) — doprovoď
- **Explore** (2 šablony) — prozkoumej

### 4.14 Prestiž
8 unlocků, nová mapa, generace
