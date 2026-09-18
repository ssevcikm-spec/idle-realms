#!/usr/bin/env python
"""Vygeneruje a zpracuje celou sadu dlaždic JEDNÍM příkazem.

Proč: ruční pipeline je pět kroků a čtyři adresáře (raw/flat/graded/final) —
a člověk, který si chce jen zkusit vygenerovat vlastní mapu, na tom zbytečně
ztroskotá. Tenhle skript je „kuchařka pro blbečka": zavolá pod sebou
`gen_tiles.py` → (podle potřeby `flatten_tiles.py`) → `grade_tiles.py` →
`seamless_tiles.py` a nakonec změří, co vzniklo.

Co dělá samo:
- vygeneruje textury (Pollinations, zdarma, bez klíče),
- **pozná, jestli generátor nevyrobil scénu místo textury** (`tile_flatness.py`)
  a když ano, odečte kompozici (`flatten_tiles.py`) — jinak dlaždice vypadají
  dobře v jednom obrázku, ale v mozaice je z nich poznat horizont a ústřední motiv,
- srovná barvy na paletu hry a zacelí šev (aby dlaždice tileovaly),
- vypíše, co změřilo a **jak si sadu zobrazit ve hře**.

Příklady:
    # vlastní sada z motivu kroniky (dlaždice se objeví jako assets/tiles_moje/final)
    python scripts/make_tile_set.py --name moje --style kronika-tex

    # přepsat kandidátskou sadu, která už má tlačítko v debug panelu hry
    python scripts/make_tile_set.py --name kronika-tex --style kronika-tex

    # rychlý test (jen dva terény, jedna textura) — do hry se to nepoužije
    python scripts/make_tile_set.py --name zkouska --only grass,water --variants 1

Spouštěj pythonem, který má pillow + numpy (venv ComfyUI):
    & 'D:\\ComfyUI\\venv-comfy\\Scripts\\python.exe' scripts\\make_tile_set.py ...
"""
import argparse
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PY = sys.executable or 'python'

# Sady, které už mají tlačítko v debug panelu hry (G.TILE_SETS v tiles_ai.js).
SLOTS = {
    'kronika':     ('assets/tiles_kronika',     'kronika-ilustrace'),
    'kronika-tex': ('assets/tiles_kronika_tex', 'kronika-textura'),
}


def run(args, label):
    """Spustí podskript a vrátí True/False podle návratového kódu."""
    print('\n--- %s ---' % label, flush=True)
    code = subprocess.call([PY] + args, cwd=ROOT)
    if code != 0:
        print('    (krok skoncil s kodem %d)' % code, flush=True)
    return code == 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--name', default='moje',
                    help="nazev sady: 'kronika'/'kronika-tex' prepise kandidata s tlacitkem ve hre,"
                         " jine jmeno udela vlastni slozku assets/tiles_<nazev>")
    ap.add_argument('--style', default='kronika-tex',
                    choices=['plain', 'kronika', 'kronika-tex'],
                    help='kronika-tex = motiv kroniky popsany jako textura (u dlazdic nejlepsi)')
    ap.add_argument('--only', default='', help='jen tyto tereny (grass,water) - na rychly test')
    ap.add_argument('--variants', type=int, default=2, help='textur na teren (hra pouziva 1 a 2)')
    ap.add_argument('--radius', type=float, default=48.0, help='odecteni kompozice (px)')
    ap.add_argument('--no-flatten', action='store_true',
                    help='neodecitat kompozici, i kdyz dlaždice vypadaji jako sceny')
    args = ap.parse_args()

    base = SLOTS[args.name][0] if args.name in SLOTS else 'assets/tiles_%s' % args.name
    label = SLOTS[args.name][1] if args.name in SLOTS else args.name
    raw, flat = base + '/raw', base + '/flat'
    graded, final = base + '/graded', base + '/final'

    print('sada      : %s  ->  %s' % (label, final))
    print('styl      : %s   terenu: %s   textur na teren: %d'
          % (args.style, args.only or 'vsech 10', args.variants))

    gen = [os.path.join(HERE, 'gen_tiles.py'), '--style', args.style, '--out', raw,
           '--variants', str(args.variants)]
    if args.only:
        gen += ['--only', args.only]
    if not run(gen, '1/5 generuji textury (Pollinations)'):
        print('\nVYSLEDEK: CHYBA - textury se nevygenerovaly (internet? zkus to znovu)')
        return 1

    # Je to plocha textura, nebo omylem obrazek sceny? (0 = v poradku)
    print('\n--- 2/5 kontroluji, jestli to jsou ploche textury ---', flush=True)
    code = subprocess.call([PY, os.path.join(HERE, 'tile_flatness.py'), raw], cwd=ROOT)
    src = raw
    if code != 0 and not args.no_flatten:
        if not run([os.path.join(HERE, 'flatten_tiles.py'), raw, flat,
                    '--radius', str(args.radius)], '2b/5 odecitam kompozici (sceny)'):
            return 1
        src = flat
    elif code == 0:
        print('    vsechny dlazdice jsou ploche textury - flatten neni potreba', flush=True)

    if not run([os.path.join(HERE, 'grade_tiles.py'), src, graded],
               '3/5 srovnavam barvy na paletu hry'):
        return 1
    if not run([os.path.join(HERE, 'seamless_tiles.py'), '--dir', graded, '--out', final],
               '4/5 zadelavam sev (aby dlazdice tileovaly)'):
        return 1

    print('\n--- 5/5 merim, co vzniklo ---', flush=True)
    subprocess.call([PY, os.path.join(HERE, 'tile_flatness.py'), final], cwd=ROOT)
    subprocess.call([PY, os.path.join(HERE, 'check-tiles.py'), '--dir', final,
                     '--scheme', 'sliding', '--repeat', '6'], cwd=ROOT)
    subprocess.call([PY, os.path.join(HERE, 'tile_sharpness.py'), final, '--ref', src], cwd=ROOT)

    print('\nhotovo. Jak se na sadu podivat:')
    if args.name in SLOTS:
        print('  * Ve HRE: otevri hru, zmackni D, sekce "Mapa - vzhled"')
        print('    a klikni na "%s" (vzhled se sam prepne na malovany).' % label)
    else:
        print('  * Ve HRE: pridej radek do G.TILE_SETS v js/render/tiles_ai.js:')
        print("      { id: '%s', dir: '%s/', name: '%s' }," % (args.name, final, args.name))
        print('    pak zmackni D -> "Mapa - vzhled" a klikni na "%s".' % args.name)
    print('  * VEDLE SEBE (mozika 4x4, nic se neinstaluje):')
    print('      python scripts/compare_tiles.py --old assets/tiles --new %s '
          '--out %s/srovnani.html' % (final, base))
    if args.only:
        print('\nPozor: generoval jsi jen tereny "%s", takze sada neni kompletni -'
              % args.only)
        print('       ve hre se chybejici tereny kresli kreslene (hra to ustojí).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
