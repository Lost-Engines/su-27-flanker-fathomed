#!/usr/bin/env python3
"""Import the explicit public exhibit selection from the adjacent research tree.

Normal builds use the checked-in results; they never traverse the research tree.
No executable, archive, install tree, raw mission or validation dump is imported.
"""
from pathlib import Path
from hashlib import sha256
from collections import Counter
import json
import sys
import copy as copying
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT.parent / 'su-27-flanker-reverse'
records = []
def read(path):
    p = SOURCE / path
    data = p.read_bytes()
    records.append({'source': path, 'sha256': sha256(data).hexdigest()})
    return data
def write(path, data):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(data if isinstance(data, bytes) else data.encode())
def load(path): return json.loads(read(path))
def dump(path, data): write(path, json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
def copy(src, dst): write(dst, read(src))

# Named exhibits and the controls useful to someone exploring them for the first time.
selection = {
 'su27': ('Su-27', [0, 4, 6, 13, 14, 10]),
 'su27-1': ('Su-27 · alternate colours', [0, 4, 13]),
 'mig23': ('MiG-23', [17]),
 'f15': ('F-15', [0, 4, 13]),
 'il76': ('Il-76 transport', [0, 4, 9, 26, 27]),
 'tu95': ('Tu-95', []),
 'akr': ('Moskva helicopter cruiser', [0, 1, 2, 21]),
 'bpk': ('Udaloy destroyer', [0, 1, 2, 51]),
 'bmp_2': ('BMP-2', [0, 1, 2]),
 'buk_pzu': ('Buk missile vehicle', [0, 1, 2]),
 'trproj': ('Searchlight truck', []),
 'car1': ('Car · the window puzzle', []),
 'chear': ('Ejection seat', [0, 3]),
 'epilot': ('Parachutist', [3, 1, 2]),
 'betab500': ('BetAB-500 bomb', [0]),
 'agm65': ('AGM-65 missile', [0]),
 'expl_03': ('Explosion', [1]),
 'hangar': ('Aircraft hangar', []),
}
base = 'extracted/shapes/win_1_5/'
catalog = load(base + 'viewer.json')
catalog['parameter_controls']['su27-1'] = copying.deepcopy(catalog['parameter_controls']['su27'])
entries = {m['name']: m for m in catalog['models']}
for name in selection:
    if name not in entries: raise ValueError('Unknown exhibit: ' + name)
# Keep attachment choices and defaults in the closure, including nested references.
queue = list(selection)
models = {}
while queue:
    name = queue.pop()
    if name in models: continue
    model = load(base + name + '.json')
    models[name] = model
    dependencies = set()
    for node in model['nodes']:
        # Defaults may feed a parameter-shape command in a child with a parameter offset.
        for value in node['parameters']:
            if str(value) in catalog['registry']: dependencies.add(catalog['registry'][str(value)])
        for surface in node['surfaces']:
            if surface['kind'] == 17:
                ref = surface.get('name') or catalog['registry'].get(str(surface.get('reference')))
                if ref: dependencies.add(ref)
    for control in catalog['parameter_controls'].get(name, {}).get('controls', []):
        if control['kind'] == 'select':
            dependencies.update(catalog['registry'][str(o['value'])] for o in control['options'] if str(o['value']) in catalog['registry'])
    for dep in sorted(dependencies):
        if (SOURCE / base / (dep + '.json')).exists() and dep not in models: queue.append(dep)
for name, model in sorted(models.items()): dump('public/data/models/' + name + '.json', model)
catalog['models'] = [dict(entries[n], display_name=label) for n, (label, _) in selection.items()]
counts = Counter(m['category'] for m in catalog['models'])
catalog['categories'] = [dict(g, count=counts[g['id']]) for g in catalog['categories'] if counts[g['id']]]
for name, (_, ids) in selection.items():
    schema = catalog['parameter_controls'].get(name, {})
    schema['controls'] = [d for d in schema.get('controls', []) if d['id'] in ids]
    schema['partial'] = False
    schema.pop('note', None)
    # Friendly, visible starting poses; reset returns to these exhibit poses.
    if name == 'epilot': schema['preview'] = {'parameters': {'1': 4096, '2': 0, '3': 38}}
    if name == 'chear': schema['preview'] = {'parameters': {'0': 1, '1': 4096, '2': 0, '3': 26}}
    catalog['parameter_controls'][name] = schema
    copy(base + entries[name]['thumbnail'].split('?')[0], 'public/data/models/' + entries[name]['thumbnail'].split('?')[0])
for key in ['parameter_controls','surface_overlays','surface_supports','attachment_overlays']:
    catalog[key] = {n: v for n, v in catalog[key].items() if n in models}
catalog['available_models'] = sorted(models)
dump('public/data/models/viewer.json', catalog)
for name in ['shape.mjs', 'depth.mjs']:
    copy('analysis/models/' + name, 'src/model/' + name)
# Renderer stays recognisably the research renderer. UI, data root and lifecycle are adapted.
viewer = read('analysis/models/viewer.mjs').decode()
viewer = viewer.replace("const root='../../extracted/shapes/win_1_5/'", "const root='../data/models/'")
viewer = viewer.replace('Run tools/export_model_viewer.py first.', 'The model data could not be loaded. Please reload the page.')
viewer = viewer.replace('parameters=modelParameters();controls()', 'parameters=modelParameters(true);controls()')
viewer = viewer.replace("await select(location.hash.slice(1)||'su27');", "await select(catalog.models.some(m=>m.name===location.hash.slice(1))?location.hash.slice(1):'su27');")
viewer = viewer.replace("const dpr=devicePixelRatio||1", "const dpr=devicePixelRatio||1")
# Avoid animating hidden pages or disregarding a visitor's reduced-motion preference.
viewer = viewer.replace('function tick(time){', 'function tick(time){if(document.hidden){requestAnimationFrame(tick);return;}')
viewer = viewer.replace('window.flankerModelViewer={select,', 'window.flankerModelViewer={select,get camera(){return {yaw,pitch,zoom}},setCamera(y,p,z=1){yaw=y;pitch=p;zoom=z;dirty=true},')
# Fit the current projected silhouette: wide aircraft should use the wide stage,
# while tall figures retain enough vertical room. Limit the initial enlargement.
viewer = viewer.replace("  zoom = 1;\n  dirty = true;\n}\nfunction modelParameters", """  const forward = normalise([Math.cos(pitch)*Math.cos(yaw), Math.sin(pitch), Math.cos(pitch)*Math.sin(yaw)]);
  const right = normalise(cross([0,1,0], forward)), up = cross(forward, right);
  const aspect = canvas.clientWidth / canvas.clientHeight || 1;
  const extent = Math.max(1, ...points.map(p => Math.max(Math.abs(dot(right, sub(p,bounds.center))) / aspect, Math.abs(dot(up, sub(p,bounds.center))))));
  zoom = Math.min(1.7, bounds.radius / (extent * Math.min(1,aspect)));
  dirty = true;
}
function modelParameters""")
write('src/model/viewer.mjs', viewer)

mapbase = 'extracted/maps/win_1_5/'
mapcat = load(mapbase + 'viewer.json')
# A single terrain set, only the 2D surface geometry needed by this exhibit.
for name in ['coarse', 'overview']:
    dump('public/data/map/' + name + '.json', load(mapbase + 'map/' + name + '.json'))
dump('public/data/map/catalog.json', {'tiles': mapcat['variants']['map'], 'palette': next(p['palette'] for p in mapcat['palettes'] if p['name']=='1300'), 'materials': mapcat['materials'], 'aircraft_types': mapcat['aircraft_types']})
missions = []
for name in ['T_FTOFF','AIR1','AIR6','SHIP1','T_A2A','T_CAS_1','T_PINP','T_FREEF']:
    m = load(mapbase + 'missions/MISSION/' + name + '.MIS.json')
    # Drop parser offsets and opaque binary header fields from this public reading view.
    m = {k: m[k] for k in ['name','format','title','briefing','objects']}
    for o in m['objects']:
        for k in ['offset','bytes','header_hex']: o.pop(k, None)
    m['id'] = name.lower()
    missions.append(m)
dump('public/data/map/missions.json', missions)

# Exact viewport crops of existing original-game captures (remove host desktop borders).
for src, dst in [('sce-v1.5-flight.png','original-cockpit.png'), ('sce-v1.5-external.png','original-external.png')]:
    path = 'analysis/installations/screenshots/' + src
    read(path)
    im = Image.open(SOURCE / path)
    assert im.size == (1280,960), im.size
    im.crop((320,240,960,720)).save(ROOT / 'public/images' / dst)
    records[-1]['transform'] = 'crop (320,240)-(960,720); unchanged 640×480 game pixels'
for src, dst in [('analysis/editor/screenshots/dos-open.png','dos-editor.png'),('analysis/editor/screenshots/dos-weather.png','dos-weather.png')]:
    copy(src, 'public/images/' + dst)
chart = read('analysis/simulation/aerodynamic-coefficients.svg').decode()
write('public/images/aerodynamics.svg', '\n'.join(line.rstrip() for line in chart.splitlines()) + '\n')
records[-1]['transform'] = 'Remove trailing whitespace; SVG drawing data unchanged.'

components = load('extracted/ui/cockpit/index.json')
sheets = []
for filename, title, limit in [('hkurs.dat','Compass ring',6),('hsu27hud.dat','HUD symbols',21),('tv.dat','Target display symbols',48),('mirror1.bin','Centre mirror mask',1),('mirror2.bin','Left mirror mask',1),('mirror3.bin','Right mirror mask',1),('helmet.dat','Helmet sight',1)]:
    e = next(e for e in components['entries'] if e['name']==filename and any('/win_1_5/' in s for s in e['sources']))
    frames = []
    for i,c in enumerate(e['components'][:limit]):
        if 'preview' not in c: continue
        dest = filename.replace('.','-') + '-' + str(i) + '.png'
        copy('extracted/ui/cockpit/' + c['preview'], 'public/data/cockpit/' + dest)
        width, height = Image.open(ROOT / 'public/data/cockpit' / dest).size
        frames.append({'file': dest, 'width': width, 'height': height, 'kind': c['kind']})
    sheets.append({'name': filename, 'title': title, 'frames': frames})
dump('public/data/cockpit/catalog.json', sheets)

# Identify the article's working sources by path and hash only. Their complete
# text is private research material and is not copied into this repository.
notes = ['initial/README.md','initial/executables.md','models/README.md','models/car-windows.md','models/parameters.md','maps/README.md','missions/README.md','missions/demo-flights.md','editor/README.md','cockpit/README.md','simulation/aerodynamics.md','input/key-reference-audit.md','status.md']
research_sources = []
for path in notes:
    data = (SOURCE / 'analysis' / path).read_bytes()
    research_sources.append({'source': 'analysis/' + path, 'sha256': sha256(data).hexdigest()})

dump('content/data-provenance.json', {'edition':'Clean Windows Squadron Commander’s Edition 1.5', 'source_repository':'su-27-flanker-reverse (local research tree)', 'models': list(selection), 'model_dependencies': sorted(set(models)-set(selection)), 'imports': records, 'research_sources': research_sources})
print(f'Imported {len(selection)} exhibits, {len(models)} shapes with dependencies, {len(missions)} missions; {len(records)} explicit source reads.')
