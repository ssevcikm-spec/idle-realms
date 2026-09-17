#!/usr/bin/env python
"""Změří, jak moc je dlaždice rozmazaná na středovém kříži (kde byl původní šev).

Proč: `seamless_tiles.py` řeší šev posunem o polovinu a zacelením — jenže
zacelení míchá gaussovské rozostření, takže uprostřed dlaždice vznikne rozmazaný
kříž (přesně tam, kde po posunu ležel původní okraj). Při opakování na mapě se to
násobí. Naměřeno: 20/20 dlaždic mělo 0,47 ostrosti okolí.

Dva režimy:

1. **Bez `--ref`** — poměr energie hrany v pásu kolem středu proti **mediánu
   zbytku dlaždice**. Rychlé, ale u nehomogenních textur (les, hory) měří spíš
   obsah než vadu: když je prostředek dlaždice od přírody hladší, vyjde „rozmazaná"
   i dlaždice, se kterou hojení nic neudělalo.
2. **S `--ref <adresar>`** — reference je **tatáž dlaždice před zacelením** (raw),
   posunutá o polovinu, měřená na **stejném místě** mediánem pásu (medián proto,
   že v raw dlaždici je přesně ve středu jednopixelový schod). Odpovídá to na
   správnou otázku: *kolik detailu tu hojení ubralo*. Tohle je směrodatné číslo.

Použití:
    python scripts/tile_sharpness.py assets/tiles
    python scripts/tile_sharpness.py assets/tiles_kronika/final --ref assets/tiles_kronika/raw

Vyžaduje: pillow + numpy. Návratový kód 1, když je něco pod `--limit`.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

EXT = ('.jpg', '.jpeg', '.png')


def profiles(path):
    """(col, row) — energie hrany na každý sloupec/řádek."""
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32).mean(axis=2)
    return (np.abs(np.diff(a, axis=1)).mean(axis=0),
            np.abs(np.diff(a, axis=0)).mean(axis=1))


def rolled_profiles(path):
    """Totéž, ale pro dlaždici posunutou o polovinu (raw = bez zacelení)."""
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32).mean(axis=2)
    r = np.roll(np.roll(a, a.shape[1] // 2, axis=1), a.shape[0] // 2, axis=0)
    return (np.abs(np.diff(r, axis=1)).mean(axis=0),
            np.abs(np.diff(r, axis=0)).mean(axis=1))


def band_slice(n, band):
    c = n // 2
    return slice(max(0, c - band), c + band + 1), c


def rest_median(profile, guard):
    n = len(profile)
    c = n // 2
    mask = np.ones(n, dtype=bool)
    mask[max(0, c - guard):min(n, c + guard + 1)] = False
    return float(np.median(profile[mask]))


def analyze(path, band, guard, ref_path=None):
    col, row = profiles(path)
    out = {'name': os.path.basename(path), 'mode': 'ref' if ref_path else 'median'}
    ratios = []
    for prof, key in ((col, 'col'), (row, 'row')):
        sl, _ = band_slice(len(prof), band)
        got = float(prof[sl].mean())
        if ref_path:
            rcol, rrow = rolled_profiles(ref_path)
            rprof = rcol if key == 'col' else rrow
            # medián pásu v referenci: v raw dlaždici je přesně ve středu
            # jednopixelový schod po posunu a ten by průměr vychýlil
            want = float(np.median(rprof[sl]))
        else:
            want = rest_median(prof, guard)
        out[key] = got / want if want > 1e-6 else 1.0
        ratios.append(out[key])
    out['ratio'] = min(ratios)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dir', nargs='?', default='assets/tiles')
    ap.add_argument('--ref', default=None,
                    help='adresar s raw (nezacelenymi) dlazdicemi — obsahova reference')
    ap.add_argument('--band', type=int, default=40, help='pulka sirky pasu kolem stredu')
    ap.add_argument('--guard', type=int, default=80, help='co jeste patri do medianu zbytku')
    ap.add_argument('--limit', type=float, default=0.85, help='pod timhle poměrem = rozmazane')
    args = ap.parse_args()

    files = sorted(f for f in os.listdir(args.dir)
                   if f.lower().endswith(EXT) and not f.startswith('.'))
    if not files:
        print('zadne dlazdice v', args.dir)
        return 1

    where = ('ref ' + args.ref) if args.ref else 'median zbytku'
    print(f'{args.dir}: {len(files)} dlazdic, pas +-{args.band} px, reference: {where}')
    print('  %-18s %6s %6s %6s' % ('dlazdice', 'sloupce', 'radky', 'min'))
    rows = []
    for f in files:
        ref = None
        if args.ref:
            for e in EXT:
                p = os.path.join(args.ref, os.path.splitext(f)[0] + e)
                if os.path.exists(p):
                    ref = p
                    break
            if ref is None:
                print('  %-18s chybi v %s' % (f, args.ref))
                continue
        r = analyze(os.path.join(args.dir, f), args.band, args.guard, ref)
        rows.append(r)
        flag = '  <-- ROZMAZANE' if r['ratio'] < args.limit else ''
        print('  %-18s %6.2f %6.2f %6.2f%s' % (r['name'], r['col'], r['row'], r['ratio'], flag))

    if not rows:
        print('nic ke srovnani')
        return 1
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
