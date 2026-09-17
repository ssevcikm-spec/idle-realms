#!/usr/bin/env python
"""Vygeneruje ilustrace vrstvy 3 (titul, 7 příběhových scén, portréty role).

Styl je zvolený balíček **„Žoldnéřská kronika"** (pergamen + inkoust + odsáté
zemitě barvy), takže prompty i srovnání jdou do teplé sépiové palety z `G.PAL`.

Postup u každého obrázku:
  1. stáhne `--candidates` kandidátů (Pollinations, zdarma, bez klíče),
  2. každého hned srovná do palety (`grade_art.grade`) — ať se hodnotí to, co by
     se opravdu použilo,
  3. vybere nejlepšího (skóre: kontrast v rozumném pásu, bez přesvětlených
     a utopených pixelů, barvy v paletě),
  4. uloží vítěze do `assets/art/<id>.png` a VŠECHNY kandidáty do
     `assets/art_candidates/` + `index.html`, aby se dal výběr přebít okem
     (náš vkus se měří špatně, tvůj ne).

Scény odpovídají skutečným popupům z `js/data/progress.js`.

Použití:
    python scripts/gen_art.py                      # vše, 2 kandidáti
    python scripts/gen_art.py --only title,scene_arrival
    python scripts/gen_art.py --candidates 3 --strength 0.5
    python scripts/check-art.py                    # kontrola výsledku

Vyžaduje: pillow, numpy, scipy (venv ComfyUI) + internet.
"""
import argparse
import html
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import grade_art
from gen_props import fetch

OUT = 'assets/art'
CAND = 'assets/art_candidates'

# Stylový blok drž krátký: Pollinations odřezává dlouhé prompty (~350 znaků).
STYLE = ('aged parchment, sepia and olive ink illustration, muted earthy medieval palette, '
         'ink linework with hatching, low fantasy, no text, no watermark')

# (id, co je na obrázku, šířka, výška)
ART = [
    ('title', 'a small walled settlement with a watchtower on a hill at dawn, dark forest and a '
              'river below, distant mountains, a cart on a winding road', 1024, 576),
    ('scene_arrival', 'a campfire at night at the edge of a dark forest, an old man with a staff '
                      'approaching a seated young leader, glowing embers', 768, 512),
    ('scene_mountain_message', 'a messenger on a mountain road handing a sealed letter, snowy peaks '
                               'and a mine entrance behind him', 768, 512),
    ('scene_forest_call', 'a bearded man in furs stepping out of dark forest shadows, one open hand '
                          'raised, torchlight', 768, 512),
    ('scene_merchant_call', 'a wealthy medieval merchant with a mule and chests of goods on a '
                            'village road, scales and coins', 768, 512),
    ('scene_cave_shadows', 'a pale exhausted scout returning from a cave mouth, faint glowing '
                           'crystals inside the dark entrance', 768, 512),
    ('scene_council', 'representatives of four factions seated around a long wooden table in a stone '
                      'hall, hanging banners, candlelight', 768, 512),
    ('scene_new_beginning', 'a lone figure with a pack at a crossroads at sunrise, looking toward '
                            'distant hills and a new road', 768, 512),
    ('portrait_leader', 'portrait of a stern medieval leader in a hooded cloak with a golden brooch, '
                        'head and shoulders', 512, 640),
    ('portrait_quarter', 'portrait of a medieval quartermaster with a leather satchel, ledger and '
                         'keys at his belt', 512, 640),
    ('portrait_medic', 'portrait of a medieval field medic with herb pouches and bandages, calm face', 512, 640),
    ('portrait_scout', 'portrait of a medieval scout in a hood with a compass, bow over the shoulder', 512, 640),
    ('portrait_fighter', 'portrait of a scarred medieval fighter in a mail shirt and leather, calm, '
                         'no drawn weapon', 512, 640),
    ('portrait_trader', 'portrait of a medieval trader with a fur collar, brass scales and a coin '
                        'pouch', 512, 640),
]

# cílové pásmo kontrastu ilustrace (ne plochá, ne přepálená)
CONTRAST_LO, CONTRAST_HI = 28.0, 75.0


def score(arr):
    """Skóre kandidáta: kontrast v pásu, málo přesvětlených/utopených pixelů, barvy
    v paletě a **žádný neon** — ten se do skóre dostal až po prvním běhu: dva
    vítězové měli 15 % a 17 % sytých pixelů a kontrola je právem shodila."""
    st = grade_art.stats(arr)
    lum = grade_art._luma(arr)
    clip = float(((lum > 250) | (lum < 5)).mean())
    c = st['contrast']
    band = 0.0 if CONTRAST_LO <= c <= CONTRAST_HI else min(abs(c - CONTRAST_LO), abs(c - CONTRAST_HI))
    neon = max(0.0, st['sat_high'] - 0.08)
    s = (-band - 400.0 * clip - 60.0 * st['gamut'] - 250.0 * neon + 20.0 * st['cast'])
    return s, {'kontrast': round(c, 1), 'clip': round(clip, 3), 'mimo': round(st['gamut'], 3),
               'neon': round(st['sat_high'], 3), 'nadech': round(st['cast'], 2)}


def rescore(args):
    """Vybere vítěze z UŽ stažených kandidátů (`--rescore`) — bez internetu."""
    import glob
    n = 0
    for aid, _subject, _w, _h in ART:
        best, best_s, best_info, best_file = None, -1e9, {}, None
        for f in sorted(glob.glob(os.path.join(args.cand, aid + '-*.png'))):
            arr = np.asarray(Image.open(f).convert('RGB')).astype(np.float32)
            s, info = score(arr)
            print('  %-22s %-16s skore %6.2f  %s' % (aid, os.path.basename(f), s, info), flush=True)
            if s > best_s:
                best, best_s, best_info, best_file = arr, s, info, f
        if best is None:
            print('  %-22s zadny kandidat' % aid, flush=True)
            continue
        Image.fromarray(best.astype(np.uint8), 'RGB').save(os.path.join(args.out, aid + '.png'))
        print('  %-22s -> %s (skore %.2f)' % (aid, os.path.join(args.out, aid + '.png'), best_s), flush=True)
        n += 1
    print('\nprevybrano %d obrazku z kandidatu v %s' % (n, args.cand), flush=True)
    return 0 if n else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='', help='jen tyto id (čárkou)')
    ap.add_argument('--candidates', type=int, default=2)
    ap.add_argument('--seed', type=int, default=3000)
    ap.add_argument('--strength', type=float, default=0.5)
    ap.add_argument('--rescore', action='store_true',
                    help='jen prevybrat viteze z uz stazenych kandidatu (bez internetu)')
    ap.add_argument('--out', default=OUT)
    ap.add_argument('--cand', default=CAND)
    args = ap.parse_args()

    if args.rescore:
        return rescore(args)

    want = [s.strip() for s in args.only.split(',') if s.strip()]
    items = [a for a in ART if not want or a[0] in want]
    if not items:
        print('nezname id; zname: ' + ', '.join(a[0] for a in ART))
        return 1

    os.makedirs(args.out, exist_ok=True)
    os.makedirs(args.cand, exist_ok=True)
    print('generuji %d obrazku, %d kandidatu na obrazek' % (len(items), args.candidates), flush=True)

    sheet = {}          # id -> [(soubor, skóre, info, vybraný?)]
    picked_ids = []
    for i, (aid, subject, w, h) in enumerate(items):
        prompt = '%s, %s' % (subject, STYLE)
        best, best_s, best_info, best_file = None, -1e9, {}, None
        rows = []
        for c in range(args.candidates):
            seed = args.seed + i * 100 + c * 7
            img = fetch(prompt, seed, w=w, h=h)
            if img is None:
                print('  %-22s seed %-5d stazeni selhalo' % (aid, seed), flush=True)
                continue
            raw = np.asarray(img.convert('RGB')).astype(np.float32)
            out = grade_art.grade(raw, args.strength)
            f = os.path.join(args.cand, '%s-%d.png' % (aid, c + 1))
            Image.fromarray(out.astype(np.uint8), 'RGB').save(f)
            s, info = score(out)
            print('  %-22s seed %-5d skore %6.2f  %s' % (aid, seed, s, info), flush=True)
            rows.append((os.path.basename(f), s, info, False))
            if s > best_s:
                best, best_s, best_info, best_file = out, s, info, f
        if best is None:
            print('  %-22s NEVYBRANO (zadny kandidat)' % aid, flush=True)
            continue
        dst = os.path.join(args.out, aid + '.png')
        Image.fromarray(best.astype(np.uint8), 'RGB').save(dst)
        picked_ids.append(aid)
        rows = [(n, s, inf, n == os.path.basename(best_file)) for (n, s, inf, _) in rows]
        sheet[aid] = rows
        print('  %-22s -> %s  (skore %.2f)' % (aid, dst, best_s), flush=True)

    # kontaktní list: ať se dá výběr přebít okem
    idx = os.path.join(args.cand, 'index.html')
    with open(idx, 'w', encoding='utf-8') as f:
        f.write('<!doctype html><html lang="cs"><head><meta charset="utf-8">'
                '<title>Kandidáti ilustrací</title><style>'
                'body{background:#1b1a17;color:#ded6c4;font:14px system-ui;margin:16px}'
                'h2{font-size:15px;color:#c9b98d;border-bottom:1px solid #3a352a;padding-bottom:4px}'
                '.row{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}'
                'figure{margin:0}img{max-width:360px;border:1px solid #3a352a;border-radius:3px}'
                '.pick img{border:2px solid #9fd08a}figcaption{font-size:12px;color:#9b917c}'
                '.pick figcaption{color:#9fd08a}'
                '</style></head><body><h1>Kandidáti ilustrací (vybraný je zeleně)</h1>'
                '<p>Pokud se ti víc líbí jiný kandidát, řekni mi číslo a přepíšu ho. '
                'Soubory: <code>assets/art_candidates/</code>, finální v <code>assets/art/</code>.</p>')
        for aid, rows in sheet.items():
            f.write('<h2>%s</h2><div class="row">' % html.escape(aid))
            for name, s, info, pick in rows:
                f.write('<figure class="%s"><img src="%s"><figcaption>%s · skóre %.1f<br>%s</figcaption></figure>'
                        % ('pick' if pick else '', html.escape(name), html.escape(name), s,
                           html.escape(str(info))))
            f.write('</div>')
        f.write('</body></html>')

    print('\nhotovo: %d obrazku do %s' % (len(picked_ids), args.out), flush=True)
    print('kontaktni list: %s' % idx, flush=True)
    print('kontrola: python scripts/check-art.py', flush=True)
    return 0 if picked_ids else 1


if __name__ == '__main__':
    sys.exit(main())
