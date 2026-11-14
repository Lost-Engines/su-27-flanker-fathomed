const $ = id => document.getElementById(id);
async function json(path) { const response = await fetch(`../data/map/${path}.json`); if (!response.ok) throw Error(`Could not load ${path}`); return response.json(); }
try {
  const [catalog, coarse, overview, missions] = await Promise.all(['catalog','coarse','overview','missions'].map(json));
  const canvas = $('map'), ctx = canvas.getContext('2d');
  let mission, selected = 0, centre = [65000,45000], span = 330000, drag = null, dirty = true;
  const colours = ['#93d7ef','#ffb49a'];
  const position = p => [p[2]/32,p[0]/32];
  const priority = p => p.kind === 'flat' ? catalog.materials[p.material][5] + 256*catalog.materials[p.material][6] : 0;
  coarse.sort((a,b) => priority(b)-priority(a)); overview.sort((a,b) => priority(b)-priority(a));
  const tiles = new Map(catalog.tiles.map(t => [t.name,{...t,polygons:[]} ]));
  for (const polygon of overview) tiles.get(polygon.tile)?.polygons.push(polygon);
  const colour = p => `rgb(${catalog.palette[p.kind==='flat'?catalog.materials[p.material][1]:p.material].join(',')})`;
  const screen = p => [(p[0]-centre[0])*canvas.width/span+canvas.width/2,(centre[1]-p[1])*canvas.width/span+canvas.height/2];
  function world(event) { const r=canvas.getBoundingClientRect(),k=span/r.width; return [centre[0]+(event.clientX-r.left-r.width/2)*k,centre[1]-(event.clientY-r.top-r.height/2)*k]; }
  function path(points) {ctx.beginPath();points.forEach((p,i)=>{const [x,y]=screen(p);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});}
  function polygon(p) {if(p.points.length<3)return;path(p.points);ctx.closePath();ctx.fillStyle=colour(p);ctx.fill();}
  const origin = o => o.route?.length ? position(o.route[0].position) : o.position?.length === 3 ? position(o.position) : null;
  function label(o,i) { return o.type==='aircraft' ? `${catalog.aircraft_types[o.aircraft_type]||'Aircraft'} · group ${i+1}` : `${o.type==='surface_unit'?'Surface unit':'Scenery marker'} ${i+1}`; }
  function draw() {
    const dpr = devicePixelRatio||1;
    canvas.width=Math.round(canvas.clientWidth*dpr);canvas.height=Math.round(canvas.clientHeight*dpr);
    ctx.fillStyle=`rgb(${catalog.palette[185].join(',')})`;ctx.fillRect(0,0,canvas.width,canvas.height);
    for(const p of coarse) polygon(p);
    for(const tile of tiles.values()) {
      const [x,y]=screen([tile.origin[0],tile.origin[1]+16384]),side=16384*canvas.width/span;
      if(x+side<0||y+side<0||x>canvas.width||y>canvas.height)continue;
      ctx.save();ctx.beginPath();ctx.rect(x,y,side,side);ctx.clip();
      ctx.fillStyle=`rgb(${catalog.palette[185].join(',')})`;ctx.fillRect(x,y,side,side);
      for(const p of tile.polygons)polygon(p);ctx.restore();
    }
    if(mission)for(const [index,o]of mission.objects.entries()) {
      const points=(o.route||[]).map(w=>position(w.position));
      const active=index===selected;
      ctx.strokeStyle=colours[o.side===1?0:1];ctx.fillStyle=ctx.strokeStyle;
      ctx.globalAlpha=active?1:.48;ctx.lineWidth=(active?2:1)*dpr;
      if($('routes').checked && points.length){path(points);ctx.stroke();for(const[i,p]of points.entries()) {const[x,y]=screen(p);ctx.beginPath();ctx.arc(x,y,(active?3:2)*dpr,0,Math.PI*2);ctx.fill();if(active){ctx.font=`${11*dpr}px system-ui`;ctx.fillText(String(i+1),x+5*dpr,y-5*dpr);}}}
      const p=origin(o);if(!p)continue;const[x,y]=screen(p);ctx.beginPath();
      if(o.type==='aircraft'){ctx.moveTo(x,y-8*dpr);ctx.lineTo(x-6*dpr,y+5*dpr);ctx.lineTo(x,y+2*dpr);ctx.lineTo(x+6*dpr,y+5*dpr);ctx.closePath();}
      else ctx.rect(x-3*dpr,y-3*dpr,6*dpr,6*dpr);ctx.fill();
      if(active){ctx.globalAlpha=1;ctx.strokeStyle='#fff9df';ctx.lineWidth=1.5*dpr;ctx.beginPath();ctx.arc(x,y,12*dpr,0,Math.PI*2);ctx.stroke();}
    }
    ctx.globalAlpha=1;
    const km=span>500000?100:span>200000?50:span>80000?20:span>30000?10:2;
    const x=22*dpr,y=canvas.height-24*dpr,len=km*1000*canvas.width/span;
    ctx.strokeStyle='#f5f0d9';ctx.fillStyle='#f5f0d9';ctx.lineWidth=2*dpr;ctx.beginPath();ctx.moveTo(x,y-5*dpr);ctx.lineTo(x,y);ctx.lineTo(x+len,y);ctx.lineTo(x+len,y-5*dpr);ctx.stroke();ctx.font=`${12*dpr}px system-ui`;ctx.fillText(`${km} km`,x,y-10*dpr);ctx.fillText('N ↑',canvas.width-48*dpr,27*dpr);
    canvas.dataset.ready='true';dirty=false;
  }
  function actor(index) {
    selected=index;$('actor').value=String(index);
    const o=mission.objects[index];$('route-details').replaceChildren();
    if(!o)return;
    const p=document.createElement('p');p.className='help';p.textContent=o.type==='aircraft'?`${o.wing_size} aircraft · ${o.sortie} · ${o.skill_names?.[0]||''}`:'Initial placement in the mission.';$('route-details').append(p);
    if(o.route?.length){const table=document.createElement('table');const head=document.createElement('tr');for(const name of ['Point','Action','Altitude']){const th=document.createElement('th');th.scope='col';th.textContent=name;head.append(th);}const thead=document.createElement('thead');thead.append(head);table.append(thead);const body=document.createElement('tbody');o.route.forEach((w,i)=>{const tr=document.createElement('tr');for(const text of [i+1,w.action,`${Math.round(w.position[1]/32).toLocaleString()} m`]){const td=document.createElement('td');td.textContent=text;tr.append(td);}body.append(tr);});table.append(body);$('route-details').append(table);}
    dirty=true;
  }
  function fit() {
    const points=mission.objects.flatMap(o=>(o.route?.length?o.route.map(w=>position(w.position)):[origin(o)]).filter(Boolean));
    if(!points.length){centre=[65000,45000];span=330000;dirty=true;return;}
    const low=[0,1].map(i=>Math.min(...points.map(p=>p[i]))),high=[0,1].map(i=>Math.max(...points.map(p=>p[i])));
    centre=low.map((v,i)=>(v+high[i])/2);span=Math.max(70000,(high[0]-low[0])*1.4,(high[1]-low[1])*canvas.clientWidth/canvas.clientHeight*1.4);dirty=true;
  }
  function choose(id) {
    mission=missions.find(m=>m.id===id)||missions[0];$('mission').value=mission.id;history.replaceState(null,'','#'+mission.id);
    $('mission-title').textContent=mission.title;$('briefing').textContent=mission.briefing.replace(/\r\n?/g,'\n');$('actor').replaceChildren();
    mission.objects.forEach((o,i)=>$('actor').add(new Option(label(o,i),i)));
    actor(Math.max(0,mission.objects.findIndex(o=>o.type==='aircraft')));fit();
  }
  for(const m of missions)$('mission').add(new Option(m.title,m.id));
  $('mission').onchange=()=>choose($('mission').value);$('actor').onchange=()=>actor(Number($('actor').value));$('routes').onchange=()=>dirty=true;
  $('fit-route').onclick=fit;$('whole-map').onclick=()=>{centre=[65000,45000];span=330000;dirty=true;};
  const zoom=amount=>{span=Math.max(10000,Math.min(1600000,span*amount));dirty=true;};
  $('zoom-in').onclick=()=>zoom(.75);$('zoom-out').onclick=()=>zoom(1/.75);
  canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);};
  canvas.onpointermove=e=>{if(!drag)return;const k=span/canvas.clientWidth;centre[0]-=(e.clientX-drag.x)*k;centre[1]+=(e.clientY-drag.y)*k;drag.moved ||= Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>4;drag.x=e.clientX;drag.y=e.clientY;dirty=true;};
  canvas.onpointerup=e=>{if(drag&&!drag.moved){const p=world(e);let distance=span/canvas.clientWidth*18,index=-1;mission.objects.forEach((o,i)=>{const q=origin(o);if(q){const d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<distance){distance=d;index=i;}}});if(index>=0)actor(index);}drag=null;canvas.releasePointerCapture(e.pointerId);};
  canvas.onpointercancel=()=>drag=null;
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(e.deltaY*.001));},{passive:false});
  canvas.onkeydown=e=>{const keys={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};if(keys[e.key]){e.preventDefault();centre=centre.map((v,i)=>v+keys[e.key][i]*span*.08);dirty=true;}else if(e.key==='+'||e.key==='-'){e.preventDefault();zoom(e.key==='+'?.8:1.25);}};
  new ResizeObserver(()=>dirty=true).observe(canvas);
  choose(location.hash.slice(1));
  window.addEventListener('hashchange',()=>choose(location.hash.slice(1)));
  function tick(){if(dirty&&!document.hidden)draw();requestAnimationFrame(tick);}tick();
  window.flankerMissionMap={choose,get mission(){return mission.id},get selected(){return selected}};
} catch(error){$('map-status').textContent=`The map could not load: ${error.message}. The article and source notes are still available.`;}
