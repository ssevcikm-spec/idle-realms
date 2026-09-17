#!/usr/bin/env python
"""Vygeneruje dlaždice mapy přes Pollinations (zdarma, bez klíče).

Proč zvlášť vedle `gen_tiles_local.py`: ten jede na lokálním ComfyUI (RX 6600,
~105 s na dlaždici). Tenhle je online varianta — rychlejší na vyzkoušení motivu,
ale kvalita je méně předvídatelná. Stejné předměty terénů jako `gen_tiles_local.py`.

**Styl se musí popsat jako textura, ne jako ilustrace.** Když se na dlaždici
použil ilustrační stylový blok („chronicle illustration style, ink linework"),
model místo ploché textury vyrobil **ilustraci krajiny** — horizont, oblohu,
ústřední motiv (13 z 20 dlaždic, měřeno `tile_flatness.py`; nasazená sada bez
stylu 0 z 20). Proto `--style kronika-tex`: týž motiv, ale popsaný jako plochá
textura. Rozdíl se měří, ne odhaduje.

Druhá past: **Pollinations odřezává dlouhé prompty** (~350 znaků). Prompt se proto
skládá krátce a skript vypíše jeho délku, ať je vidět, když přeteče.

Meziprodukty se **nechávají** (past 30 v HANDOFF.md) — bez nezacelené dlaždice
nelze přeladit dávku textury ani změřit obsahovou ostrost. Sada kandidátů proto
drží `raw/` → `graded/` → `final/`:

    python scripts/gen_tiles.py --style kronika-tex --out assets/tiles_kronika_tex/raw
    python scripts/grade_tiles.py assets/tiles_kronika_tex/raw assets/tiles_kronika_tex/graded
    python scripts/seamless_tiles.py --dir assets/tiles_kronika_tex/graded --out assets/tiles_kronika_tex/final
    python scripts/check-tiles.py --dir assets/tiles_kronika_tex/final --scheme sliding --repeat 6
    python scripts/tile_flatness.py assets/tiles_kronika_tex/final
    python scripts/tile_sharpness.py assets/tiles_kronika_tex/final --ref assets/tiles_kronika_tex/raw
    python scripts/compare_tiles.py --old assets/tiles --new assets/tiles_kronika_tex/final

Vyžaduje: pillow (+ numpy u navazujících skriptů) — venv ComfyUI + internet.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_props import fetch                    # stejné stahování jako u prvků
from gen_tiles_local import TERRAINS           # stejné předměty terénů

W, H = 768, 768
SEED = 7000

# Styl = jen to, co se přidá za texturu terénu; prázdný = bez stylu.
STYLES = {
    'plain': '',
    # ilustrační podání kroniky: u dlaždic propadlo (dělá z textury scenérii)
    'kronika': ('old chronicle illustration style, sepia and olive ink linework '
                'with hatching'),
    # týž motiv, ale popsaný jako textura (viz docstring a §8.6)
    'kronika-tex': ('grim medieval ink linework and hatching, desaturated sepia '
                    'and olive earth tones'),
}


def prompt_texture(subject, style=''):
    """Krátký prompt na **plochou** texturu (drží se do ~350 znaků)."""
    base = ('Seamless tileable %s texture, top-down orthographic ground texture '
            'for a 2D game map, flat even lighting, no horizon, no sky, no central '
            'object, no vignette, no border, uniform detail readable at 46x46 px'
            % subject)
    return (base + (', ' + style if style else '')).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='assets/tiles_kronika/raw')
    ap.add_argument('--variants', type=int, default=2, help='textur na terén (hra čeká 1 a 2)')
    ap.add_argument('--style', default='plain', choices=list(STYLES),
                    help='kronika-tex = motiv kroniky popsaný jako textura')
    ap.add_argument('--only', default='', help='jen tyto terény (čárkou)')
    ap.add_argument('--seed', type=int, default=SEED)
    args = ap.parse_args()

    want = [s.strip() for s in args.only.split(',') if s.strip()]
    terrains = [t for t in TERRAINS if not want or t in want]
    if not terrains:
        print('neznamy teren; zname: ' + ', '.join(TERRAINS))
        return 1

    os.makedirs(args.out, exist_ok=True)
    style = STYLES[args.style]
    print('generuji %d terenu x %d textur (styl %s) -> %s' % (
        len(terrains), args.variants, args.style, args.out), flush=True)
    ok, failed = 0, []
    for i, terrain in enumerate(terrains):
        prompt = prompt_texture(TERRAINS[terrain], style)
        note = ' POZOR: prompt je dlouhy, Pollinations ho odrizne' if len(prompt) > 350 else ''
        print('  [%s] prompt %d znaku%s' % (terrain, len(prompt), note), flush=True)
        for v in range(1, args.variants + 1):
            seed = args.seed + i * 137 + v * 1000
            img = fetch(prompt, seed, w=W, h=H)
            if img is None:
                failed.append('%s-%d' % (terrain, v))
                print('  %-12s -%d  stazeni selhalo' % (terrain, v), flush=True)
                continue
            dst = os.path.join(args.out, '%s-%d.jpg' % (terrain, v))
            img.convert('RGB').save(dst, quality=92)
            ok += 1
            print('  %-12s -%d  OK  seed %d  (%d kB)' % (
                terrain, v, seed, os.path.getsize(dst) // 1024), flush=True)

    print('\nhotovo: %d textur' % ok, flush=True)
    if failed:
        print('selhalo: ' + ', '.join(failed), flush=True)
    if ok:
        print('další kroky:', flush=True)
        print('  python scripts/grade_tiles.py %s %s' % (args.out, args.out), flush=True)
        print('  python scripts/seamless_tiles.py --dir %s' % args.out, flush=True)
        print('  python scripts/tile_flatness.py %s' % args.out, flush=True)
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
