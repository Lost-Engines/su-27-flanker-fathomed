import {createModelBrowser} from './browser.mjs';
import {depthLayers} from './depth.mjs';
import {parameterDefinitions, parameterValue} from './parameter-definitions.mjs';
import {renderParameters} from './parameters.mjs';
import {createMotionControls, restoreMotionCommands} from './motion.mjs';
import{identity,point,direction,dot,sub,cross,normalise,transform,random,triangles,surfaceOrder}from'./shape.mjs';
const $=id=>document.getElementById(id),canvas=$('view'),gl=canvas.getContext('webgl2',{antialias:true,preserveDrawingBuffer:true});
if(!gl)throw new Error('This viewer needs WebGL 2.');
const root=canvas.dataset.modelRoot||'../../extracted/shapes/win_1_5/',catalog=await fetch(root+'viewer.json').then(r=>{if(!r.ok)throw new Error('The model catalogue could not be loaded.');return r.json()}),models=new Map(),pending=new Map();
const shader=(type,src)=>{let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s};
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,`#version 300 es
in vec3 position;in vec3 colour;in float pattern;in float depthBias;in float depthBack;uniform mat4 view;uniform float pointSize;out vec3 c;flat out int p;flat out float backLayers;void main(){gl_Position=view*vec4(position,1.);gl_Position.z-=depthBias*gl_Position.w;gl_PointSize=pointSize;c=colour;p=int(pattern);backLayers=depthBack;}`));
gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`#version 300 es
precision highp float;precision highp int;in vec3 c;flat in int p;flat in float backLayers;uniform int masks[128];uniform bool roundLight;out vec4 pixel;void main(){if(roundLight && distance(gl_PointCoord,vec2(.5))>.5)discard;float slope=max(abs(dFdx(gl_FragCoord.z)),abs(dFdy(gl_FragCoord.z)));if(p>=0){ivec2 q=ivec2(gl_FragCoord.xy);int row=masks[p*8+(q.y&7)];if((row&(128>>(q.x&7)))==0)discard;}gl_FragDepth=gl_FragCoord.z+backLayers*.5*slope;pixel=vec4(c,1.);}`));
gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const pointSize = gl.getUniformLocation(program, 'pointSize'), roundLight = gl.getUniformLocation(program, 'roundLight');
const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(let[name,size,offset]of[['position',3,0],['colour',3,12],['pattern',1,24],['depthBias',1,28],['depthBack',1,32]]){let a=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,36,offset)}
gl.uniform1iv(gl.getUniformLocation(program,'masks'),new Int32Array(catalog.patterns.flat()));gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(.055,.085,.12,1);
let selected,parameters=[],bounds={center:[0,0,0],radius:1000},yaw=.85,pitch=.35,zoom=1,request=0,lastTime=0,dirty=true,rotateDrag=null,stats={},phase=1,lightingTick=0;
const motion = createMotionControls($('motion'), () => { dirty = true; });
const entries = new Map(catalog.models.map(entry => [entry.name, entry]));
// Evening preview (21:30): marker lights and both window/headlight groups are on.
// The original display-pose pass alternates the beacon colour every 16 ticks.
const globalParameters=()=>{
  const values=Array(128).fill(0);
  motion.apply(values);
  if($('night').checked){values[0]=7;values[5]=30;values[6]=31;values[7]=lightingTick&16?8:31;}
  return values;
};
function lightMaterial(value,p,g){
  if(value&32768)value=(value&16384?g:p)[value&16383]||0;
  return catalog.palette[value&15].map(v=>v/255);
}
function material(value,normal,p,g){if(value===65535)return null;if(value&32768)value=(value&16384?g:p)[value&16383]||0;let family=value&31,level=(value&3840)>>4;if((value&16)||!level)return catalog.palette[family%16].map(v=>v/255);let intensity=12800;if(value&16384)intensity+=Math.max(0,dot(normal,normalise([-1,1,0])))*15237;let light=Math.max(0,Math.min(255,Math.trunc(level*intensity/16384)));if(family===14)family=7;else{family&=7;if(family===7)family=0}let index=family?((family+2)*16+(light>>4)):(16+(light>>3));return catalog.palette[index].map(v=>v/255)}
async function loadModel(name){if(models.has(name))return models.get(name);if(!pending.has(name))pending.set(name,fetch(root+name+'.json').then(r=>{if(!r.ok)throw new Error(`Missing shape ${name}`);return r.json()}).then(m=>{restoreMotionCommands(m,catalog.motion_repairs?.[name]);m.lookup=new Map(m.nodes.map(n=>[n.offset,n]));models.set(name,m);pending.delete(name);dirty=true;return m}));return pending.get(name)}
// Painter lists can redraw the same attachment several times. This viewer
// uses a depth buffer, so visit each surface once, at its last
// position, so repeated flag draws cannot get different random poses and put
// one copy's white cloth over another copy's insignia.
function depthSurfaceOrder(node, pose, eye, count) {
  const order=surfaceOrder(node,pose,eye,count), seen=new Set(), unique=[];
  for(let i=order.length-1;i>=0;i--)if(!seen.has(order[i])){seen.add(order[i]);unique.push(order[i])}
  return unique.reverse();
}
function gather(eye){let result=[],missing=new Set(),g=globalParameters(),rng=random($('perturb').checked?phase:1),parts=0,hidden=0,distance=+$('distance').value;function visit(model,offset,m,p,depth,attachmentOverlay=null){if(depth>40){missing.add('cyclic graph');return}let n=model.lookup.get(offset);if(!n){missing.add(`node ${offset}`);return}parts++;let count=n.surfaces.length,flags=6;if(n.lod.length){let eligible=n.lod.filter(l=>l.threshold>distance),l=eligible.at(-1)||((depth===0)?n.lod[0]:null);if(!l)return;count=l.surfaces;flags=l.flags}let vertices=n.vertices.map(v=>point(m,v.map(x=>x*(2**n.coordinate_shift)))),attachmentRule=catalog.attachment_overlays?.[model.name]?.[n.name],overlayHost=attachmentRule?.mesh&&attachmentRule.models.includes(catalog.registry[p[attachmentRule.parameter]]);for(let i of depthSurfaceOrder(n,m,eye,count)){let s=n.surfaces[i];if(s.kind===4&&!(flags&1))continue;if(s.kind<=1&&!(flags&2))continue;if(s.kind===6&&!(g[0]&1))continue;if(s.kind>=16){if(!s.reference)continue;let t=transform(s,n.coordinate_shift,p,g,catalog.sine,m,rng);if(!t){hidden++;continue}if(s.kind===16)visit(model,s.node,t,t.parameters,depth+1,attachmentOverlay);else{let index=s.kind===18?t.parameters[s.reference&255]:s.reference,name=catalog.registry[index];if(!index)continue;if(!name){missing.add(`registry ${index}`);continue}if(models.has(name)){let rule=attachmentRule,support=attachmentOverlay;if(s.kind===18&&rule?.parameter===(s.reference&255)&&rule.models.includes(name)){if(rule.mesh){let normal=normalise(direction(t.basis,rule.normal)),mesh=n.surfaces.slice(0,count).filter(face=>(face.kind===2||(face.kind===4&&(flags&1)))&&face.colour!==65535&&dot(normalise(direction(m.basis,face.normal)),normal)>.5).flatMap(face=>{let indices=face.vertex_normals?face.indices.slice(0,-1):face.indices,points=indices.map(i=>vertices[i]);return triangles(points).map(ids=>ids.map(i=>points[i]))});support={mesh,normal,reach:rule.reach}}else support={plane:n.surfaces[rule.surface].indices.map(i=>vertices[i])}}visit(models.get(name),0,t,s.kind===18?models.get(name).nodes[0].parameters.concat(Array(256).fill(0)):t.parameters,depth+1,support);}else{missing.add(name);loadModel(name).catch(e=>{missing.add(e.message)})}}continue}let indices=s.indices.slice();if(s.vertex_normals)indices.pop();let points=indices.map(i=>vertices[i]);if(!points.length)continue;let supportIndex=catalog.surface_supports?.[model.name]?.[n.name]?.[i],supportSurface=n.surfaces[supportIndex],supportPlane=supportSurface?.indices.map(j=>vertices[j]);let normal=s.normal?normalise(direction(m.basis,s.normal)):points.length>2?normalise(cross(sub(points[1],points[0]),sub(points[2],points[0]))):[0,1,0],back=dot(supportSurface?direction(m.basis,supportSurface.normal):normal,sub(eye,supportPlane?.[0]||points[0]))<0,colour=s.colour;if((s.kind===2||s.kind===4)&&back){colour=s.back_colour;normal=normal.map(v=>-v)}let rgb=s.kind===6?lightMaterial(colour,p,g):material(colour,normal,p,g);if(!rgb)continue;let vertexColours=null;if(s.vertex_normals&&$('smooth').checked&&(flags&4)){vertexColours=indices.map(i=>{let nv=n.vertices[i+1]||s.normal||[0,16384,0],nn=normalise(direction(m.basis,nv));if(back)nn=nn.map(v=>-v);return material(colour,nn,p,g)||rgb})}let overlay=catalog.surface_overlays?.[model.name]?.[n.name];result.push({points,rgb,vertexColours,pointCloud:s.kind===6,overlayHost,overlayMesh:attachmentOverlay?.mesh,overlayPlane:supportPlane||attachmentOverlay?.plane,overlayNormal:attachmentOverlay?.normal||(overlay?normalise(direction(m.basis,overlay.normal)):null),overlayReach:attachmentOverlay?.reach??overlay?.reach,decal:s.kind===3,line:s.kind===0||s.kind===1,closed:s.kind===1,pattern:s.kind===3&&s.pattern_colour!==s.colour?s.pattern%16:-1,edge:s.kind===3?s.edge_colour:65535})}}
visit(selected,0,identity(),parameters,0);stats={parts,hidden,primitives:result.length,missing:[...missing]};return result}
function hasVisibleGeometry(item) {
  const p = item.points;
  if (p.length === 1 || (item.pointCloud && p.length)) return true;
  const offset = p.slice(1).map(v => sub(v, p[0]));
  if (item.line || p.length < 3) return offset.some(v => dot(v, v) > 0);
  const edge = offset.find(v => dot(v, v) > 0);
  return edge && offset.some(v => { const n = cross(edge, v); return dot(n, n) > 0; });
}
function fit() {
  let points = gather([10000,10000,10000]).filter(hasVisibleGeometry).flatMap(i => i.points);
  // Single-sided markings face away from the usual fitting direction.
  if (!points.length) points = gather([-10000,-10000,-10000]).filter(hasVisibleGeometry).flatMap(i => i.points);
  // An empty stage must not replace the previous framing with a unit sphere.
  if (points.length) {
    const lo = [0,1,2].map(i => Math.min(...points.map(p => p[i])));
    const hi = [0,1,2].map(i => Math.max(...points.map(p => p[i])));
    bounds.center = lo.map((v,i) => (v + hi[i]) / 2);
    bounds.radius = Math.max(1, ...points.map(p => Math.hypot(...sub(p, bounds.center))));
  }
  zoom = 1;
  if (canvas.hasAttribute('data-fit-silhouette') && points.length) {
    const forward = normalise([Math.cos(pitch)*Math.cos(yaw), Math.sin(pitch), Math.cos(pitch)*Math.sin(yaw)]);
    const right = normalise(cross([0,1,0], forward)), up = cross(forward, right);
    const aspect = canvas.clientWidth / canvas.clientHeight || 1;
    const extent = Math.max(1, ...points.map(p => Math.max(Math.abs(dot(right, sub(p,bounds.center))) / aspect, Math.abs(dot(up, sub(p,bounds.center))))));
    zoom = Math.min(1.7, bounds.radius / (extent * Math.min(1,aspect)));
  }
  dirty = true;
}
function modelParameters(preview = false) {
  const result = selected.nodes[0].parameters.concat(Array(256).fill(0));
  if (preview) for (const [id, value] of Object.entries(parameterDefinitions(selected,catalog).preview?.parameters || {})) result[id] = value;
  return result;
}
function parametersChanged() {
  if (parameterDefinitions(selected,catalog).preview?.fit_on_change && $('fit-effect').checked) fit();
  dirty = true;
}
// Preserve authored ordering between overlapping coplanar fills, including
// solid decals. A small forward bias separates each layer; slope-dependent
// separation pushes earlier fills back at shallow angles. Real foreground
// geometry still occludes the detail, and line work stays above the fills.
function geometry(items){let tris=[],decals=[],lines=[],points=[],lights=[];let layer=0,back=0,put=(target,p,c,pat=-1)=>target.push(...p,...c,pat,layer*4e-5,back);for(let item of depthLayers(items)){layer=item.layer;back=item.backLayers||0;let{points:p,rgb:c,pattern:pat,vertexColours:vc}=item;if(item.pointCloud){for(const q of p)put(lights,q,c);continue}if(item.line||p.length<3){if(p.length===1)put(points,p[0],c);for(let i=1;i<p.length;i++){put(lines,p[i-1],c);put(lines,p[i],c)}if(item.closed&&p.length>2){put(lines,p.at(-1),c);put(lines,p[0],c)}continue}for(let ids of triangles(p))for(let i of ids)put(item.decal?decals:tris,p[i],vc?vc[i]:c,pat);if($('edges').checked||item.edge!==65535){back=0;layer=item.layer+1;let e=$('edges').checked?c.map(v=>v*.45):material(item.edge,[0,1,0],parameters,globalParameters());if(e)for(let i=0;i<p.length;i++){put(lines,p[i],e);put(lines,p[(i+1)%p.length],e)}}}return{tris,decals,lines,points,lights}}
function render(){let dpr=devicePixelRatio||1,w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!selected)return;let forward=normalise([Math.cos(pitch)*Math.cos(yaw),Math.sin(pitch),Math.cos(pitch)*Math.sin(yaw)]),right=normalise(cross([0,1,0],forward)),up=cross(forward,right),aspect=w/h,r=bounds.radius*1.15/(zoom*Math.min(1,aspect)),sx=1/(r*aspect),sy=1/r,sz=-1/(bounds.radius*8),c=bounds.center,eye=c.map((v,i)=>v+forward[i]*bounds.radius*8);gl.uniformMatrix4fv(gl.getUniformLocation(program,'view'),false,new Float32Array([right[0]*sx,up[0]*sy,forward[0]*sz,0,right[1]*sx,up[1]*sy,forward[1]*sz,0,right[2]*sx,up[2]*sy,forward[2]*sz,0,-dot(right,c)*sx,-dot(up,c)*sy,-dot(forward,c)*sz,1]));const items=gather(eye),data=geometry(items);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  gl.uniform1f(pointSize, Math.max(2, 2*dpr));
  gl.uniform1i(roundLight, 0);
  for (const [name,mode] of [['tris',gl.TRIANGLES],['decals',gl.TRIANGLES],['lines',gl.LINES],['points',gl.POINTS],['lights',gl.POINTS]]) {
    if (!data[name].length) continue;
    if (name === 'lights') {
      const diameter = Math.max(5, Math.min(12, Math.min(canvas.clientWidth,canvas.clientHeight)*zoom/90));
      gl.uniform1f(pointSize, diameter*dpr);
      gl.uniform1i(roundLight, 1);
    }
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data[name]),gl.DYNAMIC_DRAW);
    gl.drawArrays(mode,0,data[name].length/9);
  }
  const empty=!items.some(hasVisibleGeometry);
  const messages=[];
  if (empty) messages.push(catalog.parameter_controls?.[selected.name]?.preview ? 'No visible geometry at this age' : 'This shape has no visible geometry in this view');
  if ($('details')) messages.push(stats.parts+' parts',stats.primitives+' primitives',stats.hidden+' conditional parts hidden');
  if (stats.missing.length) messages.push('Unavailable: '+stats.missing.join(', '));
  $('status').textContent=messages.join(' · ');canvas.dataset.ready='true'}
function controls(){renderParameters($('params'),parameterDefinitions(selected,catalog),parameters,parametersChanged)}
async function select(name){let token=++request;try{let m=await loadModel(name);if(token!==request)return;selected=m;motion.select(name,entries.get(name)?.motion_clocks);parameters=modelParameters(true);bounds={center:[0,0,0],radius:100};$('effect-framing').hidden=!parameterDefinitions(selected,catalog).preview?.fit_on_change;$('title').textContent=`${catalog.models.find(e=>e.name===name)?.display_name||m.nodes[0].name} · ${name}`;if($('details'))$('details').textContent=`${m.size.toLocaleString()} bytes · ${m.nodes.length} distinct shape nodes\n${m.nodes.map(n=>n.name).join(' · ')}\n\n${m.warnings.join('\n')||'All decoded references are within their tables.'}`;history.replaceState(null,'','#'+name);browser.select(name);if($('model-description'))$('model-description').textContent=entries.get(name)?.hint||'';let entry=catalog.models.find(e=>e.name===name),group=catalog.categories.find(g=>g.id===entry?.category);if(entry&&$('details'))$('details').textContent+=`\n\nGroup: ${group?.label}\n${entry.display_name}\nClassification: ${entry.classification_source}`;controls();fit();dirty=true}catch(e){$('status').className='status error';$('status').textContent=e.message;throw e}}
const browser=createModelBrowser(catalog,select,root);
$('reset').onclick=()=>{yaw=.85;pitch=.35;fit()};$('defaults').onclick=()=>{parameters=modelParameters(canvas.hasAttribute('data-preview-defaults'));motion.select(selected.name,entries.get(selected.name)?.motion_clocks);controls();parametersChanged()};$('fit-effect').onchange=()=>{if($('fit-effect').checked)parametersChanged()};for(let id of['edges','smooth','distance','night','perturb'])$(id).oninput=()=>dirty=true;
canvas.onpointerdown=e=>{rotateDrag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)};canvas.onpointerup=e=>{rotateDrag=null;canvas.releasePointerCapture(e.pointerId)};canvas.onpointercancel=()=>rotateDrag=null;canvas.onpointermove=e=>{if(!rotateDrag)return;yaw+=(e.clientX-rotateDrag.x)*.008;pitch=Math.max(-1.5,Math.min(1.5,pitch+(e.clientY-rotateDrag.y)*.008));rotateDrag={x:e.clientX,y:e.clientY};dirty=true};canvas.onwheel=e=>{e.preventDefault();zoom=Math.max(.15,Math.min(20,zoom*Math.exp(-e.deltaY*.001)));dirty=true};new ResizeObserver(()=>dirty=true).observe(canvas);
function tick(time){if(motion.advance(time))dirty=true;if(document.hidden){lastTime=time;requestAnimationFrame(tick);return}let dt=Math.min(.05,(time-lastTime)/1000);lastTime=time;const lightTick=Math.floor(time*16/1000);if($('night').checked&&((lightTick^lightingTick)&16))dirty=true;lightingTick=lightTick;if($('spin').checked){yaw+=dt*.25;dirty=true}if($('perturb').checked&&Math.floor(time/100)!==phase){phase=Math.floor(time/100);dirty=true}if(dirty){render();dirty=false}requestAnimationFrame(tick)}await select(entries.has(location.hash.slice(1))?location.hash.slice(1):'su27');requestAnimationFrame(tick);
// Local automated checks and captures; controls use the same validation as the UI.
window.flankerModelViewer={select,get camera(){return {yaw,pitch,zoom}},setCamera(y,p,z=1){yaw=y;pitch=p;zoom=z;dirty=true},get stats(){return stats},get selected(){return selected?.name},get parameters(){return parameters.slice(0,selected?.nodes[0].parameters.length||0)},get controlDefinitions(){return parameterDefinitions(selected,catalog)},setParameter(id,value){let d=parameterDefinitions(selected,catalog).controls.find(d=>d.id===id);if(!d)return false;let v=parameterValue(d,value);if(v===null)return false;parameters[id]=v;controls();parametersChanged();return true}};
