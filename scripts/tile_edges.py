#!/usr/bin/env python
"""Změří, jak ostré jsou hrany MEZI TERÉNY (ne švy uvnitř dlaždice).

Proč: `scripts/check-tiles.py` měří šev uvnitř jednoho terénu (a ten je vyřešený
— dlaždice je okno do torusu). Jenže dlaždice vedle dlaždice JINÉHO terénu se
potkají dvě nesourodé textury a vznikne viditelná hrana. Přesně to je vidět
u vody/louky nebo lesa/louky.

Měří se stejnou logikou jako šev: **skok přes hranici ku zrnu textury**.
Absolutní skok nic neříká — je vidět, teprve když je výrazně větší než zrno.

    skok   průměrný rozdíl jasu mezi posledním sloupcem dlaždice A
           a prvním sloupcem dlaždice B (0–255)
    zrno   jak moc se liší sousední sloupce UVNITŘ dlaždice (vážený průměr A a B)
    poměr  skok / zrno; 1,0 = hrana není vidět víc než zrno, > 1,6 = ostrá hrana

Navíc se vypíše, na kolik se skok zmenší, když se dlaždice ve hře prolijí
(`G.AI_TILES.transition`): přechodová dlaždice ukáže 50 % A + 50 % B, takže
krok na okraji je zhruba poloviční a rozloží se přes `spread` dlaždic.

Použití:
    python scripts/tile_edges.py --dir assets/tiles
    python scripts/tile_edges.py --dir assets/tiles_drawn/final --like assets/tiles
    python scripts/tile_edges.py --dir assets/tiles --pairs        # všechny dvojice

Vyžaduje: pillow + numpy.
"""
import argparse
import glob
import os
import sys

import numpy as np
from PIL import Image

TERRAINS = ['grass', 'forest', 'deep_forest', 'hills', 'mountain',
            'water', 'swamp', 'snow', 'road', 'dirt']
EXT = ('.jpg', '.jpeg', '.png')


def lum(a):
    return 0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]


def load(directory, size=None):
    """Načte dlaždice: {terén: [pole, ...]}."""
    out = {}
    for p in sorted(glob.glob(os.path.join(directory, '*'))):
        stem, ext = os.path.splitext(os.path.basename(p))
        if ext.lower() not in EXT:
            continue
        terrain = stem.split('-')[0]
        if terrain not in TERRAINS:
            continue
        img = Image.open(p).convert('RGB')
        if size and img.width != size:
            img = img.resize((size, size), Image.LANCZOS)
        out.setdefault(terrain, []).append(lum(np.asarray(img).astype(np.float32)))
    return out


def grain(a):
    """Zrno: střední rozdíl sousedních sloupců uvnitř dlaždice (včetně obtáčení)."""
    return float((np.abs(np.diff(a, axis=1)).mean() + np.abs(np.diff(a, axis=0)).mean()) / 2)


def jump(a, b):
    """Skok přes svislou i vodorovnou hranici mezi dlaždicemi A a B."""
    v = float(np.abs(a[:, -1] - b[:, 0]).mean())    # A vlevo, B vpravo
    h = float(np.abs(a[-1, :] - b[0, :]).mean())    # A nahoře, B dole
    return (v + h) / 2


def diff_tex(a, b, shifts=4, seed=7):
    """Rozdíl dvou textur, jak se potkají ve hře.

    Hra nekreslí hranu dlaždice, ale **okno z torusu** na světových
    souřadnicích — na hranici se tedy potkají náhodné výseče obou textur.
    Proto se měří průměrný rozdíl přes několik vzájemných posunů, ne jen
    rozdíl krajních sloupců.
    """
    rng = np.random.default_rng(seed)
    n = a.shape[0]
    vals = []
    for _ in range(shifts):
        dy = int(rng.integers(0, n))
        dx = int(rng.integers(0, n))
        vals.append(float(np.abs(a - np.roll(np.roll(b, dy, axis=0), dx, axis=1)).mean()))
    return float(np.mean(vals))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', default='assets/tiles')
    ap.add_argument('--like', default=None,
                    help='adresář, podle kterého se srovnají rozměry (aby šly sady porovnat)')
    ap.add_argument('--pairs', action='store_true', help='vypíše všechny dvojice')
    ap.add_argument('--limit', type=float, default=1.6, help='limit poměru (jako check-tiles.py)')
    ap.add_argument('--size', type=int, default=192, help='na jakou velikost srovnat (0 = nativní)')
    args = ap.parse_args()

    size = None
    if args.size:
        size = args.size
        if args.like:
            ref = load(args.like)
            for lst in ref.values():
                size = lst[0].shape[0]
                break
    tiles = load(args.dir, size)
    if len(tiles) < 2:
        print('málo terénů v %s (našel jsem %d)' % (args.dir, len(tiles)))
        return 1

    g = {t: float(np.mean([grain(a) for a in lst])) for t, lst in tiles.items()}
    rows = []
    names = sorted(tiles)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            best_d, best_e = None, None
            for ta in tiles[a]:
                for tb in tiles[b]:
                    d = diff_tex(ta, tb)
                    e = jump(ta, tb)
                    if best_d is None or d > best_d:
                        best_d, best_e = d, e
            zn = (g[a] + g[b]) / 2
            rows.append((best_d / max(0.5, zn), a, b, best_d, best_e, zn))
    rows.sort(reverse=True)

    print('hrany mezi terény: %s   (velikost %d px, vše 0-255)'
          % (args.dir, size or 0))
    print('  rozdíl = jak moc se liší DVĚ TEXTURY, když se potkají (průměr přes posuny)')
    print('  hrana  = skok mezi krajními sloupci dlaždic (co by ukázal naivní renderer)')
    print()
    print('  %-13s %-13s %7s %7s %7s %7s   %s'
          % ('terén A', 'terén B', 'rozdíl', 'hrana', 'zrno', 'poměr', 'po prolnutí'))
    shown = rows if args.pairs else rows[:12]
    for ratio, a, b, d, e, zn in shown:
        flag = '   <-- OSTRÁ HRANA' if ratio > args.limit else ''
        print('  %-13s %-13s %7.1f %7.1f %7.1f %7.2f   rozdíl ~%.0f na dlaždici%s'
              % (a, b, d, e, zn, ratio, d / 2, flag))

    ratios = np.array([r[0] for r in rows])
    print('\n  dvojic: %d   průměr %.2f   medián %.2f   nejhorší %.2f (%s/%s)   nad limitem %.1f: %d/%d'
          % (len(rows), ratios.mean(), np.median(ratios), ratios.max(),
             rows[0][1], rows[0][2], args.limit, int((ratios > args.limit).sum()), len(rows)))
    print('  poznámka: „po prolnutí“ = odhad, když se dlaždice ve hře prolijí 50/50;')
    print('            přechodová zóna to pak rozloží přes několik dlaždic')
    return 0


if __name__ == '__main__':
    sys.exit(main())
