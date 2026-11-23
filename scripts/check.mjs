import assert from 'node:assert/strict';
import {readFile,readdir,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {parse} from 'parse5';
import {spawnSync} from 'node:child_process';
import {cross,sub,triangles,patternedTriangles,flagOnCloth,random} from '../src/model/shape.mjs';
import {parameterDefinitions} from '../src/model/parameter-definitions.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),dist=path.join(root,'dist');
async function walk(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name),s=await lstat(file);assert(!s.isSymbolicLink(),`Symlink in artifact: ${file}`);if(entry.isDirectory())result.push(...await walk(file));else result.push(file);}return result;}
const files=await walk(dist),all=new Set(files),documents=new Map();let bytes=0;
const extensions=new Set(['.html','.css','.mjs','.json','.png','.webp','.svg','.txt','.xml']);
for(const file of files){bytes+=(await lstat(file)).size;assert(extensions.has(path.extname(file))||path.basename(file)==='.nojekyll',`Unexpected artifact: ${file}`);assert(!/\/(installs?|work|node_modules|research-notes|extracted|scripts)\//.test(file.slice(dist.length)),`Research/build directory in artifact: ${file}`);if(file.endsWith('.json'))JSON.parse(await readFile(file,'utf8'));if(file.endsWith('.mjs')){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);}if(file.endsWith('.html')){const ids=new Set(),links=[];let mains=0,h1s=0;function visit(node){const attrs=Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]));if(attrs.id){assert(!ids.has(attrs.id),`Duplicate id ${attrs.id} in ${file}`);ids.add(attrs.id);}if(node.tagName==='main')mains++;if(node.tagName==='h1')h1s++;if(node.tagName==='img')assert(Object.hasOwn(attrs,'alt'),`Unlabelled image in ${file}`);for(const attr of ['href','src'])if(attrs[attr])links.push(attrs[attr]);for(const child of node.childNodes||[])visit(child);}visit(parse(await readFile(file,'utf8')));assert.equal(mains,1);assert.equal(h1s,1);documents.set(file,{ids,links});}}
assert(bytes<20*1024*1024,`Artifact unexpectedly large: ${bytes}`);
assert.equal(documents.size,6,'Expected the overview, article and four supporting pages');
for(const[file,{links}]of documents)for(const link of links){if(/^(https?:|mailto:|data:)/.test(link))continue;const url=new URL(link,'https://local/'+path.relative(dist,file));assert.equal(url.origin,'https://local');let target=path.join(dist,decodeURIComponent(url.pathname));if(url.pathname.endsWith('/'))target=path.join(target,'index.html');assert(all.has(target),`Broken link in ${path.relative(dist,file)}: ${link}`);if(url.hash&&target.endsWith('.html')&&!['models','missions','cockpit'].some(route=>target===path.join(dist,route,'index.html')))assert(documents.get(target)?.ids.has(decodeURIComponent(url.hash.slice(1))),`Missing anchor ${link}`);}
const catalog=JSON.parse(await readFile(path.join(dist,'data/models/viewer.json'),'utf8'));
const names=new Set(catalog.models.map(m=>m.name));
assert.equal(names.size,364,'Expected the complete SCE 1.5 model library');
assert.equal(names.size,catalog.models.length);
for(const group of catalog.categories)assert.equal(catalog.models.filter(m=>m.category===group.id).length,group.count);
for(const model of catalog.models){
  const shape = JSON.parse(await readFile(path.join(dist, 'data/models', model.name + '.json'), 'utf8'));
  const schema = parameterDefinitions(shape, catalog);
  assert(schema.controls.every(d => !/^Parameter \d+$/.test(d.label)), model.name + ' has an unnamed control');
  if (schema.evidence?.endsWith('#shared-model-controls')) {
    const raw = parameterDefinitions(shape, {registry: catalog.registry});
    assert.deepEqual(schema.controls.map(d => d.id), raw.controls.map(d => d.id), model.name + ' mesh inputs');
  }
  if(model.thumbnail)assert(all.has(path.join(dist,'data/models',model.thumbnail.split('?')[0])));
  else assert.equal(model.name,'airbase','Only the empty airbase marker has no thumbnail');
  for(const d of catalog.parameter_controls[model.name]?.controls||[])if(d.kind==='select')for(const o of d.options){
    if(o.value)assert(names.has(catalog.registry[o.value]),`Missing attachment ${o.value}`);
  }
}
const dos=catalog.dos_patterns, dosFiles=new Set(dos.files), available=new Set([...dos.files,...dos.shared]);
assert.equal(Object.keys(dos.models).length,33);
for (const name of dos.files) assert(all.has(path.join(dist,'data/models/dos',name+'.json')), 'Missing DOS mesh '+name);
for (const name of dos.shared) assert(names.has(name) && !dosFiles.has(name), 'Shared DOS attachment '+name);
for (const name of Object.keys(dos.models)) {
  assert(dosFiles.has(name));
  const shape=JSON.parse(await readFile(path.join(dist,'data/models/dos',name+'.json'),'utf8'));
  const controls=dos.parameter_controls[name].controls;
  assert.deepEqual(controls.map(d=>d.id),parameterDefinitions(shape,{registry:dos.registry}).controls.map(d=>d.id),name+' DOS controls');
  for (const d of controls) for (const o of d.options || [])
    if(o.value) assert(available.has(dos.registry[o.value]),'Missing DOS attachment '+o.label);
  for (const node of shape.nodes) for (const face of node.surfaces)
    if (face.kind===17 && face.reference) assert(available.has(dos.registry[face.reference]),name+' fixed attachment');
}
for (const name of ['katersm4', 'katersm2']) {
  for (const edition of ['', 'dos']) {
    const shape = JSON.parse(await readFile(path.join(dist, 'data/models', edition, name + '.json'), 'utf8'));
    const hull = shape.nodes[0];
    const rails = hull.surfaces.filter(face => face.indices?.length === 16);
    assert.equal(rails.length, 2, name + ' bow rails');
    for (const rail of rails) {
      assert.equal(rail.kind, edition === 'dos' ? 3 : 2);
      if (edition === 'dos') {
        assert.equal(rail.pattern, 3);
        assert.equal(rail.pattern_colour, 65535);
      }
      const points = rail.indices.map(i => hull.vertices[i]);
      const faces = edition === 'dos' ? patternedTriangles(points) : triangles(points);
      assert.equal(faces.length, 14, name + ' seven rail panels');
      for (const indices of faces) {
        const [a, b, c] = indices.map(i => points[i]);
        const normal = cross(sub(b, a), sub(c, a));
        assert(Math.hypot(...normal) > 0);
        assert.equal(Math.abs(normal[1]), 0, name + ' rail crosses the deck');
      }
    }
  }
}
const ship = JSON.parse(await readFile(path.join(dist, 'data/models/dos/katersm4.json'), 'utf8'));
const flag = ship.nodes.find(node => node.name === 'flag');
const cloth = flag.surfaces[0].indices.map(i => flag.vertices[i]);
function twiceArea(points) {
  return Math.abs(points.reduce((area, [x, y], i) => {
    const [nx, ny] = points[(i + 1) % points.length];
    return area + x * ny - y * nx;
  }, 0));
}
for (const name of ['rusf', 'ukrf', 'usaf', 'turf']) {
  for (const dir of dosFiles.has(name) ? ['', 'dos'] : ['']) {
    const model = JSON.parse(await readFile(path.join(dist, 'data/models', dir, name + '.json'), 'utf8'));
    const art = model.nodes[0], points = flagOnCloth(art, cloth);
    // Russia and Ukraine use adjacent stripes. The US and Turkish designs
    // put their detail on a single polygon covering the whole flag.
    const field = name === 'rusf' || name === 'ukrf' ? art.surfaces : [art.surfaces[0]];
    const covered = field.reduce((area, face) => area + twiceArea(face.indices.map(i => points[i])), 0);
    assert(Math.abs(covered - twiceArea(cloth)) < 1e-6, name + ' artwork leaves cloth exposed');
  }
}
const sequence = random(1);
sequence(682);
sequence(682);
const resumed = random(sequence.state);
for (let i = 0; i < 12; i++) assert.equal(resumed(682), sequence(682), 'Flag sequence must resume after the last draw');
for (const name of ['tu95', 'tu95c', 'tu142']) {
  const shape = JSON.parse(await readFile(path.join(dist, 'data/models', name + '.json'), 'utf8'));
  const raw = parameterDefinitions(shape, {registry: catalog.registry}).controls;
  const {controls, preview} = catalog.parameter_controls[name];
  assert.deepEqual(controls.map(d => d.id), raw.map(d => d.id), name + ' local parameters');
  assert.deepEqual(controls.find(d => d.id === 0).bits.map(b => b.value), [1, 16, 32]);
  assert.equal(preview.parameters[0], 17);
  const choices = id => controls.find(d => d.id === id).options.map(o => o.value ? catalog.registry[o.value] : null);
  assert.deepEqual(choices(10), [null, 'rusf', 'ukrf', 'usaf', 'turf']);
  assert.deepEqual(choices(12), [null, ...Array.from({length: 16}, (_, i) => 'n' + String(i + 1).padStart(2, '0'))]);
  const numberOverlay = catalog.attachment_overlays[name].SubHalf;
  assert.equal(numberOverlay.parameter, 12);
  assert.deepEqual(numberOverlay.models, choices(12).slice(1));
  const pylons = controls.filter(d => d.id >= 18 && d.id <= 21);
  assert.equal(pylons.length, name === 'tu142' ? 0 : 4);
  for (const pylon of pylons) assert.deepEqual(choices(pylon.id), [null, 'x55']);
}
assert.equal(catalog.models.filter(m=>m.motion_clocks?.length).length,39);
const missions=JSON.parse(await readFile(path.join(dist,'data/map/missions.json'),'utf8'));assert.equal(missions.length,8);assert.equal(new Set(missions.map(m=>m.id)).size,8);
const cockpit=JSON.parse(await readFile(path.join(dist,'data/cockpit/catalog.json'),'utf8'));for(const entry of cockpit)for(const frame of entry.frames)assert(all.has(path.join(dist,'data/cockpit',frame.file)),`Missing component ${frame.file}`);
for(const file of await walk(path.join(root,'src'))){if(file.endsWith('.mjs')){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);}}
console.log(`Checked ${documents.size} pages, all local links/anchors, client syntax, ${names.size} models, 8 missions and ${cockpit.length} component sets.`);
console.log(`Pages artifact: ${files.length} files, ${(bytes/1024/1024).toFixed(2)} MiB; no installation media or research work directories.`);
