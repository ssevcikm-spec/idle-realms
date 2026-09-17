#!/usr/bin/env python
"""Srovná dlaždici na plochu texturu — odečte z ní velké plochy (kompozici).

Proč: generátor obrázků občas místo ploché textury vyrobí **scénu** — horizont
s oblohou, ústřední motiv, vinětaci. To je přesně to, co metrika
`tile_flatness.py` měří (`horizont`, `stred`) a co dlaždici zabíjí: v mozaice se
motiv násobí. Naměřeno: kandidáti kroniky 13/20, přičemž nasazená sada 0/20.

Horizont, obloha i ústřední motiv jsou ale **nízké frekvence** — velké plochy.
Když se z dlaždice odečte silně rozmazaná verze a připočte se zpátky průměr,
zůstane jen **textura**: charakter povrchu (zrno, hmat, šrafování) ano, kompozice
ne. Velké plochy pak dodává až foundry ve světových souřadnicích (§11), což je
stejně cílový stav — dlaždice nemá velké plochy nést.

Pořadí v pipeline: `gen` → **`flatten`** → `grade_tiles.py` (barva na paletu) →
`seamless_tiles.py` (zacelení švu). Flatten je jen lokální operace, takže se
bezešvost dopočítá až po něm.

Použití:
    python scripts/flatten_tiles.py assets/x/raw assets/x/flat --radius 64
    python scripts/tile_flatness.py assets/x/flat

Vyžaduje: pillow + numpy.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

EXT = ('.jpg', '.jpeg', '.png')


def flatten(arr, radius):
    """Odečte rozmazanou kopii (velké plochy) a vrátí průměr zpátky."""
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    low = np.asarray(img.filter(ImageFilter.GaussianBlur(radius))).astype(np.float32)
    return arr - low + arr.mean(axis=(0, 1), keepdims=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--radius', type=float, default=64.0,
                    help='od jake velikosti ploch se odectou (px; vetsi = agresivnejsi)')
    ap.add_argument('--strength', type=float, default=1.0,
                    help='1 = plne odecteni kompozice, 0 = bez zmeny')
    ap.add_argument('--quality', type=int, default=95)
    args = ap.parse_args()

    files = sorted(f for f in os.listdir(args.src)
                   if f.lower().endswith(EXT) and not f.startswith('.'))
    if not files:
        print('zadne dlazdice v', args.src)
        return 1
    os.makedirs(args.dst, exist_ok=True)

    print('srovnavam %d dlazdic na texturu (radius %.0f px, sila %.2f) -> %s'
          % (len(files), args.radius, args.strength, args.dst))
    for f in files:
        a = np.asarray(Image.open(os.path.join(args.src, f)).convert('RGB')).astype(np.float32)
        flat = a + (flatten(a, args.radius) - a) * args.strength
        out = os.path.join(args.dst, os.path.splitext(f)[0] + '.jpg')
        Image.fromarray(np.clip(flat, 0, 255).astype(np.uint8)).save(out, quality=args.quality)
        before = float(a.std())
        after = float(flat.std())
        print('  %-18s odchylka velkych ploch %5.2f -> %5.2f' % (f, before, after))
    print('\nHOTOVO - dal: grade_tiles.py, seamless_tiles.py, tile_flatness.py')
    return 0


if __name__ == '__main__':
    sys.exit(main())
