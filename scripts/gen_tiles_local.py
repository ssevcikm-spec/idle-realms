#!/usr/bin/env python
"""Vygeneruje dlaždice mapy LOKÁLNĚ — ComfyUI + SDXL (Juggernaut XL) na RX 6600.

Protějšek `gen_tiles.py` (Pollinations). Oba skládají prompt ze **stejných**
dílů (`tile_styles.py`: předměty terénů, styly, vlastní prompty), takže sady
z obou cest se dají srovnávat; liší se jen základem věty, protože SDXL unese
delší prompt než Pollinations.

Rozdíly proti online cestě, se kterými se počítá:

- **ComfyUI musí běžet** (`http://127.0.0.1:8188`). Skript to zkontroluje a
  rovnou i to, že je v ComfyUI nahraný model z `--ckpt`; když ne, vypíše, co
  ComfyUI nabízí.
- **~60–150 s na dlaždici** (768×768, 20 kroků, RX 6600) místo jednotek sekund.
  Celá sada 10 terénů × 2 textury je proto spíš 30–50 minut.
- **Limit délky promptu není** — varování na ~350 znaků je vlastnost Pollinations.

**Obrázek se stahuje přes HTTP `/view`, ne ze disku.** Kam ComfyUI píše výstupy,
závisí na tom, jak bylo spuštěné (`--output-directory`); v praxi to bývá jinde,
než člověk čeká, a cesta se nedá spolehlivě uhodnout. `/view` je oficiální
endpoint serveru a vrátí tentýž soubor. Soubory v ComfyUI se **nemažou** —
skript si je jen zkopíruje do `<out>/`.

Výstup: `<out>/<teren>-<n>.png` (výchozí `assets/tiles_local`), 768×768, PNG.
PNG je záměr: je to nezacelený meziprodukt (`raw/`), ze kterého se pak měří
obsahová ostrost (past 30/31 v `docs/HANDOFF.md`).

Příklady:
    # celá sada tak, jak vznikla nasazená sada (stejné seedy i prompt bez stylu)
    python scripts/gen_tiles_local.py --style plain

    # ekvivalent k online variantě, včetně vlastních promptů a stylu
    python scripts/gen_tiles_local.py --out assets/tiles_kronika/raw \\
        --style kronika-tex --prompts scripts/tile_prompts.txt

    # jiný model / kroky / server
    python scripts/gen_tiles_local.py --ckpt jiny.safetensors --steps 28

Spouštět z `C:\\idle-realm`; obvykle to za tebe udělá
`scripts\\make_tile_set.cmd --backend local`.
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from tile_styles import (TERRAINS, STYLES, BASE_LOCAL,   # noqa: F401 (re-export)
                         build_prompt, load_prompts)

HOST = 'http://127.0.0.1:8188'
CKPT = 'Juggernaut-XL_v9.safetensors'
OUT_DIR = 'assets/tiles_local'
# Jen zaloha, kdyby /view selhalo: kam ComfyUI pise pri vychozim spusteni.
COMFY_OUTPUT = 'D:/ComfyUI/ComfyUI/output'
W, H, STEPS, CFG = 768, 768, 20, 6.0
TIMEOUT = 900

# Seedy nasazené sady (`assets/tiles/`): 13242 + i*137 + 1000 (v1) / +2000 (v2),
# kde i je pořadí terénu v TERRAINS. S tímhle výchozím seederem tedy běh bez
# argumentů vyrobí tytéž obrázky, ze kterých je nasazená sada.
SEED = 13242

NEG = ('text, watermark, signature, blurry, low quality, photo, 3d render, people, '
       'characters, horizon, sky')


class Comfy:
    """Minimalni HTTP klient ComfyUI API (bez zavislosti navic)."""

    def __init__(self, host=HOST):
        self.host = host.rstrip('/')

    def api(self, path, obj=None, timeout=60):
        url = self.host + path
        if obj is None:
            with urllib.request.urlopen(url, timeout=timeout) as r:
                return json.loads(r.read())
        data = json.dumps(obj).encode()
        req = urllib.request.Request(url, data=data,
                                     headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())

    def raw(self, path, timeout=120):
        """Vrati telo odpovedi jako bytes (pro /view)."""
        with urllib.request.urlopen(self.host + path, timeout=timeout) as r:
            return r.read()

    def output_dir(self):
        """Kam ComfyUI pise vystupy — z jeho vlastniho argv, kdyz to jde.

        Server muze byt spusteny s `--output-directory` (a v tomhle prostredi
        opravdu je), takze vychozi `D:/ComfyUI/ComfyUI/output` neplati vzdy.
        Pouziva se jen jako zaloha, kdyby nestacilo /view.
        """
        try:
            argv = self.api('/system_stats', timeout=10).get('system', {}).get('argv', [])
        except Exception:
            return None
        for i, a in enumerate(argv):
            if a == '--output-directory' and i + 1 < len(argv):
                return argv[i + 1].replace('\\', '/')
        return None


def workflow(pos, seed, ckpt=CKPT, prefix='tilegen', steps=STEPS, cfg=CFG):
    """Graf pro ComfyUI: checkpoint → dva CLIPTextEncode → KSampler → VAEDecode → SaveImage.

    `prefix` je unikátní na běh: ComfyUI cachuje hotové grafy, takže se stejným
    prefixem by druhý běh **negeneroval** a vrátil by starý výsledek.
    """
    return {
        '4': {'class_type': 'CheckpointLoaderSimple', 'inputs': {'ckpt_name': ckpt}},
        '5': {'class_type': 'EmptyLatentImage', 'inputs': {'width': W, 'height': H, 'batch_size': 1}},
        '6': {'class_type': 'CLIPTextEncode', 'inputs': {'text': pos, 'clip': ['4', 1]}},
        '7': {'class_type': 'CLIPTextEncode', 'inputs': {'text': NEG, 'clip': ['4', 1]}},
        '3': {'class_type': 'KSampler', 'inputs': {'seed': seed, 'steps': steps, 'cfg': cfg,
            'sampler_name': 'euler', 'scheduler': 'normal', 'denoise': 1.0,
            'model': ['4', 0], 'positive': ['6', 0], 'negative': ['7', 0], 'latent_image': ['5', 0]}},
        '8': {'class_type': 'VAEDecode', 'inputs': {'samples': ['3', 0], 'vae': ['4', 2]}},
        '9': {'class_type': 'SaveImage', 'inputs': {'filename_prefix': prefix, 'images': ['8', 0]}},
    }


def check_server(comfy, ckpt):
    """Overi, ze ComfyUI bezi a ma model z `--ckpt`. Vypise, co je potreba."""
    try:
        stats = comfy.api('/system_stats', timeout=10)
    except Exception as e:
        print('CHYBA: ComfyUI nebezi na %s (%s)' % (comfy.host, e))
        print('  spust ho takhle (z PowerShellu):')
        print("    Start-Process 'D:\\ComfyUI\\venv-comfy\\Scripts\\python.exe' `")
        print("      -ArgumentList 'main.py','--port','8188' "
              "-WorkingDirectory 'D:\\ComfyUI\\ComfyUI' -WindowStyle Hidden")
        print('  nebo klikat v prohlizeci na %s' % comfy.host)
        return False

    dev = '?'
    vram = 0.0
    if stats.get('devices'):
        d = stats['devices'][0]
        dev = '%s : %s' % (d.get('name', '?'), d.get('type', '?'))
        vram = d.get('vram_total', 0) / 1024 ** 3
    print('ComfyUI bezi: %s   verze %s' % (comfy.host,
                                           stats.get('system', {}).get('comfyui_version', '?')),
          flush=True)
    print('  zarizeni: %s   VRAM %.1f GB' % (dev, vram), flush=True)

    try:
        info = comfy.api('/object_info/CheckpointLoaderSimple', timeout=30)
        names = info['CheckpointLoaderSimple']['input']['required']['ckpt_name'][0]
    except Exception as e:
        print('  (seznam modelu se nepodarilo precist: %s - pokracuji)' % e, flush=True)
        return True
    if ckpt not in names:
        print('CHYBA: model "%s" v ComfyUI neni.' % ckpt)
        print('  k dispozici: %s' % (', '.join(names) or '(zadny)'))
        print('  model patri do D:\\ComfyUI\\ComfyUI\\models\\checkpoints')
        print('  (nebo spust s --ckpt <nazev> vys)')
        return False
    return True


def fetch_image(comfy, img, dst, comfy_output):
    """Ulozi vygenerovany obrazek do `dst` (pres /view, se zalohou na disku)."""
    query = urllib.parse.urlencode({'filename': img['filename'],
                                    'subfolder': img.get('subfolder', ''),
                                    'type': img.get('type', 'output')})
    try:
        data = comfy.raw('/view?' + query)
    except Exception as e:
        path = os.path.join(comfy_output or COMFY_OUTPUT, img.get('subfolder', ''),
                            img['filename'])
        if not os.path.exists(path):
            print('    CHYBA: /view selhalo (%s) a soubor neni ani na disku (%s)'
                  % (e, path), file=sys.stderr)
            return False
        with open(path, 'rb') as fh:
            data = fh.read()
    os.makedirs(os.path.dirname(dst) or '.', exist_ok=True)
    with open(dst, 'wb') as fh:
        fh.write(data)
    return True


def generate_one(comfy, ckpt, name, prompt, variant, seed, out_dir, comfy_output,
                 prefix, steps, cfg, timeout):
    """Posli jeden graf do ComfyUI, pockej na vysledek, uloz ho do out_dir."""
    t0 = time.time()
    try:
        pid = comfy.api('/prompt', {'prompt': workflow(prompt, seed, ckpt, prefix, steps, cfg)}
                        ).get('prompt_id')
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', 'replace')
        print('  %-12s -%d  CHYBA: ComfyUI odmitlo workflow (%d)' % (name, variant, e.code),
              file=sys.stderr)
        print('    %s' % body[:600], file=sys.stderr)
        return False
    except Exception as e:
        print('  %-12s -%d  CHYBA: %s' % (name, variant, e), file=sys.stderr)
        return False

    while True:
        try:
            hist = comfy.api('/history/' + pid)
        except Exception as e:
            print('  %-12s -%d  CHYBA pri cteni historie: %s' % (name, variant, e),
                  file=sys.stderr)
            return False
        if pid in hist:
            entry = hist[pid]
            st = entry.get('status', {})
            if st.get('status_str') == 'error':
                print('  %-12s -%d  CHYBA v ComfyUI' % (name, variant), file=sys.stderr)
                for m in st.get('messages', []):
                    print('    ', m, file=sys.stderr)
                return False
            imgs = [img for outp in entry.get('outputs', {}).values()
                    for img in outp.get('images', [])]
            if not imgs:
                print('  %-12s -%d  CHYBA: workflow nevratil obrazek' % (name, variant),
                      file=sys.stderr)
                return False
            dst = os.path.join(out_dir, '%s-%d.png' % (name, variant))
            if not fetch_image(comfy, imgs[0], dst, comfy_output):
                print('  %-12s -%d  CHYBA: obrazek se nepodarilo ulozit' % (name, variant),
                      file=sys.stderr)
                return False
            print('  %-12s -%d  OK  seed %d  (%.0fs, %d kB)'
                  % (name, variant, seed, time.time() - t0, os.path.getsize(dst) // 1024),
                  flush=True)
            return True
        if time.time() - t0 > timeout:
            print('  %-12s -%d  TIMEOUT po %ds' % (name, variant, timeout), file=sys.stderr)
            return False
        time.sleep(2)


def main():
    ap = argparse.ArgumentParser(description='Dlazdice lokalne pres ComfyUI (SDXL).')
    ap.add_argument('--out', default=OUT_DIR, help='kam ukladat (vychozi %s)' % OUT_DIR)
    ap.add_argument('--variants', type=int, default=2, help='textur na teren (hra ceka 1 a 2)')
    ap.add_argument('--style', default='plain', choices=list(STYLES),
                    help='kronika-tex = motiv kroniky popsany jako textura')
    ap.add_argument('--only', default='', help='jen tyto tereny (carkou) - na rychly test')
    ap.add_argument('--prompts', default=None,
                    help='soubor s vlastnimi prompty (viz scripts/tile_prompts.txt)')
    ap.add_argument('--seed', type=int, default=SEED,
                    help='zaklad seedu (vychozi %d reprodukuje nasazenou sadu)' % SEED)
    ap.add_argument('--host', default=HOST, help='adresa ComfyUI (vychozi %s)' % HOST)
    ap.add_argument('--ckpt', default=CKPT, help='model v ComfyUI (vychozi %s)' % CKPT)
    ap.add_argument('--comfy-output', default=None,
                    help='kde hledat soubor, kdyby selhalo /view (vychozi: z argv ComfyUI, '
                         'pak %s)' % COMFY_OUTPUT)
    ap.add_argument('--steps', type=int, default=STEPS)
    ap.add_argument('--cfg', type=float, default=CFG)
    ap.add_argument('--timeout', type=int, default=TIMEOUT, help='limit na jeden obrazek (s)')
    ap.add_argument('--prefix', default=None,
                    help='predpona souboru v ComfyUI (vychozi unikatni na beh)')
    args = ap.parse_args()

    want = [s.strip() for s in args.only.split(',') if s.strip()]
    terrains = [t for t in TERRAINS if not want or t in want]
    if not terrains:
        print('neznamy teren; zname: ' + ', '.join(TERRAINS))
        return 1

    tpl, per = (None, {})
    if args.prompts:
        if not os.path.exists(args.prompts):
            print('soubor s prompty neexistuje: %s' % args.prompts)
            return 1
        tpl, per = load_prompts(args.prompts)
        print('vlastni prompty: %s (%d pro konkretni teren, sablona: %s)'
              % (args.prompts, len(per), 'ano' if tpl else 'ne'), flush=True)

    comfy = Comfy(args.host)
    if not check_server(comfy, args.ckpt):
        return 1
    comfy_output = args.comfy_output or comfy.output_dir() or COMFY_OUTPUT

    prefix = args.prefix or ('tilegen_%d_%s' % (os.getpid(), time.strftime('%Y%m%d-%H%M%S')))
    os.makedirs(args.out, exist_ok=True)
    style = STYLES[args.style]
    jobs = len(terrains) * args.variants
    print('generuji %d terenu x %d textur (styl %s, %d kroku, model %s) -> %s'
          % (len(terrains), args.variants, args.style, args.steps, args.ckpt, args.out),
          flush=True)
    print('  pozor: lokalne ~1-2 min na obrazek, tedy cca %d-%d min celkem'
          % (jobs, jobs * 2), flush=True)

    ok, failed = 0, []
    for i, terrain in enumerate(terrains):
        prompt, src = build_prompt(terrain, style, tpl, per, BASE_LOCAL)
        print('  [%s] prompt %d znaku (%s)' % (terrain, len(prompt), src), flush=True)
        for v in range(1, args.variants + 1):
            seed = args.seed + i * 137 + v * 1000
            if generate_one(comfy, args.ckpt, terrain, prompt, v, seed, args.out,
                            comfy_output, prefix, args.steps, args.cfg, args.timeout):
                ok += 1
            else:
                failed.append('%s-%d' % (terrain, v))

    print('\nhotovo: %d textur' % ok, flush=True)
    if failed:
        print('selhalo: ' + ', '.join(failed), flush=True)
    if ok:
        print('další kroky:', flush=True)
        print('  python scripts/grade_tiles.py %s %s' % (args.out, args.out), flush=True)
        print('  python scripts/seamless_tiles.py --dir %s' % args.out, flush=True)
        print('  python scripts/tile_flatness.py %s' % args.out, flush=True)
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
