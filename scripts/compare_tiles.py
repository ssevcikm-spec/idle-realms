#!/usr/bin/env python
"""Srovná dvě sady dlaždic vedle sebe — a hlavně **opakované**.

Proč zvlášť vedle `compare_assets.py`: dlaždici nelze posoudit z jednoho
obrázku. Vada, kterou hledáme (šev, rozmazaný pruh, perioda), je vidět jen
tehdy, když se dlaždice zopakuje — proto se každá dlaždice vloží do mozaiky
4×4 a zmenší se na čitelnou velikost. Do stránky se dá i surová dlaždice
v náhledu, ale rozhoduje mozaika.

Použití:
    python scripts/compare_tiles.py --old assets/tiles --new assets/tiles_kronika
    python scripts/compare_tiles.py --old a --new b --out b/srovnani.html \\
        --title "Dlaždice: kronika vs. nové" --scale 128

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
    """Zmenší dlaždici a zopakuje ji do mřížky (tam se šev ukáže)."""
    with Image.open(path) as im:
        t = im.convert('RGB').resize((scale, scale), Image.LANCZOS)
    a = np.asarray(t)
    return Image.fromarray(np.tile(a, (repeat, repeat, 1)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--old', required=True)
    ap.add_argument('--new', required=True)
    ap.add_argument('--out', default=None, help='kam zapsat HTML (výchozí <new>/srovnani.html)')
    ap.add_argument('--title', default='Dlaždice: srovnání sad')
    ap.add_argument('--label-old', default='ve hře')
    ap.add_argument('--label-new', default='nové')
    ap.add_argument('--scale', type=int, default=128, help='velikost jedne dlazdice v mozaice (px)')
    ap.add_argument('--repeat', type=int, default=4, help='kolikrat se dlazdice zopakuje')
    ap.add_argument('--variants', type=int, default=2, help='kolik textur na teren srovnavat')
    args = ap.parse_args()

    out = args.out or os.path.join(args.new, 'srovnani.html')
    out_dir = os.path.dirname(out) or '.'
    mos_dir = os.path.join(out_dir, 'mosaic')
    os.makedirs(mos_dir, exist_ok=True)
    rel = lambda p: os.path.relpath(p, out_dir).replace('\\', '/')

    rows, missing = [], []
    for terrain in TERRAINS:
        for v in range(1, args.variants + 1):
            stem = '%s-%d' % (terrain, v)
            o, n = find(args.old, stem), find(args.new, stem)
            if not o or not n:
                missing.append(stem)
            cells = {}
            for tag, path in (('old', o), ('new', n)):
                if not path:
                    continue
                dst = os.path.join(mos_dir, '%s_%s.png' % (tag, stem))
                mosaic(path, args.scale, args.repeat).save(dst)
                cells[tag] = (rel(dst), rel(path))
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
            'tak je vidět šev i rozmazaný pruh (v jednom obrázku je nepoznáš). '
            'Nahoře je vždy dlaždice 1:1. Vlevo <b>%s</b> (<code>%s</code>), '
            'vpravo <b>%s</b> (<code>%s</code>).</p>'
            '<table><tr><th>dlaždice</th><th>%s — 1:1 + mozaika</th>'
            '<th>%s — 1:1 + mozaika</th></tr>'
            % (html.escape(args.title), html.escape(args.title), args.repeat, args.repeat,
               args.scale, html.escape(args.label_old), html.escape(args.old),
               html.escape(args.label_new), html.escape(args.new),
               html.escape(args.label_old), html.escape(args.label_new)))
        for stem, cells in rows:
            f.write('<tr><td><code>%s</code></td>' % html.escape(stem))
            for tag in ('old', 'new'):
                if tag in cells:
                    mos, raw = cells[tag]
                    f.write('<td><img src="%s" style="max-height:230px">'
                            '<small>mozaika</small><img src="%s" style="max-width:230px">'
                            '<small>1:1</small></td>' % (mos, raw))
                else:
                    f.write('<td><span class="miss">chybí</span></td>')
            f.write('</tr>')
        f.write('</table></body></html>')

    print('srovnani: %d dlazdic -> %s' % (len(rows), out))
    if missing:
        print('chybi na jedne strane (%d): %s' % (len(missing), ', '.join(missing)))
    return 0 if rows else 1


if __name__ == '__main__':
    sys.exit(main())
