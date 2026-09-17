#!/usr/bin/env python
"""Srovná sady dlaždic vedle sebe — a hlavně **opakované**.

Proč zvlášť vedle `compare_assets.py`: dlaždici nelze posoudit z jednoho
obrázku. Vady, které hledáme (šev, rozmazaný pruh, horizont, ústřední motiv),
jsou vidět jen tehdy, když se dlaždice zopakuje — proto se každá dlaždice vloží
do mozaiky 4×4 a zmenší. Do stránky jde i surová dlaždice 1:1, ale rozhoduje
mozaika.

Použití:
    python scripts/compare_tiles.py --old assets/tiles --new assets/tiles_kronika_tex/final
    python scripts/compare_tiles.py --old assets/tiles \\
        --new assets/tiles_kronika/final assets/tiles_kronika_tex/final \\
        --out assets/srovnani_dlazdic.html --title "Dlaždice: tři sady"

Výstup: HTML + PNG mozaiky ve `<out>/mosaic/`. Vyžaduje: pillow + numpy.
"""
import argparse
import html
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tile_palette import TERRAINS          # kanonické pořadí terénů

EXTS = ('.jpg', '.jpeg', '.png')


def find(directory, stem):
    for e in EXTS:
        p = os.path.join(directory, stem + e)
        if os.path.exists(p):
            return p
    return None


def mosaic(path, scale, repeat):
    """Zmenší dlaždici a zopakuje ji do mřížky (tam se šev i motiv ukážou)."""
    with Image.open(path) as im:
        t = im.convert('RGB').resize((scale, scale), Image.LANCZOS)
    return Image.fromarray(np.tile(np.asarray(t), (repeat, repeat, 1)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--old', required=True, help='referencni sada (obvykle assets/tiles)')
    ap.add_argument('--new', required=True, nargs='+', help='jedna nebo vic kandidatskych sad')
    ap.add_argument('--out', default=None, help='kam zapsat HTML (výchozí <new[0]>/srovnani.html)')
    ap.add_argument('--title', default='Dlaždice: srovnání sad')
    ap.add_argument('--label-old', default='ve hře')
    ap.add_argument('--label-new', default=None,
                    help='popisek, kdyz je kandidatska sada jen jedna (jinak nazev adresare)')
    ap.add_argument('--scale', type=int, default=128, help='velikost jedne dlazdice v mozaice (px)')
    ap.add_argument('--repeat', type=int, default=4, help='kolikrat se dlazdice zopakuje')
    ap.add_argument('--variants', type=int, default=2, help='kolik textur na teren srovnavat')
    args = ap.parse_args()

    out = args.out or os.path.join(args.new[0], 'srovnani.html')
    out_dir = os.path.dirname(out) or '.'
    mos_dir = os.path.join(out_dir, 'mosaic')
    os.makedirs(mos_dir, exist_ok=True)
    rel = lambda p: os.path.relpath(p, out_dir).replace('\\', '/')

    cols = [(args.old, args.label_old)]
    for i, d in enumerate(args.new):
        label = args.label_new if (args.label_new and len(args.new) == 1) \
            else os.path.basename(os.path.normpath(d))
        cols.append((d, label))

    rows, missing = [], []
    for terrain in TERRAINS:
        for v in range(1, args.variants + 1):
            stem = '%s-%d' % (terrain, v)
            cells, gone = [], False
            for i, (directory, _) in enumerate(cols):
                path = find(directory, stem)
                if not path:
                    gone = True
                    cells.append(None)
                    continue
                dst = os.path.join(mos_dir, 'c%d_%s.png' % (i, stem))
                mosaic(path, args.scale, args.repeat).save(dst)
                cells.append((rel(dst), rel(path)))
            if gone:
                missing.append(stem)
            rows.append((stem, cells))

    with open(out, 'w', encoding='utf-8') as f:
        f.write(
            '<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>%s</title>'
            '<style>body{background:#1b1a17;color:#ded6c4;font:14px system-ui;margin:16px}'
            'h1{font-size:19px}table{border-collapse:collapse}'
            'td,th{padding:8px 12px;vertical-align:top;text-align:left;border-bottom:1px solid #2c2820}'
            'img{display:block;background:#111;border:1px solid #3a352a;border-radius:3px}'
            'small{color:#9b9483}code{background:#252217;padding:1px 5px;border-radius:3px}'
            '.miss{color:#e08a7a}</style></head><body>'
            '<h1>%s</h1>'
            '<p>Každá dlaždice je zopakovaná <b>%d×%d</b> a zmenšená na %d px — '
            'tak je vidět šev, rozmazaný pruh, horizont i ústřední motiv '
            '(v jednom obrázku je nepoznáš). Pod mozaikou je dlaždice 1:1. '
            'Sloupce: %s.</p><table><tr><th>dlaždice</th>%s</tr>'
            % (html.escape(args.title), html.escape(args.title), args.repeat, args.repeat,
               args.scale,
               ', '.join('<b>%s</b> (<code>%s</code>)' % (html.escape(l), html.escape(d))
                         for d, l in cols),
               ''.join('<th>%s<br><small><code>%s</code></small></th>' % (html.escape(l), html.escape(d))
                       for d, l in cols)))
        for stem, cells in rows:
            f.write('<tr><td><code>%s</code></td>' % html.escape(stem))
            for cell in cells:
                if cell:
                    mos, raw = cell
                    f.write('<td><img src="%s" style="max-height:230px">'
                            '<small>mozaika %d×%d</small>'
                            '<img src="%s" style="max-width:230px">'
                            '<small>1:1</small></td>' % (mos, args.repeat, args.repeat, raw))
                else:
                    f.write('<td><span class="miss">chybí</span></td>')
            f.write('</tr>')
        f.write('</table></body></html>')

    print('srovnani: %d dlazdic, %d sad -> %s' % (len(rows), len(cols), out))
    if missing:
        print('chybi na jedne strane (%d): %s' % (len(missing), ', '.join(missing)))
    return 0 if rows else 1


if __name__ == '__main__':
    sys.exit(main())
