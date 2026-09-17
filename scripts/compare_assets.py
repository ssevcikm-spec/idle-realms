#!/usr/bin/env python
"""Srovná dvě sady assetů vedle sebe (staré vs nové) do jedné HTML stránky.

Proč: vkus se měří špatně — metriky (`check-art.py`, `check-tiles.py`) řeknou,
jestli obrázek drží paletu a není plochý, ale ne jestli se ti líbí. Tenhle
nástroj udělá kontaktní list „vlevo staré, vpravo nové" pro každý druh, takže se
výměna dá posoudit okem a jedním kliknutím.

Použití:
    python scripts/compare_assets.py --old assets/props --new assets/props_kronika
    python scripts/compare_assets.py --old a --new b --out srovnani/index.html \
        --title "Prvky: neutrální vs kronika"

Vyžaduje: pillow (venv ComfyUI).
"""
import argparse
import glob
import html
import os
import sys

from PIL import Image

EXTS = ('.png', '.jpg', '.jpeg')


def collect(d):
    out = {}
    if not os.path.isdir(d):
        return out
    for f in sorted(glob.glob(os.path.join(d, '*.*'))):
        if f.lower().endswith(EXTS):
            out[os.path.splitext(os.path.basename(f))[0]] = f
    return out


def size_of(path):
    try:
        with Image.open(path) as im:
            return '%d×%d' % im.size
    except Exception:
        return '?'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--old', required=True)
    ap.add_argument('--new', required=True)
    ap.add_argument('--out', default=None, help='kam zapsat HTML (výchozí <new>/index.html)')
    ap.add_argument('--title', default='Srovnání assetů')
    ap.add_argument('--label-old', default='staré')
    ap.add_argument('--label-new', default='nové')
    args = ap.parse_args()

    old, new = collect(args.old), collect(args.new)
    keys = sorted(set(old) | set(new))
    if not keys:
        print('v zadnem adresari nejsou obrazky')
        return 1

    out = args.out or os.path.join(args.new, 'index.html')
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    rel = lambda p: os.path.relpath(p, os.path.dirname(out) or '.').replace('\\', '/')

    missing = [k for k in keys if k not in old or k not in new]
    with open(out, 'w', encoding='utf-8') as f:
        f.write('<!doctype html><html lang="cs"><head><meta charset="utf-8">'
                '<title>%s</title><style>'
                'body{background:#1b1a17;color:#ded6c4;font:14px system-ui;margin:16px}'
                'h1{font-size:19px}td,th{padding:6px 10px;vertical-align:middle;text-align:left}'
                'tr:nth-child(even){background:#211f1a}'
                'img{max-height:150px;background:#111;border:1px solid #3a352a;border-radius:3px}'
                '.miss{color:#e08a7a}code{background:#252217;padding:1px 5px;border-radius:3px}'
                '</style></head><body>'
                '<h1>%s</h1><p>Vlevo <b>%s</b> (<code>%s</code>), vpravo <b>%s</b> '
                '(<code>%s</code>). Když se ti nová sada líbí, řekni a nasadím ji '
                '(přepíšu soubory + proženu <code>grade_art.py</code> a '
                '<code>check-art.py</code>).</p>'
                '<table><tr><th>druh</th><th>%s</th><th>%s</th></tr>'
                % (html.escape(args.title), html.escape(args.title), html.escape(args.label_old),
                   html.escape(args.old), html.escape(args.label_new), html.escape(args.new),
                   html.escape(args.label_old), html.escape(args.label_new)))
        for k in keys:
            o = ('<img src="%s"><br><small>%s</small>' % (rel(old[k]), size_of(old[k]))) if k in old \
                else '<span class="miss">chybí</span>'
            n = ('<img src="%s"><br><small>%s</small>' % (rel(new[k]), size_of(new[k]))) if k in new \
                else '<span class="miss">chybí</span>'
            f.write('<tr><td><code>%s</code></td><td>%s</td><td>%s</td></tr>'
                    % (html.escape(k), o, n))
        f.write('</table></body></html>')

    print('srovnani: %d druhu (%d chybi na jedne strane) -> %s' % (len(keys), len(missing), out))
    return 0


if __name__ == '__main__':
    sys.exit(main())
