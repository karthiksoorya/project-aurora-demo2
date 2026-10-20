"""Side-by-side review sheets: reference screenshot (left) vs running implementation (right).
Usage: python tools/make_compare_sheets.py <reference-screens-dir> <impl-screenshots-dir> <out-dir>"""
import json, os, sys
from PIL import Image, ImageDraw

ref_dir, impl_dir, out_dir = sys.argv[1:4]
os.makedirs(out_dir, exist_ok=True)
manifest = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'docs', 'handoff', 'ASSET_MANIFEST.json')))
made = []
for a in manifest:
    impl = os.path.join(impl_dir, f"{a['id']}.png")
    ref = os.path.join(ref_dir, a['filename'])
    if not (os.path.exists(impl) and os.path.exists(ref)):
        continue
    L = Image.open(ref).convert('RGB').resize((836, 470))
    R = Image.open(impl).convert('RGB').resize((836, 470))
    s = Image.new('RGB', (1672, 500), 'white')
    s.paste(L, (0, 30)); s.paste(R, (836, 30))
    d = ImageDraw.Draw(s)
    d.text((8, 8), f"{a['id']} reference: {a['filename']}", fill=(60, 60, 90))
    d.text((844, 8), f"{a['id']} implementation (Playwright, 1672x941)", fill=(30, 90, 200))
    p = os.path.join(out_dir, f"{a['id']}-compare.png"); s.save(p); made.append(p)
print(len(made), 'sheets')
