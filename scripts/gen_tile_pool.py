#!/usr/bin/env python
"""Vygeneruje VELKÝ POOL kandidátů na dlaždice — matice "promptová rodina × terén × seed".

Proč: u pár terénů (kopce, hory, cesta, hlína, sníh, voda) se nedaří trefit
měřítko krajiny — dvě kola promptů to neopravila. Místo dalšího hádání se vyrobí
**mnoho variant najednou** (rychlé kroky, plné rozlišení) a vítěze vybere oko
člověka v `_kontakt.html`; teprve ti se dopočítají na plnou kvalitu.

Co to dělá:
  1. pro každý terén a každou "rodinu" promptu a každý seed pošle jeden graf do
     ComfyUI (viz `gen_tiles_local.py`: stejný model, sampler i negativní prompt),
  2. uloží `<out>/<terén>/<rodina>-s<seed>.png`,
  3. zapíše `manifest.json` (co je co) — z něj pak `--report` udělá kontaktní list
     `_kontakt.html` s čísly (kontrast, plošnost, odchylka od palety).

Použití (ComfyUI musí běžet na http://127.0.0.1:8188):
    python scripts/gen_tile_pool.py --out assets/tiles_pool --steps 10
    python scripts/gen_tile_pool.py --report assets/tiles_pool
    python scripts/gen_tile_pool.py --out assets/tiles_pool --seed 5   # další sada seedů

Plná kvalita pro vybrané (ručně): přegenerovat jen ty a prohnat pipeline —
    scripts\\make_tile_set.cmd --name drawn --backend local --style plain \\
        --prompts scripts\\tile_prompts_drawn.txt --only hills --seed <seed>
"""
import argparse
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gen_tiles_local as gen  # noqa: E402  (Comfy klient + workflow + NEG)

# ---------------------------------------------------------------------------
# Terény: co je na povrchu, jak velkou plochu má rámeček zabírat a co tam nemá
# být. Měřítko v metrech je klíčové — "aerial view" samo model ignoroval.
# ---------------------------------------------------------------------------
TERRAINS = {
    'hills': dict(
        subject='gently undulating dry upland with broad fields of ochre earth and dry summer grass',
        scale='about one square kilometre', forbid='stones, cracks, dry mud, loose rocks',
        palette='warm ochre and tan tones #b78a4e'),
    'mountain': dict(
        subject='a bare mountain range with long ridge lines, grey rock, wide valleys and scree fields',
        scale='several square kilometres', forbid='cobblestones, pavement, individual rocks, cracks',
        palette='warm grey stone tones #8d8177'),
    'road': dict(
        subject='a pale sandy dirt track with long parallel wheel ruts running in one direction',
        scale='about two hundred metres', forbid='cracked mud, clay plates, stones, grass',
        palette='very pale bleached tan tones #deb693'),
    'dirt': dict(
        subject='uniform packed reddish brown earth with fine even grit',
        scale='about fifty metres', forbid='stones, cracked mud, clay plates, footprints',
        palette='reddish brown tones #9a5937'),
    'snow': dict(
        subject='unbroken level snow cover with faint wind drifts and soft pale blue shadows',
        scale='about one hundred metres', forbid='bare ground, brown soil, rocks, circles, patches',
        palette='off white and pale blue tones #f2efe6'),
    'water': dict(
        subject='calm deep water with very fine uniform ripples',
        scale='about one hundred metres', forbid='clay, mud, foam, waves, caustics, shore',
        palette='cold steel blue tones #465d88'),
}

# ---------------------------------------------------------------------------
# "Rodiny" promptu = různé cesty k témuž. Čím víc se liší, tím větší šance, že
# některá trefí měřítko krajiny. {subject}/{scale}/{forbid}/{palette} se doplní.
# ---------------------------------------------------------------------------
FAMILIES = {
    'mapa': ('hand drawn topographic map of {subject}, seen from directly above, {scale} across '
             'the frame, soft smooth shading, no {forbid}, orthographic, repeating seamlessly, '
             'flat even lighting, no horizon, no sky, no central object, no vignette, no border, '
             'uniform fine detail, {palette}, hand drawn ink linework with very light hatching, '
             'matte finish, game map tile'),
    'satelit': ('satellite photograph of {subject} seen from directly above, orthographic aerial '
                'imagery, {scale} across the frame, even overcast lighting, fine uniform detail, '
                '{palette}, no {forbid}, no horizon, no sky, no vignette, seamless game map texture'),
    'plocha': ('smooth painted game map ground texture of {subject}, flat even colour with very '
               'soft large tonal variation only, no objects at all, no {forbid}, {palette}, the '
               'frame covers {scale}, matte, no vignette, no border, seamless tileable game texture'),
    'pergamen': ('old hand drawn parchment map illustration of {subject}, ink outlines with light '
                 'hatching, cartography style, seen from above, {scale} across the frame, no '
                 '{forbid}, muted {palette}, no horizon, no sky, no vignette, seamless tileable '
                 'game map texture'),
    'akvarel': ('soft watercolour wash painting of {subject} seen from above, blended wet on wet, '
                'gentle tonal variation, no hard detail, no {forbid}, {palette}, the frame covers '
                '{scale}, no vignette, no border, seamless tileable texture'),
    'abstrakt': ('abstract seamless background texture inspired by {subject}, gentle large scale '
                 'colour variation, very soft grain, no recognisable objects, no {forbid}, '
                 '{palette}, flat even lighting, no vignette, no border, game map tile'),
}

NEGATIVE = ('cracks, cracked mud, dry clay, cobblestone, pavement, stone wall, pebbles, boulders, '
            'gravel, macro, close-up, extreme detail, mosaic, grid, vignette, horizon, sky, text, '
            'watermark, blurry, low quality, photographed wall, floor tiles')


def build_prompt(terrain, family):
    return FAMILIES[family].format(**TERRAINS[terrain])


def generate(out, terrains, families, seeds, seed_base, steps, cfg, width, height,
             negative, host, ckpt, timeout):
    gen.W, gen.H = width, height          # workflow() bere rozměry z modulu
    comfy = gen.Comfy(host)
    if not gen.check_server(comfy, ckpt):
        return 1
    comfy_output = comfy.output_dir() or gen.COMFY_OUTPUT
    prefix = 'pool_%d_%s' % (os.getpid(), time.strftime('%Y%m%d-%H%M%S'))

    jobs = [(t, f, seed_base + s * 7919 + i * 137)
            for i, t in enumerate(terrains)
            for f in families
            for s in range(seeds)]
    print('pool: %d dlazdic (%d terenu x %d rodin x %d seedu), %d px, %d kroku, cfg %.1f'
          % (len(jobs), len(terrains), len(families), seeds, width, steps, cfg), flush=True)
    print('  odhad casu: %d-%d min' % (len(jobs) * 20 // 60, len(jobs) * 45 // 60), flush=True)

    manifest_path = os.path.join(out, 'manifest.json')
    manifest = json.load(open(manifest_path, encoding='utf-8')) if os.path.exists(manifest_path) else []
    done = {(m['terrain'], m['family'], m['seed']) for m in manifest}

    ok, failed = 0, 0
    t0 = time.time()
    for n, (terrain, family, seed) in enumerate(jobs, 1):
        if (terrain, family, seed) in done:
            continue
        d = os.path.join(out, terrain)
        os.makedirs(d, exist_ok=True)
        name = '%s-s%d' % (family, seed)
        dst = os.path.join(d, name + '.png')
        prompt = build_prompt(terrain, family)
        if os.path.exists(dst):
            ok += 1
            continue
        good = gen.generate_one(comfy, ckpt, name, prompt, 0, seed, d, comfy_output,
                                prefix, steps, cfg, timeout, negative)
        if good:
            # generate_one ukládá <name>-0.png (varianta 0) -> prejmenuj na <name>.png
            src = os.path.join(d, name + '-0.png')
            if os.path.exists(src):
                os.replace(src, dst)
            ok += 1
            manifest.append(dict(terrain=terrain, family=family, seed=seed,
                                 file=os.path.relpath(dst, out).replace('\\', '/'),
                                 prompt=prompt, steps=steps, cfg=cfg,
                                 size=[width, height], negative=negative))
            with open(manifest_path, 'w', encoding='utf-8') as fh:
                json.dump(manifest, fh, ensure_ascii=False, indent=1)
        else:
            failed += 1
        if n % 10 == 0:
            el = time.time() - t0
            print('  %d/%d hotovo (%d ok, %d chyb), %.1f min, zbyva ~%.1f min'
                  % (n, len(jobs), ok, failed, el / 60, (len(jobs) - n) * el / max(n, 1) / 60),
                  flush=True)

    print('\nhotovo: %d ok, %d chyb -> %s' % (ok, failed, out), flush=True)
    print('kontaktni list:  python scripts/gen_tile_pool.py --report %s' % out, flush=True)
    return 0 if ok else 1


def report(out):
    """Kontaktní list `_kontakt.html` + čísla (bez vision)."""
    man = json.load(open(os.path.join(out, 'manifest.json'), encoding='utf-8'))
    sys.path.insert(0, HERE)
    from tile_palette import TARGET
    import numpy as np
    from PIL import Image, ImageFilter

    def nums(path):
        g = Image.open(path).convert('L').resize((256, 256), Image.LANCZOS)
        b = np.asarray(g.filter(ImageFilter.GaussianBlur(8.0))).astype(np.float32) / 255.0
        macro = float(b.std())
        q = b.shape[0] // 4
        horizon = abs(float(b[:q].mean()) - float(b[-q:].mean()))
        small = np.asarray(Image.open(path).convert('L').resize((46, 46), Image.LANCZOS)).astype(np.float32)
        rgb = np.asarray(Image.open(path).convert('RGB')).astype(np.float32).reshape(-1, 3).mean(axis=0)
        return macro, horizon, float(small.std()), rgb

    rows = []
    for m in man:
        p = os.path.join(out, m['file'])
        if not os.path.exists(p):
            continue
        macro, horizon, kontrast, rgb = nums(p)
        tgt = np.array(TARGET[m['terrain']], np.float32)
        rows.append(dict(m, macro=round(macro, 3), horizon=round(horizon, 3),
                         kontrast=round(kontrast, 1), paleta=round(float(np.abs(rgb - tgt).max()), 1)))

    by_terrain = {}
    for r in rows:
        by_terrain.setdefault(r['terrain'], []).append(r)

    html = ['<!doctype html><html lang="cs"><meta charset="utf-8">',
            '<title>Pool dlaždic — kontaktní list</title>',
            '<style>body{background:#1b1b1b;color:#ddd;font:13px system-ui;margin:16px}',
            'h2{margin:26px 0 8px;border-bottom:1px solid #444}',
            '.g{display:flex;flex-wrap:wrap;gap:10px}',
            '.c{background:#262626;border:1px solid #3a3a3a;border-radius:6px;padding:6px;width:212px}',
            '.c img{width:200px;height:200px;image-rendering:auto;display:block;border-radius:4px}',
            '.m{color:#9c9;font-size:11px;margin-top:4px;line-height:1.35}',
            '.k{color:#bbb}.bad{color:#e77}a{color:#8cf}',
            'table{border-collapse:collapse;font-size:12px;margin:8px 0 18px}',
            'th,td{border:1px solid #3a3a3a;padding:3px 7px;text-align:right}',
            'th{background:#2c2c2c;text-align:center}td.l,th.l{text-align:left}',
            '.tip{background:#232d23;border:1px solid #3c5c3c;border-radius:6px;padding:6px 9px;'
            'margin:6px 0 12px;font-size:12px}</style>',
            '<h1>Pool dlaždic — kontaktní list</h1>',
            '<p>Každá dlaždice je <b>768 px</b> a je to surový výstup generátoru (bez srovnání '
            'barvy a zacelení švu). <b>Klikni na obrázek pro plnou velikost</b> — náhled lže. '
            'Čísla: <span class="k">kontrast</span> (limit ≥ 5 = má na 46 px detail), '
            '<span class="k">horizont</span> (≤ 0,045 = není to scéna), '
            '<span class="k">paleta</span> (odchylka od barvy terénu; srovná se později, '
            'takže vyšší číslo není vada).</p>',
            '<div class="tip"><b>Na co se dívat při výběru (v tomhle pořadí):</b>'
            '<ol style="margin:6px 0 0 18px;padding:0">'
            '<li><b>Je to POVRCH, nebo obrázek krajiny?</b> Horizont, obloha nebo jeden velký '
            'motiv uprostřed = vyřadit (číslo <span class="k">horizont</span> to pozná).</li>'
            '<li><b>Jak velký detail?</b> Dlaždice se kreslí na <b>46 px</b> a opakuje se přes '
            'celou mapu. Co je hezké na 768 px (kamínky, květiny, kapradí, vlny) se na 46 px '
            'slije do šumu a při opakování udělá mřížku. Hledej <b>masu</b> — koruny stromů, '
            'skalní masiv, plochu s odstíny.</li>'
            '<li><b>Nesahej na okraj žádný velký předmět.</b> Dlaždice musí být <b>torus</b>: '
            'levý sloupec = pravý a horní řádek = spodní (obrazec, který se dá zabalit do '
            'prstence bez švu — jen tak na sebe dlaždice navazují). Surová dlaždice torus '
            'NIKDY není, došívá ji <code>seamless_tiles.py</code> — ale když přes okraj leze '
            'strom nebo kámen, došití ho rozmázne. Preferuj dlaždice bez předmětů na okraji '
            'a bez jednostranného světla/gradientu.</li>'
            '<li><b>Barva</b> se srovná (<code>grade_tiles.py</code>), takže mírně vedle není '
            'vada — ale špatný ODSTÍN ne (zelený „sníh“ se nespraví).</li>'
            '<li><b>Kontrast</b> musí zůstat ≥ 5, jinak dlaždice ve hře zmizí.</li>'
            '</ol></div>']

    # --- souhrn po rodinách: která cesta k měřítku krajiny funguje ------------
    agg = {}
    for r in rows:
        a = agg.setdefault((r['terrain'], r['family']), dict(n=0, scen=0, k=0.0, p=0.0))
        a['n'] += 1
        a['scen'] += 1 if r['horizon'] > 0.045 else 0
        a['k'] += r['kontrast']
        a['p'] += r['paleta']
    html.append('<h2>Souhrn po rodinách promptu</h2>')
    html.append('<p><b>scéna</b> = kolik z variant vypadá jako obrázek krajiny místo ploché '
                'textury (to je hlavní past). <b>Tip</b> = 3 dlaždice, které prošly plošností '
                'a mají nejvyšší kontrast.</p>')
    html.append('<table><tr><th class="l">terén</th><th class="l">rodina</th><th>variant</th>'
                '<th>scéna</th><th>kontrast</th><th>paleta</th></tr>')
    for (terrain, family), a in sorted(agg.items()):
        html.append('<tr><td class="l">%s</td><td class="l">%s</td><td>%d</td>'
                    '<td%s>%d</td><td>%.1f</td><td>%.0f</td></tr>'
                    % (terrain, family, a['n'], ' class="bad"' if a['scen'] else '', a['scen'],
                       a['k'] / a['n'], a['p'] / a['n']))
    html.append('</table>')

    for terrain, items in sorted(by_terrain.items()):
        items.sort(key=lambda r: (r['family'], r['seed']))
        good = [r for r in items if r['horizon'] <= 0.045 and r['kontrast'] >= 5]
        good.sort(key=lambda r: (r['horizon'], -r['kontrast']))
        tips = ' &nbsp; '.join('<a href="%s" target="_blank">%s (s%d, kontrast %.1f)</a>'
                               % (r['file'], r['family'], r['seed'], r['kontrast'])
                               for r in good[:3]) or 'žádná neprošla plošností'
        html.append('<h2>%s <span class="k">(%d variant)</span></h2>'
                    '<div class="tip"><b>Tip:</b> %s</div><div class="g">'
                    % (terrain, len(items), tips))
        for r in items:
            bad = ' bad' if r['horizon'] > 0.045 else ''
            html.append(
                '<div class="c"><a href="%s" target="_blank"><img src="%s" loading="lazy"></a>'
                '<div class="m"><b>%s</b> seed %d<br>'
                '<span class="k">kontrast</span> %s &nbsp; <span class="k%s">horizont</span> %s<br>'
                '<span class="k">paleta</span> %s</div></div>'
                % (r['file'], r['file'], r['family'], r['seed'], r['kontrast'], bad,
                   r['horizon'], r['paleta']))
        html.append('</div>')

    path = os.path.join(out, '_kontakt.html')
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(html))
    print('kontaktni list: %s  (%d dlazdic)' % (path, len(rows)))
    return 0


def main():
    ap = argparse.ArgumentParser(description='Velky pool kandidatu na dlazdice.')
    ap.add_argument('--out', default='assets/tiles_pool')
    ap.add_argument('--report', default=None, help='jen vyrobit kontaktni list z manifest.json')
    ap.add_argument('--terrain', default='', help='jen tyto tereny (carkou); vychozi vsechny z matice')
    ap.add_argument('--family', default='', help='jen tyto rodiny promptu (carkou)')
    ap.add_argument('--seeds', type=int, default=3, help='clenu matice na dvojici teren x rodina')
    ap.add_argument('--seed', type=int, default=1000, help='zaklad seedu (1000 = prvni sada)')
    ap.add_argument('--steps', type=int, default=10, help='kroky (10 = draft, 20-28 = final)')
    ap.add_argument('--cfg', type=float, default=6.0)
    ap.add_argument('--size', type=int, default=768, help='strana ctverce v px')
    ap.add_argument('--negative', default=NEGATIVE)
    ap.add_argument('--host', default=gen.HOST)
    ap.add_argument('--ckpt', default=gen.CKPT)
    ap.add_argument('--timeout', type=int, default=600)
    args = ap.parse_args()

    if args.report:
        return report(args.report)
    want_t = [t for t in args.terrain.split(',') if t.strip()] or list(TERRAINS)
    want_f = [f for f in args.family.split(',') if f.strip()] or list(FAMILIES)
    bad = [t for t in want_t if t not in TERRAINS] + [f for f in want_f if f not in FAMILIES]
    if bad:
        print('neznamy teren/rodina: %s' % ', '.join(bad))
        print('tereny: %s' % ', '.join(TERRAINS))
        print('rodiny: %s' % ', '.join(FAMILIES))
        return 1
    os.makedirs(args.out, exist_ok=True)
    return generate(args.out, want_t, want_f, args.seeds, args.seed, args.steps, args.cfg,
                    args.size, args.size, args.negative, args.host, args.ckpt, args.timeout)


if __name__ == '__main__':
    sys.exit(main())
