#!/usr/bin/env python
"""Vygeneruje postavy (sprity) lokálně — ComfyUI + SDXL, jednotný styl s dlaždicemi.

Postava stojí na světlém krémovém pozadí (#f0e8d8), které se pak odstraní
(`scripts/process_units.py` → průhledné PNG). Pozadí se odstraňuje prahováním
jasu (tmavá postava vs. světlé pozadí), ne klíčováním barvy.

Výstup: assets/units_gen/<id>.png  (768x768, plné pozadí)
"""
import json, os, shutil, sys, time, urllib.request, urllib.error

HOST = 'http://127.0.0.1:8188'
CKPT = 'Juggernaut-XL_v9.safetensors'
OUT_DIR = 'assets/units_gen'
W, H, STEPS, CFG, SEED = 768, 768, 24, 6.0, 20260916

STYLE = ("grim medieval low-fantasy, desaturated earthy palette of browns, olive, dull steel "
         "and bone, strong dark ink outlines, one warm dirty light source, painterly texture "
         "with grime and scratches, muted heraldry accents, no bright saturation, no anime, "
         "no modern objects")

UNITS = {
    'mercenary':  'a hooded medieval mercenary with a short sword',
    'villager':   'a simple medieval villager with a sack over the shoulder',
    'blacksmith': 'a stocky medieval blacksmith with a hammer and leather apron',
    'hunter':     'a medieval hunter with a bow and a quiver',
    'scout':      'a slim medieval scout in a hooded cloak with a wooden staff',
    'merchant':   'a medieval merchant with a coin purse and a pack',
}

NEG = 'text, watermark, signature, blurry, low quality, photo, 3d render, extra people, landscape, horizon, sky, frame, border'


def prompt_for(desc):
    return (f"Exactly ONE small medieval character, full body, front view, centered, "
            f"{desc}, a dark character silhouetted against a plain light cream paper background "
            f"(solid pale #f0e8d8), flat even lighting, no shadow, no vignette, no gradient, "
            f"nothing else in the frame, strong readable silhouette, clear colour blocking, "
            f"readable when shrunk to 40 pixels tall. {STYLE}")


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
        '9': {'class_type': 'SaveImage', 'inputs': {'filename_prefix': 'unitgen', 'images': ['8', 0]}},
    }


def generate_one(uid, desc, seed):
    t0 = time.time()
    pid = api('/prompt', {'prompt': workflow(prompt_for(desc), seed)}).get('prompt_id')
    while True:
        hist = api('/history/' + pid)
        if pid in hist:
            entry = hist[pid]
            st = entry.get('status', {})
            if st.get('status_str') == 'error':
                print(f'  {uid}: CHYBA', file=sys.stderr)
                for m in st.get('messages', []):
                    print('   ', m, file=sys.stderr)
                return False
            for _n, outp in entry.get('outputs', {}).items():
                for img in outp.get('images', []):
                    src = os.path.join('D:/ComfyUI/ComfyUI/output', img['subfolder'], img['filename'])
                    dst = os.path.join(OUT_DIR, f'{uid}.png')
                    os.makedirs(OUT_DIR, exist_ok=True)
                    if not os.path.exists(src):
                        print(f'  {uid}: chybi zdroj ({img["filename"]})', file=sys.stderr)
                        return False
                    shutil.move(src, dst)
                    print(f'  {uid}: OK ({time.time() - t0:.0f}s)')
                    return True
        if time.time() - t0 > 900:
            print(f'  {uid}: TIMEOUT', file=sys.stderr)
            return False
        time.sleep(3)


def main():
    try:
        api('/system_stats')
    except Exception as e:
        print('ComfyUI nebezi:', e)
        sys.exit(1)
    jobs = [(uid, UNITS[uid], SEED + i * 137) for i, uid in enumerate(UNITS)]
    print(f'generuji {len(jobs)} postav lokalne...')
    ok = 0
    for i, (uid, desc, seed) in enumerate(jobs, 1):
        print(f'[{i}/{len(jobs)}] {uid}')
        if generate_one(uid, desc, seed):
            ok += 1
    print(f'HOTOVO: {ok}/{len(jobs)} postav v {OUT_DIR}')


if __name__ == '__main__':
    main()
