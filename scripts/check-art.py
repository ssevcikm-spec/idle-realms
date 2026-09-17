#!/usr/bin/env python
"""Změří ilustrace (vrstva 3) — drží je hra v jedné paletě?

Proč: ilustrace z generátoru mají vlastní barevný svět (sytější, jasnější, často
barvy, které ve hře nejsou). Okem se to pozná až ve hře, takže se to měří.
Do statistik se nepočítají průhledné pixely (sprity je mají a jejich RGB je
nesmysl, který by čísla vychýlil).

| metrika | co znamená | limit |
|---|---|---|
| `nadech` | kosinus směru od šedé proti nádechu palety (teplá olivová) | ≥ 0.45 |
| `neon` | podíl pixelů se saturací > 0.6 | ≤ 0.10 |
| `mimo` | podíl pixelů dál než 120 od NEJBLIŽŠÍ barvy palety | ≤ 0.25 |
| `kontrast` | směrodatná odchylka jasu (ilustrace nesmí být plochá) | ≥ 12 |

Použití:
    python scripts/check-art.py                      # projde assets/art
    python scripts/check-art.py --dir assets/units   # libovolný adresář
    python scripts/check-art.py --dir assets/props --mode props
    python scripts/check-art.py --selftest           # ověří sama sebe

Dva režimy, protože ilustrace a jednotlivé sprity mají různé nároky:
- `illustration` (výchozí) — celá scéna má mít **nádech palety** (`nadech` ≥ 0,45).
- `props` — samostatný objekt (závěj, pěna, skála) být teplý nemusí; důležité je,
  že jeho barvy leží **v paletě** (`mimo` ≤ 25 %) a nejsou neonové. Limit nádechu
  je proto mírnější (≥ 0,20); naměřeno: bílá závěj má nádech 0,41 a modravá pěna
  0,38, přitom obojí je z palety (voda je modrá, sníh světlý).

`--selftest` vyrobí v paměti „neonový" obrázek (magenta/limetka + průhledný
okraj), prožene ho `scripts/grade_art.py` a ověří, že neonu ubylo, kompozice
zůstala a průhlednost se nezměnila. Pipeline je tím ověřená i ve chvíli, kdy
žádné ilustrace ještě nejsou.

Vyžaduje: pillow + numpy (venv ComfyUI). Návratový kód 1 = kontrola neprošla.
"""
import argparse
import glob
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tile_palette import tone  # jediný zdroj = js/render/art.js (G.PAL)
import grade_art

EXTS = ('.png', '.jpg', '.jpeg', '.webp')
# (nadech, neon, mimo paletu, kontrast)
LIMITS = {
    'illustration': (0.45, 0.10, 0.25, 12.0),
    'props':        (0.20, 0.10, 0.25, 8.0),
}
LIM_CAST, LIM_NEON, LIM_GAMUT, LIM_CONTRAST = LIMITS['illustration']


def check_image(path, mode='illustration'):
    lim_cast, lim_neon, lim_gamut, lim_contrast = LIMITS[mode]
    img = Image.open(path)
    has_alpha = img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info)
    arr = np.asarray(img.convert('RGBA' if has_alpha else 'RGB')).astype(np.float32)
    alpha = arr[:, :, 3] if has_alpha else None
    st = grade_art.stats(arr[:, :, :3], alpha)
    fails = []
    if st['cast'] < lim_cast:
        fails.append('nadech %.2f < %.2f (jiná barevnost)' % (st['cast'], lim_cast))
    if st['sat_high'] > lim_neon:
        fails.append('neon %.1f %% > %.0f %%' % (st['sat_high'] * 100, lim_neon * 100))
    if st['gamut'] > lim_gamut:
        fails.append('mimo paletu %.1f %% > %.0f %%' % (st['gamut'] * 100, lim_gamut * 100))
    if st['contrast'] < lim_contrast:
        fails.append('kontrast %.1f < %.0f (ploché)' % (st['contrast'], lim_contrast))
    ok = not fails
    print('  %-26s %s  nadech %4.2f  neon %4.1f %%  mimo %4.1f %%  kontrast %5.1f' % (
        os.path.basename(path), 'OK  ' if ok else 'CHYBA',
        st['cast'], st['sat_high'] * 100, st['gamut'] * 100, st['contrast']))
    if fails:
        print('        -> ' + '; '.join(fails))
    return ok


def selftest():
    """Vyrobí obrázek s cizí barevností a ověří, že ho pipeline srovná."""
    print('== selftest: pipeline na syntetickem obrazku ==')
    # Realistický případ: obrázek s MODRÝM nádechem (paleta je teplá olivová)
    # a malou neonovou skvrnou (pod 1 % pixelů) + průhledný okraj.
    h, w = 96, 128
    yy, xx = np.mgrid[0:h, 0:w]
    r = 90 + xx * 0.5
    g = 110 + yy * 0.6
    b = 175 + (xx + yy) * 0.3                 # modrý nádech
    arr = np.dstack([r, g, b]).astype(np.float32)
    arr[10:20, 10:20, 0] = 255                # neonová magenta skvrna
    arr[10:20, 10:20, 1] = 0
    arr[10:20, 10:20, 2] = 255
    alpha = np.full((h, w), 255, np.float32)
    alpha[:, :8] = 40                         # průhledný okraj

    before = grade_art.stats(arr, alpha)
    graded = grade_art.grade(arr, 0.5, alpha)
    after = grade_art.stats(graded, alpha)
    full_arr = grade_art.grade(arr, 1.0, alpha)
    full = grade_art.stats(full_arr, alpha)
    fmt = '  %-5s ton %6.1f  nadech %5.2f  neon %4.1f %%  mimo paletu %4.1f %%  kontrast %5.1f'
    for label, st in (('pred:', before), ('0.5:', after), ('1.0:', full)):
        print(fmt % (label, st['tone'], st['cast'], st['sat_high'] * 100,
                     st['gamut'] * 100, st['contrast']))

    failed = 0
    # 1) poloviční síla musí zlepšit nádech, tón i neon a nechat kompozici
    if not after['cast'] > before['cast']:
        print('  FAIL nadech se nezlepsil'); failed += 1
    if not after['tone'] < before['tone']:
        print('  FAIL ton se nezlepsil'); failed += 1
    if not after['sat'] < before['sat']:
        print('  FAIL sytost se nesnizi'); failed += 1
    if after['sat_high'] > before['sat_high'] + 1e-9:
        print('  FAIL neonu pribylo'); failed += 1
    if after['contrast'] < before['contrast'] * 0.5:
        print('  FAIL srovnani zplostilo obrazek (%.1f -> %.1f)' % (
            before['contrast'], after['contrast'])); failed += 1
    # 2) plná síla musí splnit limity checkeru
    if full['sat_high'] > LIM_NEON:
        print('  FAIL pri plne sile zustal neon (%.1f %%)' % (full['sat_high'] * 100)); failed += 1
    if full['gamut'] > LIM_GAMUT:
        print('  FAIL pri plne sile zustaly barvy mimo paletu (%.1f %%)' % (full['gamut'] * 100)); failed += 1
    if full['cast'] < LIM_CAST:
        print('  FAIL pri plne sile nesedi nadech (%.2f)' % full['cast']); failed += 1
    if full['contrast'] < LIM_CONTRAST:
        print('  FAIL kontrast pod limitem'); failed += 1
    # 3) monotonie: víc síly = blíž k paletě
    if not full['tone'] <= after['tone'] + 0.5:
        print('  FAIL vetsi sila neprinasi vetsi srovnani'); failed += 1

    # 4) průhlednost se nesmí změnit
    img = Image.fromarray(np.dstack([full_arr, alpha]).astype(np.uint8), 'RGBA')
    if not np.allclose(np.asarray(img).astype(np.float32)[:, :, 3], alpha):
        print('  FAIL pruhlednost se zmenila'); failed += 1

    print('  ' + ('selftest OK' if not failed else 'selftest: %d chyb' % failed))
    return failed == 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', default='assets/art')
    ap.add_argument('--mode', default='illustration', choices=list(LIMITS.keys()),
                    help='illustration = celá scéna, props = jednotlivé sprity')
    ap.add_argument('--selftest', action='store_true')
    args = ap.parse_args()

    if args.selftest:
        return 0 if selftest() else 1

    files = []
    if os.path.isdir(args.dir):
        files = sorted(f for f in glob.glob(os.path.join(args.dir, '*.*'))
                       if f.lower().endswith(EXTS))
    if not files:
        # prázdný adresář není chyba: ilustrace se přidají, až se vybere vzhled
        print('zadne ilustrace v', args.dir, '- kontrola nema co merit (OK)')
        return 0

    print('%s v %s (%d souboru, rezim %s):' % (
        'props' if args.mode == 'props' else 'ilustrace', args.dir, len(files), args.mode))
    bad = [f for f in files if not check_image(f, args.mode)]
    print()
    if bad:
        print('VYSLEDEK: CHYBY (%d z %d) - spust scripts/grade_art.py' % (len(bad), len(files)))
        return 1
    print('VYSLEDEK: OK - drzi paletu')
    return 0


if __name__ == '__main__':
    sys.exit(main())
