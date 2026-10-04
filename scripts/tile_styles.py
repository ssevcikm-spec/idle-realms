#!/usr/bin/env python
"""Společné díly promptu pro OBA generátory dlaždic — Pollinations i ComfyUI.

Proč zvlášť: sada vygenerovaná online a sada z ComfyUI se musí dát srovnávat,
takže oba generátory musí skládat prompt ze **stejných předmětů terénů**
(`TERRAINS`), **stejných stylů** (`STYLES`) a **stejného souboru vlastních
promptů** (`tile_prompts.txt`, funkce `load_prompts`). Kdyby si každý skript
držel vlastní kopii, rozejdou se a srovnání přestane něco znamenat.

Liší se jen **základ věty** (`BASE_ONLINE` vs. `BASE_LOCAL`): Pollinations
odřezává prompty nad ~350 znaků (`LIMIT_ONLINE`), kdežto SDXL v ComfyUI delší
prompt unese a je na něm vidět víc (bezešvost hran, hmat, „grim medieval").
Zbytek — styl, vlastní prompty, `{subject}`/`{style}` — je společný.

Používá bez GUI, jen text: `tile_styles` nesahá na síť ani na ComfyUI.
"""
# Kanonické pořadí terénů = pořadí v G.PAL (js/render/art.js) a v tiles_ai.js.
TERRAINS = {
    'grass':       'short wild grass with tiny wildflowers and small stones',
    'forest':      'forest floor with pine needles, moss patches and ferns',
    'deep_forest': 'dark forest floor, deep moss, roots and rotten leaves',
    'hills':       'dry rocky ground with gravel and sparse dry grass',
    'mountain':    'bare grey mountain rock with cracks and frost patches',
    'water':       'calm deep river water surface with small ripples',
    'swamp':       'murky swamp water with mud, reeds and algae',
    'snow':        'level snow-covered ground with subtle drifts',
    'road':        'packed dirt road with wheel ruts and small stones',
    'dirt':        'packed bare dirt ground with pebbles and hoof prints',
}

# Styl = jen to, co se přidá za texturu terénu; prázdný = bez stylu.
STYLES = {
    'plain': '',
    # ilustrační podání kroniky: u dlaždic propadlo (dělá z textury scenérii)
    'kronika': ('old chronicle illustration style, sepia and olive ink linework '
                'with hatching'),
    # týž motiv, ale popsaný jako textura (viz STYL_GRAFIKY.md §8.6)
    'kronika-tex': ('grim medieval ink linework and hatching, desaturated sepia '
                    'and olive earth tones'),
    # Kreslený („hand drawn“), sada `tiles_drawn` z 20. 9. 2026. Nese navíc
    # MĚŘÍTKO, protože samotný BASE_LOCAL měřítko neuhlídá: naměřeno, že všech
    # pět kontrolovaných dlaždic vyšlo jako **záběr z ~1–2 m** (jednotlivé
    # kameny, květiny a praskliny místo masy) — vision to potvrdil u hills,
    # mountain, water, snow i swamp. Proto je tu i „no individual …“.
    'drawn': ('hand drawn game map texture seen from a high altitude aerial view, '
              'landscape scale masses and patches instead of single objects, '
              'no individual stones, no individual flowers, no single large object, '
              'fine uniform detail, muted earthy palette, ink linework with subtle '
              'hatching, matte finish'),
}

# Základ věty pro online generátor (Pollinations): krátký, musí se vejít do limitu.
BASE_ONLINE = ('Seamless tileable {subject} texture, top-down orthographic ground '
               'texture for a 2D game map, flat even lighting, no horizon, no sky, '
               'no central object, no vignette, no border, uniform detail readable '
               'at 46x46 px')

# Základ věty pro ComfyUI (SDXL Juggernaut XL): delší, bez limitu na délku.
BASE_LOCAL = ('Seamless tileable texture of {subject}, top-down orthographic ground '
              'texture for a 2D game map, even flat lighting, no central object, '
              'no vignette, no border, edges must match when the tile is repeated. '
              'Grim medieval game art, desaturated earthy tones, crisp detail '
              'readable at 46x46 px.')

# Pollinations odřezává delší prompty (měřeno); ComfyUI limit nemá.
LIMIT_ONLINE = 350


def prompt_texture(subject, style='', base=BASE_ONLINE):
    """Prompt na **plochou** texturu z vestavěného základu."""
    p = base.replace('{subject}', subject)
    return (p + (', ' + style if style else '')).strip()


def load_prompts(path):
    """Načte vlastní prompty: (šablona, {terén: prompt}).

    Formát (viz `scripts/tile_prompts.txt`) — řádky `klíč = hodnota`, `#` je
    komentář:
        template = ... {subject} ... {style} ...   (pro všechny terény)
        forest   = celý vlastní prompt pro terén forest
    """
    tpl, per = None, {}
    with open(path, encoding='utf-8') as fh:
        for line in fh:
            line = line.split('#', 1)[0].strip()
            if not line or '=' not in line:
                continue
            key, val = line.split('=', 1)
            key, val = key.strip().lower(), val.strip()
            if not val:
                continue
            if key == 'template':
                tpl = val
            elif key in TERRAINS:
                per[key] = val
            else:
                print('  (prompty: neznamy klic "%s" - preskakuji)' % key, flush=True)
    return tpl, per


def build_prompt(terrain, style, tpl=None, per=None, base=BASE_ONLINE):
    """Prompt pro terén: vlastní > šablona > vestavěný. Vrací (prompt, zdroj)."""
    per = per or {}
    if terrain in per:
        return per[terrain], 'vlastni'
    if tpl:
        p = tpl.replace('{subject}', TERRAINS[terrain]).replace('{style}', style)
        if style and '{style}' not in tpl:
            p = (p + ', ' + style).strip().rstrip(',')
        return p, 'sablona'
    return prompt_texture(TERRAINS[terrain], style, base), 'vestaveny'
