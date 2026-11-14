import assert from 'node:assert/strict';
import {readFile,readdir,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {parse} from 'parse5';
import {spawnSync} from 'node:child_process';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),dist=path.join(root,'dist');
async function walk(dir){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name),s=await lstat(file);assert(!s.isSymbolicLink(),`Symlink in artifact: ${file}`);if(entry.isDirectory())result.push(...await walk(file));else result.push(file);}return result;}
const files=await walk(dist),all=new Set(files),documents=new Map();let bytes=0;
const extensions=new Set(['.html','.css','.mjs','.json','.png','.webp','.svg','.txt','.xml']);
for(const file of files){bytes+=(await lstat(file)).size;assert(extensions.has(path.extname(file))||path.basename(file)==='.nojekyll',`Unexpected artifact: ${file}`);assert(!/\/(installs?|work|node_modules|research-notes|extracted|scripts)\//.test(file.slice(dist.length)),`Research/build directory in artifact: ${file}`);if(file.endsWith('.json'))JSON.parse(await readFile(file,'utf8'));if(file.endsWith('.mjs')){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);}if(file.endsWith('.html')){const ids=new Set(),links=[];let mains=0,h1s=0;function visit(node){const attrs=Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]));if(attrs.id){assert(!ids.has(attrs.id),`Duplicate id ${attrs.id} in ${file}`);ids.add(attrs.id);}if(node.tagName==='main')mains++;if(node.tagName==='h1')h1s++;if(node.tagName==='img')assert(Object.hasOwn(attrs,'alt'),`Unlabelled image in ${file}`);for(const attr of ['href','src'])if(attrs[attr])links.push(attrs[attr]);for(const child of node.childNodes||[])visit(child);}visit(parse(await readFile(file,'utf8')));assert.equal(mains,1);assert.equal(h1s,1);documents.set(file,{ids,links});}}
assert(bytes<20*1024*1024,`Artifact unexpectedly large: ${bytes}`);
assert.equal(documents.size,6,'Expected the overview, article and four supporting pages');
for(const[file,{links}]of documents)for(const link of links){if(/^(https?:|mailto:|data:)/.test(link))continue;const url=new URL(link,'https://local/'+path.relative(dist,file));assert.equal(url.origin,'https://local');let target=path.join(dist,decodeURIComponent(url.pathname));if(url.pathname.endsWith('/'))target=path.join(target,'index.html');assert(all.has(target),`Broken link in ${path.relative(dist,file)}: ${link}`);if(url.hash&&target.endsWith('.html')&&!['models','missions','cockpit'].some(route=>target===path.join(dist,route,'index.html')))assert(documents.get(target)?.ids.has(decodeURIComponent(url.hash.slice(1))),`Missing anchor ${link}`);}
const catalog=JSON.parse(await readFile(path.join(dist,'data/models/viewer.json'),'utf8'));
assert.equal(catalog.models.length,18);
for(const name of catalog.available_models)assert(all.has(path.join(dist,'data/models',name+'.json')),`Missing dependency ${name}`);
for(const model of catalog.models){assert(all.has(path.join(dist,'data/models',model.thumbnail.split('?')[0])));for(const d of catalog.parameter_controls[model.name].controls)if(d.kind==='select')for(const o of d.options){const name=catalog.registry[o.value];if(name)assert(catalog.available_models.includes(name),`Missing attachment ${name}`);}}
const missions=JSON.parse(await readFile(path.join(dist,'data/map/missions.json'),'utf8'));assert.equal(missions.length,8);assert.equal(new Set(missions.map(m=>m.id)).size,8);
const cockpit=JSON.parse(await readFile(path.join(dist,'data/cockpit/catalog.json'),'utf8'));for(const entry of cockpit)for(const frame of entry.frames)assert(all.has(path.join(dist,'data/cockpit',frame.file)),`Missing component ${frame.file}`);
for(const file of await walk(path.join(root,'src'))){if(file.endsWith('.mjs')){const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);}}
console.log(`Checked ${documents.size} pages, all local links/anchors, client syntax, ${catalog.available_models.length} shape dependencies, 8 missions and ${cockpit.length} component sets.`);
console.log(`Pages artifact: ${files.length} files, ${(bytes/1024/1024).toFixed(2)} MiB; no installation media or research work directories.`);
