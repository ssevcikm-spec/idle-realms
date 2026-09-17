#!/usr/bin/env python
"""Změří, jak moc je dlaždice rozmazaná na středovém kříži.

Proč: `seamless_tiles.py` řeší šev posunem o polovinu a zacelením — jenže
zacelení míchá gaussovské rozostření s maskou `exp(-((x-384)/28)^2)`, takže
uprostřed dlaždice vznikne ~110 px široký rozmazaný kříž (přesně tam, kde byl
původní okraj). Při opakování dlaždice na mapě se to násobí a je to vidět.

Metrika: vysokofrekvenční energie (průměr |rozdíl sousedních pixelů|) ve pásu
kolem středu vs. medián zbytku dlaždice. 1.00 = ostré jako okolí, 0.50 = půlka
ostrosti. Bereme zvlášť svislý pruh (sloupce) a vodorovný pruh (řádky).

Použití:
    python scripts/tile_sharpness.py [adresar]
    python scripts/tile_sharpness.py assets/tiles --band 40 --limit 0.85

Výstup je tabulka + souhrn; `--limit` je mez, pod kterou je dlaždice označená
jako rozmazaná (návratový kód 1, když nějaká padne).
Vyžaduje: pillow + numpy.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

EXT = ('.jpg', '.png')


def profiles(path):
    """Vrátí (col_hf, row_hf) — energii hrany na každý sloupec/řádek."""
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32).mean(axis=2)
    col = np.abs(np.diff(a, axis=1)).mean(axis=0)      # hrana mezi x a x+1
    row = np.abs(np.diff(a, axis=0)).mean(axis=1)      # hrana mezi y a y+1
    return col, row


def band_ratio(profile, band, guard):
    """Poměr energie ve pásu kolem středu proti mediánu zbytku."""
    n = len(profile)
    c = n // 2
    lo, hi = c - band, c + band
    inner = profile[lo:hi + 1]
    mask = np.ones(n, dtype=bool)
    mask[max(0, c - guard):min(n, c + guard + 1)] = False
    ref = float(np.median(profile[mask]))
    if ref <= 1e-6:
        return 1.0, 1.0
    return float(inner.mean()) / ref, float(inner.min()) / ref


def analyze(path, band, guard):
    col, row = profiles(path)
    rc, mc = band_ratio(col, band, guard)
    rr, mr = band_ratio(row, band, guard)
    ratio = min(rc, rr)
    return {'name': os.path.basename(path), 'col': rc, 'row': rr,
            'min_col': mc, 'min_row': mr, 'ratio': ratio}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dir', nargs='?', default='assets/tiles')
    ap.add_argument('--band', type=int, default=40, help='pulka sirky pasu kolem stredu')
    ap.add_argument('--guard', type=int, default=80, help='co jeste pocitat do referencniho medianu')
    ap.add_argument('--limit', type=float, default=0.85, help='pod timhle poměrem = rozmazane')
    args = ap.parse_args()

    files = sorted(f for f in os.listdir(args.dir)
                   if f.lower().endswith(EXT) and not f.startswith('.'))
    if not files:
        print('zadne dlazdice v', args.dir)
        return 1

    print(f'{args.dir}: {len(files)} dlazdic, pas +-{args.band} px, limit {args.limit:.2f}')
    print('  %-18s %6s %6s %6s' % ('dlazdice', 'sloupce', 'radky', 'min'))
    rows = []
    for f in files:
        r = analyze(os.path.join(args.dir, f), args.band, args.guard)
        rows.append(r)
        flag = '  <-- ROZMAZANE' if r['ratio'] < args.limit else ''
        print('  %-18s %6.2f %6.2f %6.2f%s' % (r['name'], r['col'], r['row'], r['ratio'], flag))

    avg = float(np.mean([r['ratio'] for r in rows]))
    worst = min(rows, key=lambda r: r['ratio'])
    bad = [r['name'] for r in rows if r['ratio'] < args.limit]
    over = [r['name'] for r in rows if r['ratio'] > 1.05]
    print('\n  prumer %6.2f   nejhorsi %s %.2f   pod limitem %d/%d'
          % (avg, worst['name'], worst['ratio'], len(bad), len(rows)))
    print('  preostreno pres 1.05: %d/%d' % (len(over), len(rows))
          + ('  -> ' + ', '.join(over) if over else ''))
    if bad:
        print('  rozmazane: ' + ', '.join(bad))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
