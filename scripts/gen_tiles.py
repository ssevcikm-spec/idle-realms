#!/usr/bin/env python
"""Vygeneruje dlaždice mapy přes Pollinations (zdarma, bez klíče).

Proč zvlášť vedle `gen_tiles_local.py`: ten jede na lokálním ComfyUI (RX 6600,
~105 s na dlaždici). Tenhle je online varianta — rychlejší na vyzkoušení motivu,
ale kvalita je méně předvídatelná. Stejné předměty terénů i stejná stavba
promptu (bezešvá textura, žádný ústřední motiv), jen s možností přidat styl
balíčku.

Výstup jsou **surové** textury do zadaného adresáře; teprve pak se ladí barva
a tvar:
    python scripts/gen_tiles.py --style kronika --out assets/tiles_kronika
    python scripts/grade_tiles.py assets/tiles_kronika assets/tiles_kronika
    python scripts/seamless_tiles.py --dir assets/tiles_kronika
    python scripts/check-tiles.py --dir assets/tiles_kronika --scheme sliding --repeat 6
    python scripts/compare_assets.py --old assets/tiles --new assets/tiles_kronika

Vyžaduje: pillow (+ numpy u navazujících skriptů) — venv ComfyUI + internet.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_props import fetch, STYLE_KRONIKA          # stejné stahování jako u prvků
from gen_tiles_local import TERRAINS, NEG, prompt_for   # stejné předměty i stavba promptu

W, H = 768, 768
SEED = 7000


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='assets/tiles_kronika')
    ap.add_argument('--variants', type=int, default=2, help='textur na terén (hra čeká 1 a 2)')
    ap.add_argument('--style', default='kronika', choices=['plain', 'kronika'])
    ap.add_argument('--only', default='', help='jen tyto terény (čárkou)')
    ap.add_argument('--seed', type=int, default=SEED)
    args = ap.parse_args()

    want = [s.strip() for s in args.only.split(',') if s.strip()]
    terrains = [t for t in TERRAINS if not want or t in want]
    if not terrains:
        print('neznamy teren; zname: ' + ', '.join(TERRAINS))
        return 1

    os.makedirs(args.out, exist_ok=True)
    print('generuji %d terenu x %d textur (%s) -> %s' % (
        len(terrains), args.variants, args.style, args.out), flush=True)
    ok, failed = 0, []
    for i, terrain in enumerate(terrains):
        subject = TERRAINS[terrain]
        # krátký prompt: Pollinations odřezává dlouhé (docs/STYL_GRAFIKY.md §8)
        prompt = '%s, %s' % (prompt_for(subject), STYLE_KRONIKA if args.style == 'kronika' else '')
        prompt = prompt.strip().rstrip(',')
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
        print('  python scripts/check-tiles.py --dir %s --scheme sliding --repeat 6' % args.out, flush=True)
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
