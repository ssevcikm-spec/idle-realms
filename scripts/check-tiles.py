#!/usr/bin/env python
"""Změří dlaždice mapy — místo hádání přes Gemini Vision.

Proč: švy a repetice se nedají ověřit "od oka" ani přes vision model (na 46 px
dlaždici nic nevidí a hlavní artefakt — opakování přes celou mapu — v jednom
obrázku vůbec není). Tenhle skript vrací čísla, která se dají porovnávat mezi
iteracemi, a umí nasimulovat přesně to schéma, kterým hra dlaždice skládá.

Měřené metriky
--------------
seam    poměr skoku přes vnitřní hranici dlaždic k "zrnu" textury. Absolutní
        skok sám nic neříká: když na sebe dlaždice navazují spojitě, je skok
        stejně velký jako zrno. Šev je vidět, teprve když je skok výrazně větší
        (limit 1.6×).
wrap    vlastní "samonavazování" dlaždice (sloupec 0 vs. poslední). Podmínka
        pro světové (sliding) vzorkování: dlaždice musí být torus.
period  nejmenší posun v dlaždicích, při kterém se mozaika zopakuje (korelace
        ≥ 0.98). Delší perioda = méně viditelná repetice. 2 = zrcadlový
        kaleidoskop, 4 = sliding okno, 8+ = variabilní obsah.
target  odchylka průměrné barvy od cíle terénu (TARGET) — terén musí zůstat
        čitelný, i když je textura malovaná.
kontrast  směrodatná odchylka jasu po zmenšení na 46 px (skutečná velikost
        dlaždice ve hře). Příliš nízká = terén vypadá jako jednolitá plocha.
odlišnost nejmenší vzdálenost průměrných barev mezi dvojicí terénů.

Použití
-------
    python scripts/check-tiles.py                     # kontrola assets/tiles
    python scripts/check-tiles.py --scheme sliding    # jiné schéma skládání
    python scripts/check-tiles.py --dir out --atlas _atlas.png

Vyžaduje: pillow + numpy (jsou ve venv ComfyUI: D:\\ComfyUI\\venv-comfy).
Návratový kód 1 = některá kontrola neprošla.
"""
import argparse
import glob
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

# cílové průměrné barvy terénů (stejné jako v grade_tiles.py)
TARGET = {
    'grass':       [104, 108,  56],
    'forest':      [ 54,  72,  40],
    'deep_forest': [ 34,  48,  32],
    'hills':       [ 98,  94,  72],
    'mountain':    [108, 108, 106],
    'water':       [ 52,  92, 122],
    'swamp':       [ 84,  80,  46],
    'snow':        [196, 204, 212],
    'road':        [122, 100,  66],
    'dirt':        [138, 116,  80],
}

# meze pro PASS
LIM_SEAM_RATIO = 1.6  # skok na hranici / zrno textury (1.0 = nerozeznatelné)
LIM_WRAP = 2.5        # samonavazování dlaždice
LIM_PERIOD = 4        # nejmenší přípustná perioda opakování (v dlaždicích)
LIM_TARGET = 22.0     # odchylka barvy od cíle terénu
LIM_CONTRAST = 5.0    # mikro-kontrast v 46 px
# Pozor: sama paleta má nejbližší dvojici terénů 22,1 (grass vs hills i grass vs
# road), takže víc než ~20 nejde dosáhnout. Limit je tedy "udržet 90 % toho, co
# paleta navrhuje" — když je odlišnost nižší, textura terény slévá dohromady.
LIM_DISTINCT = 20.0   # odlišnost terénů


def load_set(directory):
    """Načte <terén>-<n> obrázky v nativním rozlišení: {terén: [npole(RGB), ...]}.

    Nativní rozlišení je důležité: `wrap` se musí měřit na tom, co je v assetu
    (jinak zmenšení šev zamaskuje) a sliding schéma z nativní textury řeže okna.
    """
    out = {}
    for path in sorted(glob.glob(os.path.join(directory, '*.*'))):
        stem, ext = os.path.splitext(os.path.basename(path))
        if ext.lower() not in ('.jpg', '.jpeg', '.png'):
            continue
        terrain = stem.split('-')[0]
        if terrain not in TARGET:
            continue
        img = Image.open(path).convert('RGB')
        out.setdefault(terrain, []).append(np.asarray(img).astype(np.float32))
    return out


def fit(a, size):
    """Zmenší dlaždici na velikost, ve které ji kreslí hra."""
    if a.shape[0] == size:
        return a
    return np.asarray(Image.fromarray(a.astype(np.uint8)).resize((size, size),
                      Image.LANCZOS)).astype(np.float32)


def wrap_delta(a):
    """Vlastní navazování dlaždice: hrana proti protější hraně."""
    h = np.abs(a[:, 0, :] - a[:, -1, :]).mean()
    v = np.abs(a[0, :, :] - a[-1, :, :]).mean()
    return float(h), float(v)


def _flip(a, h, v):
    b = a
    if h:
        b = b[:, ::-1, :]
    if v:
        b = b[::-1, :, :]
    return b


def build_mosaic(tiles, size, scheme, n=8, repeat=6, blend=(29.0, 43.0)):
    """Sestaví mozaiku n×n dlaždic stejně, jako to dělá hra.

    random   = dnešní stav: 8 variant (2 textury × zrcadlení × jas), přiřazení
               (x*7 + y*13) % 8  — viz js/render/tiles_ai.js
    parity   = zrcadlení podle parity souřadnic (šev 0, ale perioda 2)
    sliding  = světové vzorkování: dlaždice je výřez z torusu textury
               (okno = 1/repeat textury, takže perioda je `repeat` dlaždic)
    sliding2 = totéž, ale dvě textury téže terénu se prolínají váhou, která se
               mění pomalu ve světových souřadnicích (periody `blend`). Váha je
               spojitá, takže šev vzniká jen kvantováním váhy po dlaždicích:
               Δw × |A-B|.
    """
    terrains = list(tiles.keys())
    # mozaika je vždy z jedné "hlavní" textury, aby šly porovnávat schémata
    terrain = 'grass' if 'grass' in tiles else terrains[0]
    tex = tiles[terrain][0]

    if scheme in ('sliding', 'sliding2'):
        t = tex.shape[0]
        win = max(8, t // repeat)
        texB = tiles[terrain][1] if len(tiles[terrain]) > 1 else tex
        bx, by = blend
        m = np.zeros((n * size, n * size, 3), np.float32)
        for y in range(n):
            for x in range(n):
                sx, sy = (x * win) % t, (y * win) % t
                a = _crop_torus(tex, sx, sy, win, size)
                if scheme == 'sliding':
                    m[y*size:(y+1)*size, x*size:(x+1)*size] = a
                    continue
                b = _crop_torus(texB, sx, sy, win, size)
                w = 0.5 + 0.5 * np.sin(2 * np.pi * (x / bx + y / by))
                m[y*size:(y+1)*size, x*size:(x+1)*size] = w * a + (1.0 - w) * b
        return m, terrain

    src = fit(tex, size)
    variants = []
    if scheme == 'random':
        for mul, flip in [(1.00, ''), (1.00, 'h'), (0.93, 'v'), (1.06, 'h'),
                          (1.00, 'h'), (0.95, ''), (1.05, 'hv'), (0.98, 'v')]:
            variants.append(np.clip(_flip(src, 'h' in flip, 'v' in flip) * mul, 0, 255))
    elif scheme == 'parity':
        variants = [_flip(src, False, False)]
    else:
        raise SystemExit('neznámé schéma: ' + scheme)

    m = np.zeros((n * size, n * size, 3), np.float32)
    for y in range(n):
        for x in range(n):
            if scheme == 'random':
                t = variants[(x * 7 + y * 13) % len(variants)]
            else:
                t = _flip(variants[0], x % 2 == 1, y % 2 == 1)
            m[y*size:(y+1)*size, x*size:(x+1)*size] = t
    return m, terrain


def _crop_torus(tex, sx, sy, win, out):
    """Výřez z torusu (textura se na okrajích obtáčí) zmenšený na out×out."""
    t = tex.shape[0]
    if sx + win <= t and sy + win <= t:
        block = tex[sy:sy+win, sx:sx+win]
    else:
        ys = np.arange(sy, sy + win) % t
        xs = np.arange(sx, sx + win) % t
        block = tex[np.ix_(ys, xs)]
    img = Image.fromarray(block.astype(np.uint8)).resize((out, out), Image.LANCZOS)
    return np.asarray(img).astype(np.float32)


def seam_delta(m, size, n=8):
    """Průměrný skok přes vnitřní hranici dlaždic (absolutně, 0-255)."""
    v, h = [], []
    for y in range(n):
        for x in range(n - 1):
            L = m[y*size:(y+1)*size, (x+1)*size - 1, :]
            R = m[y*size:(y+1)*size, (x+1)*size, :]
            v.append(np.abs(L - R).mean())
    for y in range(n - 1):
        for x in range(n):
            T = m[(y+1)*size - 1, x*size:(x+1)*size, :]
            B = m[(y+1)*size, x*size:(x+1)*size, :]
            h.append(np.abs(T - B).mean())
    return float(np.mean(v + h))


def grain_delta(m, size, n=8):
    """Zrno textury: jak moc se liší sousední sloupce UVNITŘ dlaždice.

    Tohle je klíčové pro výklad `seam`: absolutní skok na hranici dlaždice sám
    nic neříká — pokaždé, když na sebe navazují dvě dlaždice spojitě, je skok
    stejně velký jako zrno textury. Šev je vidět teprve tehdy, když je skok
    VÝRAZNĚ větší než zrno. Proto se poměřuje `seam / grain`.
    """
    v, h = [], []
    for y in range(n):
        for x in range(n):
            t = m[y*size:(y+1)*size, x*size:(x+1)*size, :]
            v.append(np.abs(np.diff(t, axis=1)).mean())
            h.append(np.abs(np.diff(t, axis=0)).mean())
    return float((np.mean(v) + np.mean(h)) / 2)


def lowpass(m, radius):
    """Rozostří mozaiku před měřením švu.

    Oko nevnímá šev jako zrno, ale jako **souvislou linii**: náhodný šum se
    zprůměruje, strukturní skok zůstane. Proto se seam i zrno měří na mírně
    rozostřené mozaice — jinak by hlučná textura maskovala i hrubý šev.
    """
    if radius <= 0:
        return m
    return np.asarray(
        Image.fromarray(np.clip(m, 0, 255).astype(np.uint8))
        .filter(ImageFilter.GaussianBlur(radius))
    ).astype(np.float32)


def repeat_period(m, size, n=8, lim=0.98, kmax=8):
    """Nejmenší posun (v dlaždicích), při kterém se mozaika zopakuje."""
    g = m.mean(axis=2)
    best = None
    for k in range(1, min(kmax, n // 2) + 1):
        for axis in (1, 0):
            if axis == 1:
                a, b = g[:, :(n - k) * size], g[:, k * size:]
            else:
                a, b = g[:(n - k) * size, :], g[k * size:, :]
            a = a - a.mean()
            b = b - b.mean()
            den = np.sqrt((a * a).sum() * (b * b).sum())
            corr = float((a * b).sum() / den) if den > 0 else 0.0
            if corr >= lim and (best is None or k < best):
                best = k
    return best


def contrast46(tiles, size):
    """Mikro-kontrast po zmenšení na 46 px (skutečná velikost ve hře)."""
    vals = {}
    for terrain, lst in tiles.items():
        a = fit(lst[0], size)
        small = np.asarray(
            Image.fromarray(a.astype(np.uint8)).resize((46, 46), Image.LANCZOS)
        ).astype(np.float32)
        vals[terrain] = float(small.mean(axis=2).std())
    return vals


def distinctness(tiles, size):
    means = {t: fit(l[0], size).reshape(-1, 3).mean(axis=0) for t, l in tiles.items()}
    names = sorted(means)
    best = (1e9, None, None)
    for i, a in enumerate(names):
        for b in names[i+1:]:
            d = float(np.linalg.norm(means[a] - means[b]))
            if d < best[0]:
                best = (d, a, b)
    return best, means


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', default='assets/tiles')
    ap.add_argument('--size', type=int, default=192, help='velikost dlaždice ve hře')
    ap.add_argument('--scheme', default='sliding',
                    choices=['random', 'parity', 'sliding', 'sliding2'],
                    help='jak hra dlaždice skládá (random = starý stav)')
    ap.add_argument('--grid', type=int, default=12, help='mozaika n×n dlaždic')
    ap.add_argument('--repeat', type=int, default=6,
                    help='sliding: kolik dlaždic zabere jedna textura (perioda)')
    ap.add_argument('--blur', type=float, default=3.0,
                    help='rozostreni mozaiky pred merenim svu (0 = vypnout)')
    ap.add_argument('--atlas', default=None, help='uloží mozaiku jako PNG')
    args = ap.parse_args()

    tiles = load_set(args.dir)
    if not tiles:
        print('zadne dlazdice v', args.dir)
        return 1

    print(f'dlazdice: {args.dir}  ({len(tiles)} terenu, velikost {args.size} px, '
          f'schema "{args.scheme}")')

    # 1) samonavazovani kazde dlazdice
    print('\n[wrap] samonavazovani dlazdice (0 = torus, >2.5 = viditelny sv)')
    worst, wsum = (0, None), []
    for t in sorted(tiles):
        hs, vs = [], []
        for a in tiles[t]:
            h, v = wrap_delta(a)
            hs.append(h); vs.append(v)
        m = (np.mean(hs) + np.mean(vs)) / 2
        wsum.append(m)
        flag = '' if m <= LIM_WRAP else '   <-- SV'
        print(f'  {t:12s} H {np.mean(hs):6.2f}  V {np.mean(vs):6.2f}{flag}')
        if m > worst[0]:
            worst = (m, t)
    wrap_mean = float(np.mean(wsum))

    # 2) & 3) mozaika: svy a perioda opakovani
    m, terrain = build_mosaic(tiles, args.size, args.scheme, args.grid, args.repeat)
    mm = lowpass(m, args.blur)
    seam = seam_delta(mm, args.size, args.grid)
    grain = grain_delta(mm, args.size, args.grid)
    seam_ratio = seam / max(0.5, grain)
    per = repeat_period(m, args.size, args.grid)
    if args.atlas:
        Image.fromarray(m.astype(np.uint8)).save(args.atlas)
        print(f'  mozaika ulozena: {args.atlas}')

    # 4) barva proti cili
    print('\n[target] odchylka prumeru od cile terenu')
    tmax, tsum = (0, None), []
    for t in sorted(tiles):
        tgt = np.array(TARGET[t], np.float32)
        dev = float(np.abs(fit(tiles[t][0], args.size).reshape(-1, 3).mean(axis=0) - tgt).max())
        tsum.append(dev)
        flag = '' if dev <= LIM_TARGET else '   <-- mimo cil'
        print(f'  {t:12s} odchylka {dev:6.1f}{flag}')
        if dev > tmax[0]:
            tmax = (dev, t)
    target_mean = float(np.mean(tsum))

    # 5) kontrast a odlisnost
    con = contrast46(tiles, args.size)
    (dist, ta, tb), _ = distinctness(tiles, args.size)
    cmin = min(con.items(), key=lambda kv: kv[1])

    print(f'\n[mozaika {args.grid}x{args.grid}, teren "{terrain}", schema {args.scheme}]')
    print(f'  seam    {seam:6.2f} / zrno {grain:5.2f} = {seam_ratio:5.2f}   (limit {LIM_SEAM_RATIO})')
    print(f'  period  {str(per):>6s}   (limit >= {LIM_PERIOD} dlazdic; None = neopakuje se)')
    print(f'  wrap    {wrap_mean:6.2f}   (limit {LIM_WRAP}), nejhorsi {worst[1]} {worst[0]:.2f}')
    print(f'  target  {target_mean:6.2f}   (limit {LIM_TARGET}), nejhorsi {tmax[1]} {tmax[0]:.1f}')
    print(f'\n[readability] kontrast v 46 px, odlisnost terenu')
    print(f'  kontrast min {cmin[1]:5.1f} ({cmin[0]}), limit {LIM_CONTRAST}')
    print(f'  odlisnost   {dist:5.1f} ({ta} vs {tb}), limit {LIM_DISTINCT}')

    fails = []
    if seam_ratio > LIM_SEAM_RATIO:
        fails.append(f'seam/zrno {seam_ratio:.2f} > {LIM_SEAM_RATIO}')
    if wrap_mean > LIM_WRAP:
        fails.append(f'wrap {wrap_mean:.2f} > {LIM_WRAP}')
    if per is not None and per < LIM_PERIOD:
        fails.append(f'perioda {per} < {LIM_PERIOD}')
    if target_mean > LIM_TARGET:
        fails.append(f'target {target_mean:.1f} > {LIM_TARGET}')
    if cmin[1] < LIM_CONTRAST:
        fails.append(f'kontrast {cmin[1]:.1f} < {LIM_CONTRAST}')
    if dist < LIM_DISTINCT:
        fails.append(f'odlisnost {dist:.1f} < {LIM_DISTINCT}')

    print()
    if fails:
        print('VYSLEDEK: CHYBY -> ' + '; '.join(fails))
        return 1
    print('VYSLEDEK: OK (vsechny kontroly prosly)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
