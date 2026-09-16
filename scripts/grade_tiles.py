#!/usr/bin/env python
"""Srovná barvy AI dlaždic na cílový průměr terénu (čitelné ve hře).

Používá se PŘED nasazením dlaždic do `assets/tiles/`. Důvod: hra nesmí číst
pixely za běhu (file:// canvas taint), takže barevnou korekci děláme tady.
Cílové barvy se berou z `js/render/art.js` (`G.PAL`) přes `tile_palette.py`, aby
kreslená i malovaná mapa hrály stejnou paletou.

Použití:
    python scripts/grade_tiles.py [adresar] [cil]

Výchozí adresář: assets/tiles. Každé `*.jpg` se přepíše srovnanou verzí
(původní průměr -> cílový průměr terénu, mírný kontrast 1.06).

Vyžaduje: pillow + numpy (jsou ve venv ComfyUI, nebo pip install pillow numpy).
"""
import sys, os
from PIL import Image
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tile_palette import TARGET  # jediný zdroj barev = js/render/art.js (G.PAL)

CONTRAST = 1.06

def grade(path):
    stem = os.path.basename(path).split('.')[0]
    terrain = stem.split('-')[0]
    tgt = TARGET.get(terrain)
    img = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    mean = img.mean(axis=(0, 1))
    if tgt is None:
        print(f'  {stem}: preskoceno (neznamy teren)')
        return
    shift = np.array(tgt) - mean
    out = np.clip((img - mean) * CONTRAST + mean + shift, 0, 255).astype(np.uint8)
    Image.fromarray(out, 'RGB').save(path)
    print(f'  {stem}: {mean.round(0).astype(int).tolist()} -> {tgt}')

def main():
    src = sys.argv[1] if len(sys.argv) > 1 else 'assets/tiles'
    out_dir = sys.argv[2] if len(sys.argv) > 2 else src
    os.makedirs(out_dir, exist_ok=True)
    files = sorted(f for f in os.listdir(src)
                   if f.lower().endswith(('.jpg', '.png')) and not f.startswith('.'))
    if not files:
        print('zadne dlaždice v', src)
        return
    print(f'graduji {len(files)} souboru z {src} -> {out_dir}:')
    for f in files:
        stem = f.rsplit('.', 1)[0]
        out_path = os.path.join(out_dir, stem + '.jpg')
        # grade do dočasného souboru, ať můžu měnit vstupní/výstupní složku
        grade_into(os.path.join(src, f), out_path)
    print('HOTOVO')


def grade_into(path, out_path):
    stem = os.path.basename(out_path).split('.')[0]
    terrain = stem.split('-')[0]
    tgt = TARGET.get(terrain)
    img = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    mean = img.mean(axis=(0, 1))
    if tgt is None:
        print(f'  {stem}: preskoceno (neznamy teren)')
        return
    shift = np.array(tgt) - mean
    out = np.clip((img - mean) * CONTRAST + mean + shift, 0, 255).astype(np.uint8)
    Image.fromarray(out, 'RGB').save(out_path, quality=92)
    print(f'  {stem}: {mean.round(0).astype(int).tolist()} -> {tgt}')


if __name__ == '__main__':
    main()
