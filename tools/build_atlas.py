#!/usr/bin/env python3
"""Builds dist/atlas.html: the interactive Atlas of Valendria (roads, sea lanes, zones, bosses, quests).
Exports live game data with tools/export_atlas.cjs, embeds src_sheet/world_map.png as JPEG and the painted
maps of the expansion worlds (gm_x6..gm_x13) for the world switcher."""
import base64, io, json, os, re, subprocess, tempfile
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
tmp = os.path.join(tempfile.gettempdir(), 'gbq_atlas.json')
subprocess.run(['node', 'tools/export_atlas.cjs', tmp], check=True)
data = json.load(open(tmp))
buf = io.BytesIO(); Image.open('src_sheet/world_map.png').convert('RGB').save(buf, 'JPEG', quality=82, optimize=True)
uri = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
# expansion worlds with their own painted maps (gm_x6..gm_x13): assets/<name>.png, else the image embedded in the
# last game build (dist/gbquest.html keeps every sprite as a data URI)
def world_maps():
    names = {w['n']: f"gm_x{w['n']}" for w in data.get('worlds', []) if w['n']}
    bundled = {}
    if os.path.exists('dist/gbquest.html'):
        m = re.search(r'window\.GB_ASSETS=(\{.*?\});</script>', open('dist/gbquest.html', encoding='utf-8').read(), re.S)
        if m: bundled = json.loads(m.group(1))
    out = {}
    for n, name in names.items():
        path = os.path.join('assets', name + '.png')
        if os.path.exists(path): out[n] = 'data:image/png;base64,' + base64.b64encode(open(path, 'rb').read()).decode()
        elif name in bundled: out[n] = bundled[name]
    missing = sorted(set(names) - set(out))
    if missing: print('atlas: no painted map for worlds', missing, '- they are left out of the world switcher')
    return out
worlds = world_maps()
html = (open('atlas/atlas_template.html').read().replace('__MAP__', uri).replace('__WORLDMAPS__', json.dumps(worlds, separators=(',', ':')))
        .replace('__DATA__', json.dumps(data, separators=(',', ':'))))
os.makedirs('dist', exist_ok=True)
open('dist/atlas.html', 'w').write(html)
json.dump(data, open('atlas/atlas.json', 'w'), separators=(',', ':'))
print('dist/atlas.html', len(html) // 1024, 'KB')
