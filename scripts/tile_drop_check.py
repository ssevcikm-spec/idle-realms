#!/usr/bin/env python
"""Zkontroluje dlaždice, které padají do `assets/tiles_drop/`, a řekne u každé verdikt.

Proč: dokud se dlaždice generují po jedné (ručně v Gemini, nebo lokálně
v ComfyUI), je potřeba mít **okamžitou** zpětnou vazbu, jestli má smysl ji dál
zpracovávat. Tenhle skript měří to, co se měřit dá (`wrap`, plošnost, kontrast
na 46 px, `seam/zrno`, ostrost, barva proti paletě terénu) a co se **nemá**
řešit okem. „Líbí / nelíbí“ zůstává na člověku a na `tools/tiles/preview.html`.

Soubor pojmenuj **podle terénu**, ať je jasné, kam patří:

    assets/tiles_drop/grass.png        -> terén grass, varianta dopočítaná
    assets/tiles_drop/water-1.png      -> terén water, varianta 1

Když terén v názvu není, skript ho zkusí odhadnout (nejbližší nasazená dlaždice
podle barevné statistiky) a napíše, že jde o odhad.

Použití:
    python scripts/tile_drop_check.py                    # projde assets/tiles_drop
    python scripts/tile_drop_check.py --dir <slozka>
    python scripts/tile_drop_check.py --move             # přijaté přepíše jako <terén>-<n>.jpg do <slozka>/ok
    python scripts/tile_drop_check.py --json <cesta>     # strojový výstup pro další zpracování

Vyžaduje: pillow + numpy. Meze jsou stejné jako v `scripts/check-tiles.py`.
Návratový kód 1 = aspoň jedna dlaždice je vyřazená.
"""
import argparse
import glob
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tile_palette import TARGET, TERRAINS  # jediný zdroj barev = js/render/art.js

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DROP = os.path.join(ROOT, 'assets', 'tiles_drop')
REF_DIR = os.path.join(ROOT, 'assets', 'tiles')
EXT = ('.png', '.jpg', '.jpeg', '.webp')

# meze pro PASS (stejné jako check-tiles.py / tile_flatness.py)
LIM_WRAP = 2.5
LIM_SEAM = 1.6
LIM_KONTRAST = 5.0
LIM_PALETA = 22.0
LIM_HORIZONT = 0.045
LIM_STRED = 0.075
LIM_MAKRO = 0.12
LIM_OKRAJ = 1.6      # poměr zrna v okrajovém pásu proti zbytku dlaždice
SIZE = 192           # velikost dlaždice ve hře (px)
GRID = 12            # mozaika pro měření švu
REPEAT = 6           # perioda okna ve hře


def terrain_from_name(name):
    """Terén z názvu souboru (water.png, water-1.jpg, ...). None = nepoznán."""
    stem = os.path.splitext(os.path.basename(name))[0].lower().replace('_', '-')
    for t in TERRAINS:
        if stem == t or stem.startswith(t + '-') or stem.startswith(t + ' '):
            return t
    # delší názvy první, aby `deep-forest-1` nechytil kratší `forest`;
    # pomlčky vs. podtržítka se musí srovnat (`deep_forest` -> `deep-forest`)
    for t in sorted(TERRAINS, key=len, reverse=True):
        if t.replace('_', '-') in stem:
            return t
    return None


def _hist(a, bins=6):
    q = (a / 256.0 * bins).astype(int).clip(0, bins - 1)
    idx = q[:, :, 0] * bins * bins + q[:, :, 1] * bins + q[:, :, 2]
    h = np.bincount(idx.ravel(), minlength=bins ** 3).astype(np.float32)
    return h / h.sum()


def _ref_features():
    """Barevná statistika nasazené sady: [(terén, histogram, průměrná barva)]."""
    out = []
    for p in sorted(glob.glob(os.path.join(REF_DIR, '*'))):
        t = os.path.basename(p).split('-')[0]
        if t not in TERRAINS:
            continue
        a = np.asarray(Image.open(p).convert('RGB').resize((48, 48), Image.LANCZOS)).astype(np.float32)
        out.append((t, _hist(a), a.reshape(-1, 3).mean(axis=0)))
    return out


def guess_terrain(a, refs):
    h = _hist(np.asarray(Image.fromarray(a.astype(np.uint8)).resize((48, 48), Image.LANCZOS)).astype(np.float32))
    mean = a.reshape(-1, 3).mean(axis=0)
    best = {}
    for t, rh, rm in refs:
        d = float(np.abs(h - rh).sum()) + float(np.linalg.norm(mean - rm)) / 255.0
        if t not in best or d < best[t]:
            best[t] = d
    order = sorted(best.items(), key=lambda kv: kv[1])
    return order[0][0], order[:3]


def flatness(a):
    """Stejné tři znaky jako scripts/tile_flatness.py (scéna vs. plocha textura)."""
    g = Image.fromarray(a.astype(np.uint8)).convert('L').resize((256, 256), Image.LANCZOS)
    b = np.asarray(g.filter(ImageFilter.GaussianBlur(8.0))).astype(np.float32) / 255.0
    h, w = b.shape
    q = h // 4
    macro = float(b.std())
    horizon = abs(float(b[:q].mean()) - float(b[-q:].mean()))
    r = 40
    mid = float(b[h // 2 - r:h // 2 + r, w // 2 - r:w // 2 + r].mean())
    corners = float(np.mean([b[:r, :r].mean(), b[:r, -r:].mean(),
                             b[-r:, :r].mean(), b[-r:, -r:].mean()]))
    return macro, horizon, abs(mid - corners)


def fit(a, size):
    if a.shape[0] == size:
        return a
    return np.asarray(Image.fromarray(a.astype(np.uint8)).resize((size, size), Image.LANCZOS)).astype(np.float32)


def wrap_delta(a):
    return (float(np.abs(a[:, 0, :] - a[:, -1, :]).mean()),
            float(np.abs(a[0, :, :] - a[-1, :, :]).mean()))


def _crop_torus(tex, sx, sy, win, out):
    t = tex.shape[0]
    ys = np.arange(sy, sy + win) % t
    xs = np.arange(sx, sx + win) % t
    block = tex[np.ix_(ys, xs)]
    return np.asarray(Image.fromarray(block.astype(np.uint8)).resize((out, out), Image.LANCZOS)).astype(np.float32)


def seam_grain(a):
    """`seam/zrno` na mozaice složené stejně jako ve hře (sliding okno)."""
    m = np.zeros((GRID * SIZE, GRID * SIZE, 3), np.float32)
    win = max(8, a.shape[0] // REPEAT)
    for y in range(GRID):
        for x in range(GRID):
            m[y * SIZE:(y + 1) * SIZE, x * SIZE:(x + 1) * SIZE] = _crop_torus(
                a, (x * win) % a.shape[0], (y * win) % a.shape[0], win, SIZE)
    mm = np.asarray(Image.fromarray(np.clip(m, 0, 255).astype(np.uint8))
                    .filter(ImageFilter.GaussianBlur(3.0))).astype(np.float32)
    seam, grain = [], []
    for y in range(GRID):
        for x in range(GRID - 1):
            seam.append(np.abs(mm[y * SIZE:(y + 1) * SIZE, (x + 1) * SIZE - 1, :]
                               - mm[y * SIZE:(y + 1) * SIZE, (x + 1) * SIZE, :]).mean())
    for y in range(GRID - 1):
        for x in range(GRID):
            seam.append(np.abs(mm[(y + 1) * SIZE - 1, x * SIZE:(x + 1) * SIZE, :]
                               - mm[(y + 1) * SIZE, x * SIZE:(x + 1) * SIZE, :]).mean())
    for y in range(GRID):
        for x in range(GRID):
            t = mm[y * SIZE:(y + 1) * SIZE, x * SIZE:(x + 1) * SIZE, :]
            grain.append((np.abs(np.diff(t, axis=1)).mean() + np.abs(np.diff(t, axis=0)).mean()) / 2)
    return float(np.mean(seam) / max(0.5, float(np.mean(grain))))


def edge_ratio(a):
    """Zrno v okrajovém pásu proti zbytku — podezření na předmět přes okraj dlaždice."""
    g = np.asarray(Image.fromarray(fit(a, 256).astype(np.uint8)).convert('L')).astype(np.float32)
    grad = np.abs(np.diff(g, axis=1)).mean(axis=1)
    n = max(4, int(round(0.08 * len(grad))))
    band = np.concatenate([grad[:n], grad[-n:]])
    inner = grad[3 * n:-3 * n] if len(grad) > 8 * n else grad
    return float(band.mean() / max(0.5, inner.mean()))


def sharpness(a):
    g = np.asarray(Image.fromarray(fit(a, SIZE).astype(np.uint8)).convert('L')).astype(np.float32)
    lap = np.abs(4 * g[1:-1, 1:-1] - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:])
    return float(lap.mean())


def check(path, refs, named):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    terrain = terrain_from_name(path)
    guess, top3 = guess_terrain(a, refs)
    macro, horizon, mid = flatness(a)
    wh, wv = wrap_delta(a)
    small = np.asarray(Image.fromarray(fit(a, SIZE).astype(np.uint8))
                       .resize((46, 46), Image.LANCZOS)).astype(np.float32)
    kontrast = float(small.mean(axis=2).std())
    ratio = seam_grain(a)
    dev = float(np.abs(a.reshape(-1, 3).mean(axis=0) - np.array(TARGET[terrain or guess], np.float32)).max())
    er = edge_ratio(a)

    fail, note = [], []
    if macro > LIM_MAKRO or horizon > LIM_HORIZONT or mid > LIM_STRED:
        fail.append('SCÉNA (není plošná textura) → flatten_tiles.py, nebo vygenerovat znovu')
    if kontrast < LIM_KONTRAST:
        fail.append('málo detailu (kontrast %.1f < %.1f) → na 46 px splývá' % (kontrast, LIM_KONTRAST))
    if named and terrain and guess != terrain:
        note.append('barva je blíž terénu %s než %s → ověř okem (heuristika si plete '
                    'swamp/grass, není to verdikt)' % (guess, terrain))
    if max(wh, wv) > LIM_WRAP:
        note.append('není torus (wrap %.1f) → seamless_tiles.py' % max(wh, wv))
    if dev > LIM_PALETA:
        note.append('barva mimo paletu (%.0f) → grade_tiles.py' % dev)
    if ratio > LIM_SEAM:
        note.append('seam/zrno %.2f nad limitem → zkontroluj šev' % ratio)
    if er > LIM_OKRAJ:
        note.append('silné zrno u okraje (%.2f×) → možný předmět přes hranu, mrkni na to')
    if a.shape[0] == 512 or a.shape[1] == 512:
        note.append('jen 512 px → měkké (KB: pod nativním rozlišením SDXL)')

    return dict(
        file=os.path.basename(path), w=int(a.shape[1]), h=int(a.shape[0]),
        terrain=named or ('?' + guess), guess=guess, top3=[[t, round(v, 2)] for t, v in top3],
        macro=round(macro, 3), horizon=round(horizon, 3), stred=round(mid, 3),
        wrap_h=round(wh, 2), wrap_v=round(wv, 2), kontrast=round(kontrast, 1),
        seam_zrno=round(ratio, 2), paleta=round(dev, 1), okraj=round(er, 2),
        ostrost=round(sharpness(a), 1),
        verdict=('VYŘADIT: ' + '; '.join(fail)) if fail else 'OK (s korekcemi)',
        fail=fail, note=note)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', default=DROP, help='slozka s kandidaty (vychozi assets/tiles_drop)')
    ap.add_argument('--move', action='store_true', help='prijate zkopiruje do <dir>/ok jako <teren>-<n>.jpg')
    ap.add_argument('--json', default=None, help='kam zapsat strojovy vysledek')
    args = ap.parse_args()

    files = sorted(p for p in glob.glob(os.path.join(args.dir, '*'))
                   if os.path.splitext(p)[1].lower() in EXT and not os.path.basename(p).startswith('_')
                   and os.path.basename(p) != 'README.md')
    if not files:
        print('ve slozce %s nejsou zadne obrazky' % args.dir)
        print('vloz tam dlazdice pojmenovane podle terenu (grass.png, water-1.png, ...)')
        return 0

    refs = _ref_features()
    rows = [check(p, refs, terrain_from_name(p)) for p in files]

    print('kontrola %d dlazdic v %s' % (len(rows), args.dir))
    print('%-30s %-9s %6s %6s %8s %7s %7s %7s  %s' % (
        'soubor', 'terén', 'wrapH', 'wrapV', 'kontrast', 'seam/zr', 'paleta', 'okraj', 'verdikt'))
    for r in rows:
        print('%-30s %-9s %6.1f %6.1f %8.1f %7.2f %7.1f %7.2f  %s' % (
            r['file'][:30], r['terrain'], r['wrap_h'], r['wrap_v'], r['kontrast'],
            r['seam_zrno'], r['paleta'], r['okraj'], r['verdict']))
    print('\nlimity: wrap <= %.1f | kontrast >= %.1f | seam/zrno <= %.1f | paleta <= %.0f |'
          ' horizont <= %.3f | stred <= %.3f' % (LIM_WRAP, LIM_KONTRAST, LIM_SEAM,
                                                 LIM_PALETA, LIM_HORIZONT, LIM_STRED))
    print('poznamky k prijatym dlazdicim:')
    for r in rows:
        if not r['fail']:
            print('  %-30s %s' % (r['file'][:30], '; '.join(r['note']) or 'bez poznamek'))

    if args.json:
        with open(args.json, 'w', encoding='utf-8') as f:
            json.dump(rows, f, ensure_ascii=False, indent=1)
        print('\nzapsano: %s' % args.json)

    if args.move:
        ok_dir = os.path.join(args.dir, 'ok')
        os.makedirs(ok_dir, exist_ok=True)
        counter = {}
        for r in rows:
            if r['fail']:
                continue
            t = r['terrain'].lstrip('?')
            counter[t] = counter.get(t, 0) + 1
            dst = os.path.join(ok_dir, '%s-%d.jpg' % (t, counter[t]))
            src = os.path.join(args.dir, r['file'])
            Image.open(src).convert('RGB').save(dst, quality=95)
            print('prijato: %s -> %s' % (r['file'], dst))
        print('prijate dlazdice jsou v %s (dalsi krok: grade_tiles.py -> seamless_tiles.py)' % ok_dir)

    bad = [r for r in rows if r['fail']]
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
