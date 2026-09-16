#!/usr/bin/env python
"""Vygeneruje sadu AI dlaždic terénu lokálně (ComfyUI + SDXL na RX 6600).

Každý terén × 2 seedy = 20 obrázků, ukládá se do `assets/tiles_local/<teren>-<n>.png`.
Pak se srovnají barvy (`scripts/grade_tiles.py`) a nasadí do `assets/tiles/`.

Spustit, když běží ComfyUI na http://127.0.0.1:8188.
"""
import json, os, shutil, sys, time, urllib.request, urllib.error

HOST = 'http://127.0.0.1:8188'
CKPT = 'Juggernaut-XL_v9.safetensors'
OUT_DIR = 'assets/tiles_local'
W, H, STEPS, CFG, SEED = 768, 768, 20, 6.0, 4242

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
NEG = 'text, watermark, signature, blurry, low quality, photo, 3d render, people, characters, horizon, sky'

def prompt_for(subject):
    return (f"Seamless tileable texture of {subject}, top-down orthographic ground texture "
            f"for a 2D game map, even flat lighting, no central object, no vignette, no border, "
            f"edges must match when the tile is repeated. Grim medieval game art, desaturated "
            f"earthy tones, crisp detail readable at 46x46 px.")


def api(path, obj=None):
    if obj is None:
        with urllib.request.urlopen(HOST + path, timeout=60) as r:
            return json.loads(r.read())
    data = json.dumps(obj).encode()
    req = urllib.request.Request(HOST + path, data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def workflow(pos, seed):
    return {
        '4': {'class_type': 'CheckpointLoaderSimple', 'inputs': {'ckpt_name': CKPT}},
        '5': {'class_type': 'EmptyLatentImage', 'inputs': {'width': W, 'height': H, 'batch_size': 1}},
        '6': {'class_type': 'CLIPTextEncode', 'inputs': {'text': pos, 'clip': ['4', 1]}},
        '7': {'class_type': 'CLIPTextEncode', 'inputs': {'text': NEG, 'clip': ['4', 1]}},
        '3': {'class_type': 'KSampler', 'inputs': {'seed': seed, 'steps': STEPS, 'cfg': CFG,
            'sampler_name': 'euler', 'scheduler': 'normal', 'denoise': 1.0,
            'model': ['4', 0], 'positive': ['6', 0], 'negative': ['7', 0], 'latent_image': ['5', 0]}},
        '8': {'class_type': 'VAEDecode', 'inputs': {'samples': ['3', 0], 'vae': ['4', 2]}},
        '9': {'class_type': 'SaveImage', 'inputs': {'filename_prefix': 'tilegen', 'images': ['8', 0]}},
    }


def generate_one(name, subject, variant, seed):
    t0 = time.time()
    pid = api('/prompt', {'prompt': workflow(prompt_for(subject), seed)}).get('prompt_id')
    while True:
        hist = api('/history/' + pid)
        if pid in hist:
            entry = hist[pid]
            st = entry.get('status', {})
            if st.get('status_str') == 'error':
                print(f'  {name}-{variant}: CHYBA', file=sys.stderr)
                for m in st.get('messages', []):
                    print('   ', m, file=sys.stderr)
                return False
            for _node, outp in entry.get('outputs', {}).items():
                for img in outp.get('images', []):
                    src = os.path.join('D:/ComfyUI/ComfyUI/output', img['subfolder'], img['filename'])
                    dst = os.path.join(OUT_DIR, f'{name}-{variant}.png')
                    os.makedirs(OUT_DIR, exist_ok=True)
                    if not os.path.exists(src):
                        # cachovany vysledek ukazuje na uz smazany soubor -> povazuj za nezdar
                        print(f'  {name}-{variant}: chybi zdrojovy soubor ({img["filename"]})', file=sys.stderr)
                        return False
                    shutil.move(src, dst)
                    print(f'  {name}-{variant}: OK  ({time.time() - t0:.0f}s)')
                    return True
        if time.time() - t0 > 900:
            print(f'  {name}-{variant}: TIMEOUT', file=sys.stderr)
            return False
        time.sleep(3)


def main():
    # sanity: server bezi?
    try:
        api('/system_stats')
    except Exception as e:
        print('ComfyUI nebezi na', HOST, ':', e)
        sys.exit(1)

    jobs = [(t, TERRAINS[t], 1, SEED + 10000 + i * 137) for i, t in enumerate(TERRAINS)] + \
           [(t, TERRAINS[t], 2, SEED + 11000 + i * 137) for i, t in enumerate(TERRAINS)]
    print(f'generuji {len(jobs)} dlazdic lokalne (SDXL, {W}x{W}, {STEPS} kroku)...')
    ok = 0
    for i, (t, subj, v, seed) in enumerate(jobs, 1):
        print(f'[{i}/{len(jobs)}] {t}-{v}')
        if generate_one(t, subj, v, seed):
            ok += 1
    print(f'HOTOVO: {ok}/{len(jobs)} dlazdic v {OUT_DIR}')


if __name__ == '__main__':
    main()
