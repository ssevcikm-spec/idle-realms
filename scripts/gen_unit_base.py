#!/usr/bin/env python
"""Vygeneruje JEDEN základní sprite postavy (bez zbraně) do assets/units/base.png.

Koncept od uživatele: všichni na jednom základním modelu, roli nese erb kreslený
v kódu (`G.drawFigureHeraldry`) a na modelu je jen zbroj/oblečení — žádná zbraň.
Kreslený vzhled to už umí; tenhle skript dodá základ i pro **malované** postavy
(místo šesti archetypů se zbraněmi).

Postup je stejný jako u krajinných prvků (`scripts/gen_props.py`): Pollinations
(zdarma, bez klíče) -> vyříznutí pozadí -> výběr nejlepšího kandidáta. Navíc se
u postav kontroluje **výška vs. šířka** (postava má být vysoká a úzká, ne
rozložená scéna).

Použití:
    python scripts/gen_unit_base.py --candidates 4
    python scripts/grade_art.py --in assets/units --out assets/units
    python scripts/check-art.py --dir assets/units --mode props

Vyžaduje: pillow, numpy, scipy (venv ComfyUI) + internet.
"""
import argparse
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_props import cutout, fetch   # stejná logika vyříznutí jako u prvků

DST = 'assets/units'
NAME = 'base'
TARGET_H = 96
# Na výšku orientované plátno + důraz na „celá postava, jeden člověk": na
# čtverci model vyrobí širokou scénu (naměřeno: poměr 1,0–1,3 místo < 0,8).
PROMPT = ('full body standing medieval peasant, one person only, head to feet, front view, '
          'plain linen tunic and leather belt, no weapon, empty hands, muted earthy colors, '
          'game character sprite, plain flat cream background, no shadow, no text')
W, H = 384, 768


def score_unit(spr):
    """Postava má být vysoká a úzká; rozložená = model dal scénu."""
    from gen_props import score
    base, info = score(spr, spr.size)
    if base < 0:
        return base, info
    ar = spr.width / spr.height
    info['pomer'] = round(ar, 2)
    if ar > 0.80:                      # širší než vysoká = nejspíš ne postava
        return -1.0, dict(info, duvod='moc siroky (pomer %.2f)' % ar)
    if ar < 0.10:
        return -1.0, dict(info, duvod='moc uzky (pomer %.2f)' % ar)
    return base + 0.4 * (0.80 - ar), info     # užší poměr = lepší skóre


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--candidates', type=int, default=4)
    ap.add_argument('--seed', type=int, default=2000)
    ap.add_argument('--out', default=DST)
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    print('generuji zakladni postavu (%d kandidatu) -> %s/%s.png' % (
        args.candidates, args.out, NAME))
    best, best_score, best_info, best_seed = None, -1.0, {}, None
    for i in range(args.candidates):
        seed = args.seed + i * 7
        img = fetch(PROMPT, seed, w=W, h=H)
        if img is None:
            continue
        spr = cutout(img)
        if spr is None:
            print('    seed %-5d vyriznuti selhalo' % seed)
            continue
        sc, info = score_unit(spr)
        print('    seed %-5d skore %5.2f  %s' % (seed, sc, info))
        if sc > best_score:
            best, best_score, best_info, best_seed = spr, sc, info, seed

    if best is None or best_score <= 0:
        print('NEVYBRANO: zadny pouzitelny kandidat (zkus --candidates vic nebo jiny --seed)')
        return 1
    tw = max(1, round(best.width * TARGET_H / best.height))
    best.resize((tw, TARGET_H), Image.LANCZOS).save(os.path.join(args.out, NAME + '.png'))
    print('  OK  seed %d, %dx%d px  %s' % (best_seed, tw, TARGET_H, best_info))
    print('\ndalší krok: python scripts/grade_art.py --in %s --out %s' % (args.out, args.out))
    print('            python scripts/check-art.py --dir %s --mode props' % args.out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
