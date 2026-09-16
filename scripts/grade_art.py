#!/usr/bin/env python
"""Srovná ilustraci do palety hry (vrstva 3: titul, příběhové scény, portréty).

Proč: generátor obrázků dodá obrázek ve svém vlastním barevném světě — jasnější,
sytější, často s barvami, které ve hře vůbec nejsou. Když se položí vedle mapy,
je vidět, že to není jedna hra. Tenhle skript obrázek **jemně** přitáhne
k tónu projektu (`scripts/tile_palette.py` → `tone()`, odvozeno z `G.PAL`):

1. **Barevný nádech** — posune průměrnou barvu k průměru palety.
2. **Jas** — jen mírně přiměří rozsah jasu k rozsahu palety (kompozice zůstává).
3. **Sytost** — měkký STROP sytosti (neonové barvy stáhne, ostatní nechá).

Průhlednost se nemění a do statistik se **nepočítají průhledné pixely** (jinak
by čísla mátla: sprity postav mají průhledné pozadí a jeho RGB je nesmysl).

Síla se řídí `--strength` (0 = beze změny, 1 = plné srovnání); výchozí 0.5, což
je záměrně málo — ilustrace má být bohatší než dlaždice, jen nesmí utéct
z palety.

Použití:
    python scripts/grade_art.py --check                 # jen změřit, nic nemění
    python scripts/grade_art.py --in obrazek.png --out srovnany.png
    python scripts/grade_art.py --in assets/art --out assets/art_srovnane

Vyžaduje: pillow + numpy (venv ComfyUI).
"""
import argparse
import glob
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tile_palette import tone, all_colors, saturation  # jediný zdroj = G.PAL (art.js)

EXTS = ('.png', '.jpg', '.jpeg', '.webp')
SAT_CAP = 0.55          # strop sytosti: nad ním už je barva „neonová"
ALPHA_MIN = 16          # pixely s menší alfou se do statistik nepočítají


def visible(rgb, alpha=None):
    """Maska viditelných pixelů (kvůli průhlednému pozadí spritů)."""
    if alpha is None:
        return np.ones(rgb.shape[:2], dtype=bool)
    return alpha > ALPHA_MIN


def _saturation(arr):
    """Saturace po pixelech (HSV: (max-min)/max)."""
    mx = arr.max(axis=2)
    mn = arr.min(axis=2)
    return np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0.0)


def _luma(arr):
    """Jas — funguje pro obraz (H,W,3) i pro seznam pixelů (N,3)."""
    return 0.2126 * arr[..., 0] + 0.7152 * arr[..., 1] + 0.0722 * arr[..., 2]


def _cast(arr, mask, ref):
    """Jak moc má obrázek stejný barevný nádech jako paleta (kosinus -1..1).

    Měří se SMĚR odchylky od šedé, počítaný po pixelech (ne z průměrné barvy —
    u skoro šedého obrázku je průměrná odchylka šum). Ilustrace může být
    legitimně tmavší nebo světlejší než krajina, ale nesmí mít jinou barevnost
    (např. modrou tam, kde je paleta teplá olivová).
    """
    px = arr[mask].reshape(-1, 3)
    if px.size == 0:
        return 1.0
    m = (px - _luma(px)[:, None]).mean(axis=0)
    r = np.array(ref, dtype=np.float64)
    b = r - r.mean()
    na, nb = np.linalg.norm(m), np.linalg.norm(b)
    if na < 1e-6 or nb < 1e-6:
        return 1.0
    return float(np.dot(m, b) / (na * nb))


def stats(rgb, alpha=None):
    """Čísla, kterými se srovnání ověřuje (viz scripts/check-art.py)."""
    mask = visible(rgb, alpha)
    px = rgb[mask].reshape(-1, 3) if mask.any() else rgb.reshape(-1, 3)
    tn = tone()
    pal = np.array(all_colors(), dtype=np.float32)
    d = np.sqrt(((px[:, None, :] - pal[None, :, :]) ** 2).sum(axis=2))
    nearest = d.min(axis=1)
    sat = _saturation(rgb)[mask] if mask.any() else _saturation(rgb).ravel()
    lum = _luma(rgb)[mask] if mask.any() else _luma(rgb).ravel()
    return {
        'tone': float(np.linalg.norm(px.mean(axis=0) - np.array(tn['mean']))),
        'cast': _cast(rgb, mask, tn['mean']),
        'sat': float(sat.mean()),
        'sat_high': float((sat > 0.6).mean()),     # podíl neonových pixelů
        'gamut': float((nearest > 120).mean()),     # podíl pixelů mimo paletu
        'contrast': float(lum.std()),
    }


def grade(arr, strength=0.5, alpha=None):
    """Srovná RGB pole (float 0..255) do tónu projektu. Vrací nové pole.

    Pořadí je dané: nádech -> jas -> sytost. Sytost až nakonec, protože
    předchozí kroky mění jas a tím i sytost.
    """
    tn = tone()
    mask = visible(arr, alpha)
    target_mean = np.array(tn['mean'], dtype=np.float32)
    src = arr[mask].reshape(-1, 3) if mask.any() else arr.reshape(-1, 3)
    out = arr + (target_mean - src.mean(axis=0)) * float(strength)

    # jas: jen mírné přiměření k rozsahu palety
    lo, hi = np.percentile(_luma(out)[mask] if mask.any() else _luma(out), [2.0, 98.0])
    t_lo = float(tn['lum_min']) * 0.55
    t_hi = min(255.0, float(tn['lum_max']) * 1.15)
    if hi - lo > 1e-3:
        mid = (lo + hi) / 2.0
        k_lo = float(np.clip(1.0 + ((t_lo - lo) / (hi - lo) - 1.0) * float(strength) * 0.35, 0.9, 1.12))
        k_hi = float(np.clip(1.0 + ((t_hi - lo) / (hi - lo) - 1.0) * float(strength) * 0.35, 0.9, 1.12))
        out = out * np.where(_luma(out) < mid, k_lo, k_hi)[:, :, None]

    # sytost: měkký STROP v HSV. Pozor na dvě pasti, které jsem naměřil:
    #  - krácení chromy `mx - mn` sytost nezmění (max i min se zmenší stejně),
    #  - mísení k šedé o stejném jasu ji taky skoro nezmění (max zůstane vysoké).
    # Správně se pro pixely nad stropem zvedne MINIMUM na `mx*(1-cap)`, takže
    # S = (mx-mn)/mx spadne přesně na strop.
    mx = out.max(axis=2, keepdims=True)
    mn = out.min(axis=2, keepdims=True)
    chroma = mx - mn
    cap = 1.0 - (1.0 - SAT_CAP) * float(strength)     # síla určuje, kam až strop jde
    s = np.where(mx > 1e-6, chroma / np.maximum(mx, 1e-6), 0.0)
    over = s > cap
    if over.any():
        target_min = mx * (1.0 - cap)
        scale = (mx - target_min) / np.maximum(chroma, 1e-6)
        capped = target_min + (out - mn) * scale
        out = np.where(over, capped, out)
    return np.clip(out, 0, 255)


def process(path, out_path, strength, do_check):
    img = Image.open(path)
    has_alpha = img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info)
    img = img.convert('RGBA' if has_alpha else 'RGB')
    arr = np.asarray(img).astype(np.float32)
    rgb, alpha = arr[:, :, :3], (arr[:, :, 3] if has_alpha else None)
    before = stats(rgb, alpha)
    line = '  %-22s ton %5.1f  nadech %4.2f  neon %4.1f %%  mimo %4.1f %%  kontrast %5.1f'
    if do_check:
        print(line % (os.path.basename(path), before['tone'], before['cast'],
                      before['sat_high'] * 100, before['gamut'] * 100, before['contrast']))
        return before, before

    out = grade(rgb, strength, alpha)
    after = stats(out, alpha)
    if alpha is not None:
        out_img = Image.fromarray(np.dstack([out, alpha]).astype(np.uint8), 'RGBA')
    else:
        out_img = Image.fromarray(out.astype(np.uint8), 'RGB')
    if out_path.lower().endswith(('.jpg', '.jpeg')):
        out_img.convert('RGB').save(out_path, quality=92)
    else:
        out_img.save(out_path)
    print((line + '   -> ton %5.1f  nadech %4.2f  neon %4.1f %%  mimo %4.1f %%') % (
        os.path.basename(path), before['tone'], before['cast'],
        before['sat_high'] * 100, before['gamut'] * 100, before['contrast'],
        after['tone'], after['cast'], after['sat_high'] * 100, after['gamut'] * 100))
    return before, after


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='src', default='assets/art',
                    help='soubor nebo adresář s ilustracemi')
    ap.add_argument('--out', dest='dst', default=None,
                    help='kam zapsat (u adresáře se vytvoří)')
    ap.add_argument('--strength', type=float, default=0.5, help='0..1, jak silně srovnat')
    ap.add_argument('--check', action='store_true', help='jen změřit, nic nezapisovat')
    args = ap.parse_args()
    if not 0.0 <= args.strength <= 1.0:
        print('strength musi byt 0..1')
        return 1

    files = []
    if os.path.isdir(args.src):
        files = sorted(f for f in glob.glob(os.path.join(args.src, '*.*'))
                       if f.lower().endswith(EXTS))
    elif os.path.isfile(args.src):
        files = [args.src]
    if not files:
        print('zadne ilustrace v', args.src)
        print('(ilustrace se sem pridaji, az se vybere vzhled - viz docs/STYL_GRAFIKY.md)')
        return 0

    check_only = args.check
    print(('[kontrola] ' if check_only else '[srovnani] ') +
          '%d souboru, sila %.2f' % (len(files), args.strength))
    out_dir = None
    if not check_only and os.path.isdir(args.src):
        out_dir = args.dst or (args.src + '_srovnane')
        os.makedirs(out_dir, exist_ok=True)

    tones_before, tones_after = [], []
    for path in files:
        if check_only:
            out_path = None
        elif out_dir:
            out_path = os.path.join(out_dir, os.path.splitext(os.path.basename(path))[0] + '.png')
        else:
            out_path = args.dst or path
        b, a = process(path, out_path, args.strength, check_only)
        tones_before.append(b['tone'])
        tones_after.append(a['tone'])

    print('\nprumer odchylky od tonu projektu: %.1f -> %.1f' % (
        float(np.mean(tones_before)), float(np.mean(tones_after))))
    print('VYSLEDEK: OK')
    return 0


if __name__ == '__main__':
    sys.exit(main())
