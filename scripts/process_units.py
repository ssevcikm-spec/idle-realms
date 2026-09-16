#!/usr/bin/env python
"""Odstraní pozadí postav, ořízne a zmenší na sprite.

Postavy se generují jako tmavá (nebo světlá) postava uprostřed na opačném
podkladu. Polaritu zjistíme porovnáním jasu středu a okraje, pak prahujeme jas
a ponecháme největší souvislou oblast uprostřed (postavu). Funguje to i když
podklad není jednolitý (gradient, vinětace) a i když se postava dotýká okraje.

Vstup:  assets/units_gen/<id>.png
Výstup: assets/units/<id>.png  (průhledné PNG, výška ~96 px)
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = 'assets/units_gen'
DST = 'assets/units'
TARGET_H = 96
PAD = 8             # odsazení ořezu kolem popředí (px)
CLOSE = 7           # propojí fragmenty postavy, uzavře díry


def process(src, dst):
    rgb = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    h, w, _ = rgb.shape
    lum = rgb.mean(axis=-1)

    # Polarita: je postava tmavší, nebo světlejší než pozadí?
    c = lum[int(h * 0.3):int(h * 0.7), int(w * 0.3):int(w * 0.7)]
    border = np.concatenate([lum[0, :], lum[-1, :], lum[:, 0], lum[:, -1]])
    c_med, b_med = np.median(c), np.median(border)
    thr = (c_med + b_med) / 2.0
    fg = (lum < thr) if c_med < b_med else (lum > thr)

    fg = ndimage.binary_closing(fg, structure=np.ones((CLOSE, CLOSE)))
    labels, n = ndimage.label(fg)
    if n == 0:
        return False
    sizes = ndimage.sum(fg, labels, range(1, n + 1))
    keep_label = int(np.argmax(sizes)) + 1
    keep = (labels == keep_label)

    alpha = keep.astype(np.uint8) * 255
    ys, xs = np.where(alpha > 0)
    if len(xs) == 0:
        return False

    rgba = np.asarray(Image.open(src).convert('RGBA')).copy()
    rgba[..., 3] = alpha
    img = Image.fromarray(rgba, 'RGBA')
    x0, x1 = xs.min(), xs.max(); y0, y1 = ys.min(), ys.max()
    x0 = max(0, x0 - PAD); y0 = max(0, y0 - PAD)
    x1 = min(img.width, x1 + PAD); y1 = min(img.height, y1 + PAD)
    crop = img.crop((x0, y0, x1, y1))
    tw = max(1, round(crop.width * TARGET_H / crop.height))
    crop.resize((tw, TARGET_H), Image.LANCZOS).save(dst)
    return True


def main():
    os.makedirs(DST, exist_ok=True)
    files = sorted(f for f in os.listdir(SRC) if f.lower().endswith('.png'))
    print(f'zpracovavam {len(files)} postav z {SRC}:')
    for f in files:
        ok = process(os.path.join(SRC, f), os.path.join(DST, f))
        print(f'  {f}: {"OK" if ok else "preskoceno/nezdar"}')
    print('HOTOVO')


if __name__ == '__main__':
    main()
