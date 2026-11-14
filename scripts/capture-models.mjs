import {chromium} from 'playwright';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {serve} from './serve.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const scratch=process.env.CAPTURE_DIR;
if(!scratch)throw Error('Set CAPTURE_DIR to a work directory for intermediate PNGs.');
await mkdir(scratch,{recursive:true});
const server=serve(0);await new Promise(r=>server.on('listening',r));
const base=`http://127.0.0.1:${server.address().port}/su-27-flanker-fathomed/`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:2000,height:1400},deviceScaleFactor:1});
 page.on('pageerror',e=>console.error(e));
 await page.goto(base+'models/');await page.waitForFunction(()=>window.flankerModelViewer);
 await page.locator('#perturb').uncheck();
 const captures=[{name:'su27',file:root+'public/images/hero.png',width:1600,height:1000,camera:[.85,.42,1.5],parameters:{0:1,4:0,13:4096}},{name:'su27',file:scratch+'/su27.png',width:720,height:720,camera:[.9,.4,1.12],parameters:{0:1,4:16384,13:4096}},{name:'chear',file:scratch+'/chear.png',width:360,height:720,camera:[.85,.15,1.65],parameters:{0:1,1:4096,2:0,3:26}},{name:'epilot',file:scratch+'/epilot.png',width:360,height:720,camera:[.85,.15,1.65],parameters:{1:4096,2:0,3:38}}];
 for(const c of captures){await page.evaluate(async c=>{const api=window.flankerModelViewer;await api.select(c.name);for(const[id,value]of Object.entries(c.parameters))api.setParameter(Number(id),value);const canvas=document.getElementById('view');canvas.style.width=c.width+'px';canvas.style.height=c.height+'px';api.setCamera(...c.camera);},c);await page.waitForFunction(()=>window.flankerModelViewer.stats.primitives>0&&!window.flankerModelViewer.stats.missing.length);await page.waitForTimeout(150);const data=await page.locator('#view').evaluate(c=>c.toDataURL('image/png').split(',')[1]);await writeFile(c.file,Buffer.from(data,'base64'));console.log('Captured '+c.name+' at '+c.width+' × '+c.height);}
 await writeFile(root+'content/illustration-provenance.json',JSON.stringify({renderer_sha256:createHash('sha256').update(await readFile(root+'src/model/viewer.mjs')).digest('hex'),captures:captures.map(({file,...c})=>({...c,output:file.split('/').pop()})),composition:'model-exhibits.png: su27.png, chear.png, epilot.png placed left-to-right, unchanged pixels.'},null,2)+'\n');
}finally{await browser.close();server.close();}
