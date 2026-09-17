#!/usr/bin/env python
"""Vygeneruje sprity krajinných prvků (stromy, skály, trs, rákosí…) do assets/props.

Postup: Pollinations (zdarma, bez klíče) -> vyříznutí pozadí -> výběr nejlepšího
kandidáta -> zmenšení na cílovou výšku. Stejná logika vyříznutí jako u postav
(`scripts/process_units.py`): polarita podle jasu středu vs. okraje, prahování
a největší souvislá oblast uprostřed.

Proč zvlášť skript: prvky se generují po jednom (model nezvládá víc věcí
v jednom obrázku), potřebují jiné pozadí než postavy (středně šedé, aby šly
vyříznout i světlé věci jako závěj) a je potřeba vybírat z kandidátů — model
občas vyrobí scénu místo jednoho objektu.

Použití:
    python scripts/gen_props.py                       # všechny druhy, 3 kandidáti
    python scripts/gen_props.py --kinds tree,pine      # jen některé
    python scripts/gen_props.py --candidates 4 --seed 100

Po generování se sprity srovnají do palety:
    python scripts/grade_art.py --in assets/props --out assets/props
    python scripts/check-art.py --dir assets/props

Vyžaduje: pillow, numpy, scipy (venv ComfyUI) + internet.
"""
import argparse
import io
import os
import sys
import time
import urllib.parse
import urllib.request

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

DST = 'assets/props'
BG = 'plain flat medium grey background'
STYLE = 'top-down game sprite, muted earthy fantasy colors, no shadow, no text'

# druh -> (co nakreslit, cílová výška sprity v px)
PROPS = [
    ('tree',    'single deciduous tree, olive green foliage, brown trunk', 96),
    ('pine',    'single tall pine tree, dark green needles', 96),
    ('boulder', 'single grey boulder stone', 64),
    ('bush',    'small round bush shrub, green leaves', 64),
    ('pebble',  'two small grey stones', 48),
    ('reed',    'cluster of marsh reeds, green brown stalks', 64),
    ('tuft',    'small tuft of grass blades', 48),
    ('drift',   'low snow drift patch, pale white snow', 48),
    ('ripple',  'gentle water ripple lines, pale blue grey', 48),
    ('rut',     'two parallel wheel ruts in dirt, brown', 48),
]

CLOSE = 7       # propojí fragmenty, uzavře díry
PAD = 6         # odsazení ořezu kolem popředí


def cutout(img):
    """Vyříznutý sprite (RGBA) nebo None. Stejná logika jako u postav."""
    rgb = np.asarray(img.convert('RGB')).astype(np.float32)
    h, w, _ = rgb.shape
    lum = rgb.mean(axis=-1)
    c = lum[int(h * 0.3):int(h * 0.7), int(w * 0.3):int(w * 0.7)]
    border = np.concatenate([lum[0, :], lum[-1, :], lum[:, 0], lum[:, -1]])
    c_med, b_med = float(np.median(c)), float(np.median(border))
    if abs(c_med - b_med) < 6:          # objekt a pozadí splývají
        return None
    thr = (c_med + b_med) / 2.0
    fg = (lum < thr) if c_med < b_med else (lum > thr)
    fg = ndimage.binary_closing(fg, structure=np.ones((CLOSE, CLOSE)))
    labels, n = ndimage.label(fg)
    if n == 0:
        return None
    sizes = ndimage.sum(fg, labels, range(1, n + 1))
    keep = (labels == int(np.argmax(sizes)) + 1)

    ys, xs = np.where(keep)
    if len(xs) == 0:
        return None
    rgba = np.asarray(img.convert('RGBA')).copy()
    rgba[..., 3] = keep.astype(np.uint8) * 255
    out = Image.fromarray(rgba, 'RGBA')
    x0, x1 = max(0, xs.min() - PAD), min(w, xs.max() + PAD)
    y0, y1 = max(0, ys.min() - PAD), min(h, ys.max() + PAD)
    return out.crop((x0, y0, x1, y1))


def score(sprite, size):
    """Čím vyšší, tím lepší kandidát (jeden objekt uprostřed, ne scéna)."""
    a = np.asarray(sprite)[..., 3] > 0
    h, w = a.shape
    frac = a.mean()
    if frac < 0.03 or frac > 0.80:
        return -1.0, {'duvod': 'podil popredi %.2f' % frac}
    ys, xs = np.where(a)
    bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
    compact = frac * (h * w) / max(1, bw * bh)          # plnost obdélníku
    # trest za objekt nalepený na okraj (to bývá výřez scény, ne samotný objekt)
    edge = (int(xs.min() == 0) + int(ys.min() == 0) +
            int(xs.max() == w - 1) + int(ys.max() == h - 1)) / 4.0
    # trest za těžiště daleko od středu
    cy, cx = ys.mean() / h, xs.mean() / w
    off = max(abs(cx - 0.5), abs(cy - 0.5))
    return compact - 0.7 * edge - 1.2 * off, {'podil': round(float(frac), 3),
                                              'plnost': round(float(compact), 2),
                                              'okraj': round(edge, 2),
                                              'odstred': round(float(off), 2)}


def fetch(prompt, seed, tries=3, w=512, h=512):
    """Stáhne jeden obrázek z Pollinations. `w`/`h` mění poměr stran (postava
    potřebuje na výšku orientované plátno, jinak model vyrobí širokou scénu)."""
    url = ('https://image.pollinations.ai/prompt/' + urllib.parse.quote(prompt) +
           '?width=%d&height=%d&nologo=true&model=flux&seed=%d' % (w, h, seed))
    for t in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                return Image.open(io.BytesIO(r.read()))
        except Exception as e:
            if t == tries - 1:
                print('      pokus %d selhal: %s' % (t + 1, str(e)[:60]))
            else:
                time.sleep(3)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--kinds', default='', help='jen tyto druhy (čárkou)')
    ap.add_argument('--candidates', type=int, default=3)
    ap.add_argument('--seed', type=int, default=1000)
    ap.add_argument('--out', default=DST)
    args = ap.parse_args()

    want = [k.strip() for k in args.kinds.split(',') if k.strip()]
    props = [p for p in PROPS if not want or p[0] in want]
    if not props:
        print('neznamy druh; zname: ' + ', '.join(p[0] for p in PROPS))
        return 1

    os.makedirs(args.out, exist_ok=True)
    print('generuji %d druhu, %d kandidatu na druh -> %s' % (len(props), args.candidates, args.out))
    ok = 0
    for kind, subject, target_h in props:
        prompt = '%s, %s, %s' % (subject, STYLE, BG)
        best, best_score, best_info, best_seed = None, -1.0, {}, None
        for i in range(args.candidates):
            seed = args.seed + i * 7
            img = fetch(prompt, seed)
            if img is None:
                continue
            spr = cutout(img)
            if spr is None:
                print('    %-8s seed %-5d vyriznuti selhalo' % (kind, seed))
                continue
            sc, info = score(spr, img.size)
            print('    %-8s seed %-5d skore %5.2f  %s' % (kind, seed, sc, info))
            if sc > best_score:
                best, best_score, best_info, best_seed = spr, sc, info, seed
        if best is None or best_score <= 0:
            print('  %-8s NEVYBRANO (zadny pouzitelny kandidat)' % kind)
            continue
        tw = max(1, round(best.width * target_h / best.height))
        best.resize((tw, target_h), Image.LANCZOS).save(os.path.join(args.out, kind + '.png'))
        print('  %-8s OK  seed %d, vyska %d px, sirka %d px  %s' % (
            kind, best_seed, target_h, tw, best_info))
        ok += 1

    print('\nhotovo: %d z %d druhu' % (ok, len(props)))
    if ok:
        print('další krok: python scripts/grade_art.py --in %s --out %s' % (args.out, args.out))
        print('            python scripts/check-art.py --dir %s' % args.out)
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
