#!/usr/bin/env python3
"""Import the explicit public exhibit selection from the adjacent research tree.

Normal builds use the checked-in results; they never traverse the research tree.
No executable, archive, install tree, raw mission or validation dump is imported.
"""
from pathlib import Path
from hashlib import sha256
import json
import sys
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

# Publish the complete catalogue. Each shape is fetched when selected.
base = 'extracted/shapes/win_1_5/'
catalog = load(base + 'viewer.json')
models = [entry['name'] for entry in catalog['models']]
notes = {
 'su27': 'One aircraft, 41 shape nodes. Extend the gear to watch the doors and struts follow their own curves.',
 'su27-1': 'One of the 26 additional Su-27 colour schemes. Missions select these as aircraft types; they share geometry and flight data.',
 'mig23': 'The wing-sweep curves follow the aircraft’s Mach number, with two short transitions separated by plateaux.',
 'f15': 'The F-15 uses the same broad arrangement of state flags, flight controls and attachment slots as the Su-27.',
 'il76': 'The ramp waits until the cargo doors begin opening, then lowers. Try extending the gear as well.',
 'tu95': 'A large aircraft built from a small number of shaded polygons. Each engine has two rows of propellers turning in opposite directions.',
 'akr': 'Moskva, a helicopter cruiser. These controls operate the first gun mount and the flag insignia.',
 'bpk': 'The game identifies this ship as Udaloy. Its radar antennas use two different rotation speeds.',
 'bmp_2': 'A rotating turret, elevating barrel and firing effect are separate from the hull and running gear.',
 'buk_pzu': 'The state word selects which missiles are still present. The whole launcher then rotates and elevates.',
 'trproj': 'The searchlight truck is a static model. The lamp, cab and wheels are assembled from ten shape nodes.',
 'car1': 'The original paints the windows over the body even where the geometry intersects. This preview adapts those two faces to preserve the intended appearance.',
 'chear': 'The seat’s rockets fade before its drogue parachute extends. The pilot later separates into the epilot model.',
 'epilot': 'Scrub the deployment stage to open the parachute and settle the pilot’s arms and legs. Subtle canopy movement comes from the model’s random transforms.',
 'betab500': 'The live bomb starts with its parachute, then switches to the booster. Both can be shown here to inspect the individual parts.',
 'agm65': 'A single flag shows the missile’s engine flame.',
 'expl_03': 'Several expanding parts and conditional stages form the explosion. Auto-fit keeps it in frame while you scrub its age.',
 'hangar': 'A scenery building, drawn from the same shape format as the aircraft and weapons.'
}

for entry in catalog['models']:
    if entry['name'] in notes:
        entry['hint'] = notes[entry['name']]
    filename = entry['name'] + '.json'
    copy(base + filename, 'public/data/models/' + filename)
    if thumbnail := entry.get('thumbnail'):
        filename = thumbnail.split('?')[0]
        copy(base + filename, 'public/data/models/' + filename)
# The public DOS exhibit needs geometry and animation, while the research
# download also carries parser offsets and byte-coverage information.
for name in catalog['dos_patterns']['files']:
    shape = load('extracted/shapes/dos_1_1/' + name + '.json')
    for node in shape['nodes']:
        for s in node['surfaces']:
            for field in ('offset', 'type', 'reserved07'):
                s.pop(field, None)
    dump('public/data/models/dos/' + name + '.json', shape)

# Exhibition starting poses for the two stages of ejection.
catalog['parameter_controls']['epilot']['preview'] = {'parameters': {'1': 4096, '2': 0, '3': 38}}
catalog['parameter_controls']['chear']['preview'] = {'parameters': {'0': 1, '1': 4096, '2': 0, '3': 26}}
dump('public/data/models/viewer.json', catalog)
for name in ['shape.mjs', 'depth.mjs', 'motion.mjs', 'parameter-definitions.mjs', 'browser.mjs', 'browser.css', 'viewer.mjs']:
    copy('analysis/models/' + name, 'src/model/' + name)

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

dump('content/data-provenance.json', {'edition':'Windows Squadron Commander’s Edition 1.5 and DOS 1.1 patterned model variants', 'source_repository':'su-27-flanker-reverse (local research tree)', 'models': models, 'imports': records, 'research_sources': research_sources})
print(f'Imported {len(models)} models, {len(missions)} missions; {len(records)} explicit source reads.')
