#!/usr/bin/env python
"""Udělá z dlaždic skutečné torusy (bezešvé) — offset + zacelení.

Proč to takhle: model obrázek "bezešvě" nevygeneruje, protože dlaždice musí
splňovat matematickou vlastnost (levý sloupec = pravý, horní řádek = spodní).
Ta se ale dá assetu **dopočítat**, deterministicky a bez regenerace:

1. **Posun o polovinu** (`roll` o W/2, H/2). Nespojitost, která byla na okraji
   dlaždice, se tím přestěhuje doprostřed. Okraje dlaždice teď vedou středem
   obrázku, kde je obsah spojitý — takže "wrap" skok spadne z ~28 na ~1
   (rozdíl dvou sousedních sloupců, ne dvou protilehlých hran).
2. **Zacelení středního kříže** — v pásu kolem nové nespojitosti se obrázek
   proloží rozmazanou kopií, s měkkým úbytkem do stran (jako clone/heal štětcem
   v editoru). Rozostří se jen tenký kříž, zbytek zůstane ostrý.
3. **Srovnání okrajů** — protilehlé hrany se v tenkém pásu stáhnou na jejich
   průměr. Tím je wrap skok přesně 0, ne jen "malý".

Výsledek se hodí pro **světové (sliding) vzorkování** ve hře: dlaždice pak není
samostatný obrázek, ale klouzavé okno po torusu, takže švy nevznikají vůbec.

Použití
-------
    python scripts/seamless_tiles.py --check            # nic nemění, jen změří
    python scripts/seamless_tiles.py                    # přepíše assets/tiles
    python scripts/seamless_tiles.py --dir assets/tiles --out assets/tiles_seamless
    python scripts/seamless_tiles.py --band 24 --radius 8 --edge 16

Vyžaduje: pillow + numpy (venv ComfyUI). Před spuštěním commitni — skript
přepisuje assety (git je pak umí vrátit).
"""
import argparse
import glob
import os
import sys

import numpy as np
from PIL import Image, ImageFilter


def hf_energy(a):
    """Vysokofrekvenční energie — pokles = ztráta ostrosti."""
    g = a.mean(axis=2)
    return float(np.abs(np.diff(g, axis=1)).mean() + np.abs(np.diff(g, axis=0)).mean())


def wrap_delta(a):
    h = float(np.abs(a[:, 0, :] - a[:, -1, :]).mean())
    v = float(np.abs(a[0, :, :] - a[-1, :, :]).mean())
    return h, v


def cross_step(a):
    """Skok na středovém kříži (tam, kde po posunu zůstala nespojitost)."""
    h, w, _ = a.shape
    hx = float(np.abs(a[:, w//2 - 1, :] - a[:, w//2, :]).mean())
    vy = float(np.abs(a[h//2 - 1, :, :] - a[h//2, :, :]).mean())
    return hx, vy


def heal(arr, band=28.0, radius=8.0, edge=16):
    """Posun o polovinu + zacelení kříže + srovnání okrajů. Vrací float RGB."""
    h, w, _ = arr.shape
    b = np.roll(np.roll(arr, w // 2, axis=1), h // 2, axis=0).astype(np.float32)

    # maska kříže: 1 v ose nespojitosti, 0 daleko od ní (gaussovský úbytek)
    xs = np.arange(w)[None, :]
    ys = np.arange(h)[:, None]
    mx = np.exp(-((xs - w / 2.0) / band) ** 2)
    my = np.exp(-((ys - h / 2.0) / band) ** 2)
    mask = np.maximum(np.broadcast_to(mx, (h, w)), np.broadcast_to(my, (h, w)))

    blurred = np.asarray(
        Image.fromarray(b.astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
    ).astype(np.float32)
    out = b * (1 - mask[:, :, None]) + blurred * mask[:, :, None]

    # srovnání protilehlých okrajů v pásu `edge` px (přesný wrap = 0)
    if edge > 0:
        k = min(edge, w // 4, h // 4)
        t = np.linspace(1.0, 0.0, k) ** 2          # 1 na hraně -> 0 na konci pásu
        for axis, n in ((1, w), (0, h)):
            first = np.take(out, 0, axis=axis)
            last = np.take(out, n - 1, axis=axis)
            avg = 0.5 * (first + last)
            for i in range(k):
                weight = t[i]
                cur = np.take(out, i, axis=axis)
                np.moveaxis(out, axis, 0)[i] = cur * (1 - weight) + avg * weight
                cur = np.take(out, n - 1 - i, axis=axis)
                np.moveaxis(out, axis, 0)[n - 1 - i] = cur * (1 - weight) + avg * weight
    return out


def process(path, out_path, args, check):
    img = Image.open(path).convert('RGB')
    a = np.asarray(img).astype(np.float32)
    h0, v0 = wrap_delta(a)
    hx0, vy0 = cross_step(np.roll(np.roll(a, a.shape[1] // 2, axis=1), a.shape[0] // 2, axis=0))
    name = os.path.basename(path)

    if check:
        print(f'  {name:18s} wrap {h0:6.2f}/{v0:6.2f}  kriz {hx0:5.2f}/{vy0:5.2f}  '
              f'HF {hf_energy(a):5.2f}')
        return (h0 + v0) / 2, None

    if h0 + v0 < args.skip_below:
        if out_path != path:
            img.save(out_path, quality=args.quality)
        print(f'  {name:18s} uz je bezesve ({h0:.2f}/{v0:.2f}) -> preskoceno')
        return 0.0, 0.0

    out = heal(a, args.band, args.radius, args.edge)
    h1, v1 = wrap_delta(out)
    hx1, vy1 = cross_step(out)
    loss = 100.0 * (1.0 - hf_energy(out) / max(0.01, hf_energy(a)))
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(
        out_path, quality=args.quality)
    print(f'  {name:18s} wrap {h0:6.2f}/{v0:6.2f} -> {h1:4.2f}/{v1:4.2f}   '
          f'kriz {hx0:5.2f}/{vy0:5.2f} -> {hx1:5.2f}/{vy1:5.2f}   '
          f'ztrata ostrosti {loss:4.1f} %')
    return (h0 + v0) / 2, (h1 + v1) / 2


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', default='assets/tiles')
    ap.add_argument('--out', default=None, help='vystupni adresar (default: prepsat vstup)')
    ap.add_argument('--band', type=float, default=28.0, help='sirka pasu na krizi (px)')
    ap.add_argument('--radius', type=float, default=8.0, help='polomer rozostreni')
    ap.add_argument('--edge', type=int, default=16, help='pas pro srovnani okraju (px)')
    ap.add_argument('--quality', type=int, default=95)
    ap.add_argument('--skip-below', type=float, default=1.0,
                    help='kdyz je wrap pod timto, nechat soubor byt')
    ap.add_argument('--check', action='store_true', help='jen zmerit, nemenit')
    args = ap.parse_args()

    files = sorted(f for f in glob.glob(os.path.join(args.dir, '*.*'))
                   if f.lower().endswith(('.jpg', '.jpeg', '.png')))
    if not files:
        print('zadne dlaždice v', args.dir)
        return 1

    out_dir = args.out or args.dir
    os.makedirs(out_dir, exist_ok=True)
    print(('[kontrola] ' if args.check else '[heal] ') +
          f'{len(files)} souboru z {args.dir}' +
          ('' if args.check else f' -> {out_dir}'))

    before, after = [], []
    for path in files:
        ext = '.png' if path.lower().endswith('.png') else '.jpg'
        out_path = path if out_dir == args.dir else os.path.join(
            out_dir, os.path.splitext(os.path.basename(path))[0] + ext)
        b, a = process(path, out_path, args, args.check)
        before.append(b)
        if a is not None:
            after.append(a)

    print(f'\nprumer wrap: pred {np.mean(before):6.2f}' +
          ('' if args.check else f'  ->  po {np.mean(after):6.2f}'))
    if not args.check and np.mean(after) > 2.5:
        print('VYSLEDEK: CHYBA - wrap zustal vysoky, pridej --band / --edge')
        return 1
    print('VYSLEDEK: ' + ('OK (jen kontrola)' if args.check else 'OK'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
