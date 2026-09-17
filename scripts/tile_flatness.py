#!/usr/bin/env python
"""Pozná dlaždici, která není plocha textura, ale **obrázek scény**.

Proč: generátor obrázků občas místo textury kolmo shora vyrobí krajinu z boku
(horizont, obloha) nebo obrázek s ústředním motivem. Všechny ostatní metriky
(`wrap`, `seam/zrno`, `tile_sharpness`, barva vs. cíl) takovou dlaždici **chválí**
— je ostrá, bezešvá a v paletě. Gemini vision to pozná, ale je to nekonzistentní
svědek; tohle je číslo.

Tři znaky (normalizované na 0–1, počítané na jasu po silném rozmazání, které
smaže texturu a nechá jen velké plochy):

- `horizont` — rozdíl průměru horní a dolní čtvrtiny. Obloha nahoře / zem dole.
              **Tohle je hlavní znak bočního pohledu.**
- `stred`    — rozdíl průměru středu proti rohům. Ústřední motiv místo textury.
- `makro`    — směrodatná odchylka velkých ploch. Jen informativní: **mezi
              přijatou a odmítnutou sadou nerozlišuje** (přijatá sada měla 0,108,
              kandidáti 0,118), proto má volný limit.

Limity jsou **kalibrované na sadě, kterou uživatel přijal** (`assets/tiles`):
nejhorší horizont 0,023 a střed 0,059 → limit 0,045 / 0,075 s rezervou.
Naměřeno na kandidátech kroniky: horizont až 0,151, střed až 0,334.

Použití:
    python scripts/tile_flatness.py assets/tiles
    python scripts/tile_flatness.py assets/tiles_kronika/final

Vyžaduje: pillow + numpy.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

EXT = ('.jpg', '.jpeg', '.png')


def features(path, blur=24):
    with Image.open(path) as im:
        g = im.convert('L').resize((256, 256), Image.LANCZOS)
    b = np.asarray(g.filter(ImageFilter.GaussianBlur(blur / 3.0))).astype(np.float32) / 255.0
    h, w = b.shape
    q = h // 4
    macro = float(b.std())
    horizon = abs(float(b[:q].mean()) - float(b[-q:].mean()))
    r = 40
    mid = float(b[h // 2 - r:h // 2 + r, w // 2 - r:w // 2 + r].mean())
    corners = float(np.mean([b[:r, :r].mean(), b[:r, -r:].mean(),
                             b[-r:, :r].mean(), b[-r:, -r:].mean()]))
    return macro, horizon, abs(mid - corners)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dir', nargs='?', default='assets/tiles')
    ap.add_argument('--macro', type=float, default=0.12, help='limit pro makro variaci (volny)')
    ap.add_argument('--horizon', type=float, default=0.045, help='limit pro horizont')
    ap.add_argument('--stred', type=float, default=0.075, help='limit pro stredni motiv')
    args = ap.parse_args()

    files = sorted(f for f in os.listdir(args.dir)
                   if f.lower().endswith(EXT) and not f.startswith('.'))
    if not files:
        print('zadne dlazdice v', args.dir)
        return 1

    print(f'{args.dir}: {len(files)} dlazdic '
          f'(limity makro {args.macro}, horizont {args.horizon}, stred {args.stred})')
    print('  %-18s %7s %8s %7s' % ('dlazdice', 'makro', 'horizont', 'stred'))
    bad = []
    for f in files:
        macro, horizon, mid = features(os.path.join(args.dir, f))
        why = []
        if macro > args.macro:
            why.append('makro')
        if horizon > args.horizon:
            why.append('horizont')
        if mid > args.stred:
            why.append('stred')
        if why:
            bad.append((f, why))
        print('  %-18s %7.3f %8.3f %7.3f%s'
              % (f, macro, horizon, mid, ('  <-- ' + '+'.join(why)) if why else ''))

    print('\n  vypada jako scena (ne plocha textura): %d/%d' % (len(bad), len(files)))
    for f, why in bad:
        print('    %-18s %s' % (f, '+'.join(why)))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
