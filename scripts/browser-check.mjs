import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {serve} from './serve.mjs';
const server=serve(0);await new Promise(r=>server.on('listening',r));
const base=process.env.SITE_URL||`http://127.0.0.1:${server.address().port}/su-27-flanker-fathomed/`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],failed=[];
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
const ready=async route=>{await page.goto(base+route);await page.waitForLoadState('networkidle');};
const settled=async()=>{await page.waitForFunction(()=>window.flankerModelViewer&&!window.flankerModelViewer.stats.missing?.length&&document.getElementById('view').dataset.ready==='true');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
const fits=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow: '+page.url());
try{
 await ready('');
 assert.equal(await page.locator('article').count(),0,'Landing page should index the exhibits and article');
 assert.deepEqual(await page.locator('.exhibit-card').evaluateAll(links=>links.map(a=>a.getAttribute('href'))),['models/','missions/','cockpit/']);
 await page.locator('.investigation-link .button').click();
 await page.waitForURL(base+'story/');
 assert((await page.locator('article').innerText()).includes('The car with the disappearing windows'));
 await ready('#the-car-with-the-disappearing-windows');
 await page.waitForURL(base+'story/#the-car-with-the-disappearing-windows');
 await ready('#explore');
 assert.equal(new URL(page.url()).pathname,new URL(base).pathname,'Exhibit anchor should stay on the overview');
 console.log('Overview cards, separate article and existing article-section links passed.');
 await ready('models/');await settled();assert.equal(await page.locator('#perturb').isChecked(),false,'Reduced motion ignored');
 const models=await page.locator('#model-select option').evaluateAll(o=>o.map(x=>x.value));assert.equal(models.length,364);
 const unrendered=await page.evaluate(async names=>{
  const api=window.flankerModelViewer,failed=[];
  const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  for(const name of names){
   await api.select(name);await frame();await frame();
   const deadline=performance.now()+4000;
   while(api.stats.missing.length && performance.now()<deadline)await frame();
   if(api.selected!==name || api.stats.missing.length)failed.push([name,api.stats.missing]);
  }
  return failed;
 },models);
 assert.deepEqual(unrendered,[],'Some catalogue entries or attachments failed to load');
 await page.locator('#category').selectOption('air_defence');
 await page.locator('#search').fill('rls1');assert.deepEqual(await page.locator('#models button').evaluateAll(bs=>bs.map(b=>b.dataset.name)),['rls1','rls113']);
 await page.locator('#models button[data-name=rls1]').click();await settled();assert.equal(await page.locator('#model-select').inputValue(),'rls1');
 await page.locator('#search').fill('');await page.locator('#category').selectOption('all');
 for(const [name,slot,value] of [['rls',4,2048],['rls1',1,4096],['tu95',1,1700],['tu95c',2,1700],['tu142',1,1700],['rsbn',3,2048]]){
  await page.locator('#model-select').selectOption(name);await settled();
  const slider=page.locator('#motion-'+slot);assert(await slider.isVisible(),name);
  const first=await page.locator('#view').screenshot();
  await slider.fill(String(value));await settled();assert(!await page.locator('#play-motion').isChecked());
  assert(!first.equals(await page.locator('#view').screenshot()),name+' angle did not change the image');
  await page.locator('#play-motion').check();await page.waitForFunction(({id,v})=>Number(document.getElementById(id).value)!==v,{id:'motion-'+slot,v:value});await page.locator('#play-motion').uncheck();
 }
 await page.locator('#model-select').selectOption('su27-1');await settled();
 assert(await page.getByLabel('Afterburner',{exact:true}).isVisible());
 // Exercise a representative of each group, including decals and the empty airfield marker.
 for(const name of ['bmp_2','akr','epilot','expl_03','betab500','hangar','car1','rusf','truba','airbase']){
  await page.locator('#model-select').selectOption(name);await settled();assert.equal(await page.evaluate(()=>window.flankerModelViewer.selected),name);
 }
 await page.locator('#model-select').selectOption('akr');await settled();const flag=await page.locator('#parameter-21 option').evaluateAll(opts=>opts.find(o=>o.textContent.toLowerCase().includes('usaf')).value);
 await page.locator('#parameter-21').selectOption(flag);await settled();
 // Keep exercising the previously published cockpit, vehicle and effect controls.
 for(const [name,ids] of Object.entries({su27:[0,4,6,13,14,10],'su27-1':[0,4,13],mig23:[17],f15:[0,4,13],il76:[0,4,9,26,27],akr:[0,1,2,21],bpk:[0,1,2,51],bmp_2:[0,1,2],buk_pzu:[0,1,2],chear:[0,3],epilot:[3,1,2],betab500:[0],agm65:[0],expl_03:[1]})){
  await page.locator('#model-select').selectOption(name);await settled();
  const controls=await page.evaluate(()=>window.flankerModelViewer.controlDefinitions.controls);
  for(const d of controls.filter(d=>ids.includes(d.id))){
   const values=d.kind==='select'?d.options.map(o=>o.value):d.kind==='bits'?[0,...d.bits.map(b=>b.value)]:[d.min,Math.round((d.min+d.max)/2),d.max];
   for(const value of values){await page.evaluate(({id,value})=>window.flankerModelViewer.setParameter(id,value),{id:d.id,value});await settled();}
  }
 }
 console.log('Rendered all 364 models and checked filtering, manual angles, playback, flags and attachments.');
 await page.locator('#model-select').selectOption('su27');await settled();await page.locator('#parameter-4').fill('0');await page.locator('#parameter-4').dispatchEvent('input');await settled();const before=await page.locator('#view').screenshot();
 await page.locator('#parameter-4').fill('16384');await page.locator('#parameter-4').dispatchEvent('input');await settled();const after=await page.locator('#view').screenshot();assert(!before.equals(after),'Landing gear did not change the rendered image');
 const camera=await page.evaluate(()=>window.flankerModelViewer.camera);await page.locator('#view').focus();await page.keyboard.press('ArrowRight');assert((await page.evaluate(()=>window.flankerModelViewer.camera.yaw))>camera.yaw);await page.getByRole('button',{name:'Zoom in',exact:true}).click();assert((await page.evaluate(()=>window.flankerModelViewer.camera.zoom))>camera.zoom);
 const box=await page.locator('#view').boundingBox();const yaw=await page.evaluate(()=>window.flankerModelViewer.camera.yaw);await page.mouse.move(box.x+200,box.y+200);await page.mouse.down();await page.mouse.move(box.x+260,box.y+215,{steps:5});await page.mouse.up();assert.notEqual(await page.evaluate(()=>window.flankerModelViewer.camera.yaw),yaw);
 await ready('models/#epilot');assert.equal(await page.locator('#model-select').inputValue(),'epilot');await ready('models/#not-a-model');assert.equal(await page.locator('#model-select').inputValue(),'su27');
 await ready('missions/');await page.waitForFunction(()=>window.flankerMissionMap);const missions=await page.locator('#mission option').evaluateAll(o=>o.map(x=>x.value));assert.equal(missions.length,8);
 for(const id of missions){await page.locator('#mission').selectOption(id);assert(await page.locator('#briefing').textContent());assert.equal(await page.evaluate(()=>window.flankerMissionMap.mission),id);const options=await page.locator('#actor option').count();if(options>1){await page.locator('#actor').selectOption('1');assert.equal(await page.evaluate(()=>window.flankerMissionMap.selected),1);}}
 await page.getByRole('button',{name:'Fit mission'}).click();const mapBefore=await page.locator('#map').screenshot();await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.waitForTimeout(70);assert(!mapBefore.equals(await page.locator('#map').screenshot()));
 await ready('missions/#ship1');assert.equal(await page.locator('#mission').inputValue(),'ship1');
 console.log('Eight mission briefings, group selection, route tables, zoom and deep links passed.');
 await ready('cockpit/');await page.waitForFunction(()=>window.flankerCockpit);
 const sets=await page.locator('#cockpit-tabs button').evaluateAll(b=>b.map(x=>x.dataset.name));for(const name of sets){await page.locator(`#cockpit-tabs button[data-name="${name}"]`).click();const max=Number(await page.locator('#frame').getAttribute('max'));for(let index=0;index<=max;index++){await page.locator('#frame').evaluate((e,i)=>{e.value=i;e.dispatchEvent(new Event('input'));},index);await page.waitForFunction(()=>{const image=document.getElementById('component-image');return image.complete&&image.naturalWidth>0;});}}
 await page.locator('#magnification').selectOption('1');assert.equal(await page.locator('#magnification').inputValue(),'1');
 console.log('All seven cockpit collections and their stored component images passed.');
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:950});for(const route of ['','story/','models/','missions/','cockpit/','sources/']){await ready(route);await fits();assert.equal(await page.locator('h1').count(),1);assert(await page.locator('main').isVisible());if(process.env.SCREENSHOT_DIR&&width!==768){await mkdir(process.env.SCREENSHOT_DIR,{recursive:true});await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>{image.loading='eager';return image.decode();})));await page.screenshot({path:`${process.env.SCREENSHOT_DIR}/${route.replace('/','')||'overview'}-${width}.png`,fullPage:route!=='story/',animations:'disabled'});}}}
 for(const scheme of ['light','dark']){
  await page.emulateMedia({colorScheme:scheme});
  for(const route of ['','story/','models/','missions/','cockpit/','sources/']){
    await ready(route);
    assert(await page.evaluate(()=>{
      const rgb=getComputedStyle(document.body).backgroundColor.match(/\d+/g).slice(0,3).map(Number);
      return Math.max(...rgb)<65;
    }),`Page should remain dark with ${scheme} system settings: ${route}`);
  }
 }
 const nojs=await browser.newPage({javaScriptEnabled:false});await nojs.goto(base+'story/');assert((await nojs.locator('article').innerText()).includes('The car with the disappearing windows'));await nojs.goto(base+'models/');assert(await nojs.locator('noscript').isVisible());await nojs.close();
 assert.deepEqual(errors,[],'Browser exceptions');assert.deepEqual(failed,[],'Failed asset requests');
 console.log('Desktop/tablet/mobile layouts, dark pages under both system themes, reduced motion, no-JavaScript article and project-prefix URLs passed.');
}finally{await browser.close();server.close();}
