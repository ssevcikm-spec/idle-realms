#!/usr/bin/env python
"""Paleta terénů — JEDINÝ ZDROJ je `js/render/art.js` (`G.PAL`).

Proč takhle: barvy terénů byly na dvou místech a rozešly se. Kresba
(`G.PAL`) a malované (AI) dlaždice se srovnávaly na jinou tabulku, takže se
stejný terén v každém vzhledu barvil jinak — naměřeno 15–38 (L2) rozdíl
(u hory 36,8 a vody 38,1). Tenhle modul paletu **parsuje z art.js**, takže
existuje jen jedna pravda; `grade_tiles.py` i `check-tiles.py` ji odsud berou.

Použití:
    from tile_palette import BASES, TARGET, TERRAINS
    TARGET['grass']  ->  [94, 112, 66]

Když se parsování nepovede, modul spadne s jasnou chybou — tichý fallback by
znamenal, že se dlaždice gradují na staré barvy a nikdo si toho nevšimne.
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'js', 'render', 'art.js')

# pořadí je stejné jako v G.PAL (a v tiles_ai.js TERRAINS)
TERRAINS = ['grass', 'forest', 'deep_forest', 'hills', 'mountain',
            'water', 'swamp', 'snow', 'road', 'dirt']

_ENTRY = re.compile(
    r"(\w+):\s*\{ base:'(#[0-9a-fA-F]{6})', dark:'(#[0-9a-fA-F]{6})', "
    r"light:'(#[0-9a-fA-F]{6})', daubs:\[([^\]]+)\]\s*\}"
)


def _hex_to_rgb(h):
    return [int(h[i:i + 2], 16) for i in (1, 3, 5)]


def load_palette(path=None):
    """Načte G.PAL z art.js: {terén: {'base':[r,g,b], 'dark':…, 'light':…, 'daubs':[[r,g,b],…]}}."""
    path = path or ART
    with open(path, encoding='utf-8') as f:
        text = f.read()
    m = re.search(r'G\.PAL = \{(.*?)\n  \};', text, re.S)
    if not m:
        raise SystemExit('tile_palette: v %s se nenašel blok G.PAL' % path)
    pal = {}
    for e in _ENTRY.finditer(m.group(1)):
        name = e.group(1)
        pal[name] = {
            'base': _hex_to_rgb(e.group(2)),
            'dark': _hex_to_rgb(e.group(3)),
            'light': _hex_to_rgb(e.group(4)),
            'daubs': [_hex_to_rgb(s.strip().strip("'"))
                      for s in e.group(5).split(',') if s.strip()],
        }
    missing = [t for t in TERRAINS if t not in pal]
    if missing:
        raise SystemExit('tile_palette: v G.PAL chybí terény: ' + ', '.join(missing))
    return pal


PALETTE = load_palette()
BASES = {t: PALETTE[t]['base'] for t in TERRAINS}
# cílový průměr pro barevné srovnání dlaždic (stejný tvar jako dřívější TARGET)
TARGET = {t: list(BASES[t]) for t in TERRAINS}


def min_distance():
    """Nejbližší dvojice terénů (L2) — čitelnost na 46 px."""
    best = (1e9, None, None)
    for i, a in enumerate(TERRAINS):
        for b in TERRAINS[i + 1:]:
            d = sum((BASES[a][k] - BASES[b][k]) ** 2 for k in range(3)) ** 0.5
            if d < best[0]:
                best = (d, a, b)
    return best


def mean_base():
    """Průměrná barva palety — referenční TÓN PROJEKTU pro ilustrace (vrstva 3)."""
    n = len(TERRAINS)
    return [sum(BASES[t][i] for t in TERRAINS) / n for i in range(3)]


def all_colors():
    """Všechny barvy palety (základ, tmavá, světlá, štětce) — pro kontrolu gamutu."""
    out = []
    for t in TERRAINS:
        e = PALETTE[t]
        out += [e['base'], e['dark'], e['light']] + list(e['daubs'])
    return out


def saturation(rgb):
    """Saturace barvy 0..1 (HSV, jen pro poměry — nezáleží na přesném modelu)."""
    r, g, b = [v / 255.0 for v in rgb]
    mx, mn = max(r, g, b), min(r, g, b)
    return 0.0 if mx <= 0 else (mx - mn) / mx


def tone():
    """Tón projektu: průměrná barva, saturace a rozsah jasu základních barev.

    Ilustrace (titul, příběhové scény, portréty) se do tohohle tónu srovnávají,
    aby hra držela jednu paletu i mimo mapu.
    """
    lum = [0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] for c in BASES.values()]
    sats = [saturation(c) for c in BASES.values()]
    return {
        'mean': mean_base(),
        'saturation': sum(sats) / len(sats),
        'lum_min': min(lum),
        'lum_max': max(lum),
    }


if __name__ == '__main__':
    print('paleta z js/render/art.js:')
    for t in TERRAINS:
        print('  %-12s %s' % (t, BASES[t]))
    d, a, b = min_distance()
    print('\nnejblizsi dvojice: %s vs %s = %.1f (L2)' % (a, b, d))
    tn = tone()
    print('ton projektu: mean %s, saturace %.2f, jas %.0f..%.0f' % (
        [round(v) for v in tn['mean']], tn['saturation'], tn['lum_min'], tn['lum_max']))
