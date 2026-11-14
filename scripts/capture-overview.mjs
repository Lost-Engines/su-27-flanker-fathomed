import {chromium} from 'playwright';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {serve} from './serve.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=serve(0);
await new Promise(resolve=>server.on('listening',resolve));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  await page.goto(`http://127.0.0.1:${server.address().port}/su-27-flanker-fathomed/missions/#t_ftoff`);
  await page.waitForFunction(()=>window.flankerMissionMap&&document.getElementById('map').dataset.ready==='true');
  await page.locator('#map').evaluate(canvas=>{canvas.style.width='960px';canvas.style.height='600px';});
  await page.getByRole('button',{name:'Fit mission'}).click();
  await page.waitForFunction(()=>{const canvas=document.getElementById('map');return canvas.width===960&&canvas.height===600;});
  const pixels=await page.locator('#map').evaluate(canvas=>canvas.toDataURL('image/png').split(',')[1]);
  await writeFile(root+'public/images/mission-preview.png',Buffer.from(pixels,'base64'));
  const manifest=JSON.parse(await readFile(root+'content/illustration-provenance.json','utf8'));
  manifest.mission_preview={output:'mission-preview.png',source:'Browser mission viewer',mission:'t_ftoff',width:960,height:600,renderer_sha256:createHash('sha256').update(await readFile(root+'src/missions.mjs')).digest('hex')};
  await writeFile(root+'content/illustration-provenance.json',JSON.stringify(manifest,null,2)+'\n');
  console.log('Captured the overview mission card from the working viewer.');
} finally { await browser.close();server.close(); }
