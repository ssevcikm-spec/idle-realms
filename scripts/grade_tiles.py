#!/usr/bin/env python
"""Srovná barvy AI dlaždic na cílový průměr terénu (čitelné ve hře).

Používá se PŘED nasazením dlaždic do `assets/tiles/`. Důvod: hra nesmí číst
pixely za běhu (file:// canvas taint), takže barevnou korekci děláme tady.

Použití:
    python scripts/grade_tiles.py [adresar] [cil]

Výchozí adresář: assets/tiles. Každé `*.jpg` se přepíše srovnanou verzí
(původní průměr -> cílový průměr terénu, mírný kontrast 1.06).

Vyžaduje: pillow + numpy (jsou ve venv ComfyUI, nebo pip install pillow numpy).
"""
import sys, os
from PIL import Image
import numpy as np

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
CONTRAST = 1.06

def grade(path):
    stem = os.path.basename(path)
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
    d = sys.argv[1] if len(sys.argv) > 1 else 'assets/tiles'
    files = sorted(f for f in os.listdir(d) if f.lower().endswith('.jpg'))
    if not files:
        print('zadne jpg v', d)
        return
    print(f'graduji {len(files)} souboru v {d}:')
    for f in files:
        grade(os.path.join(d, f))
    print('HOTOVO')

if __name__ == '__main__':
    main()
