// Q14 model transforms. The numeric reference is tools/shape_transforms.py;
// tools/verify_shape_code.py compares that port with the original PE routines.
export const i16=v=>((v+32768)&65535)-32768;
export const identity=()=>({basis:[[16384,0,0],[0,16384,0],[0,0,16384]],translation:[0,0,0],flags:0});
export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const sub=(a,b)=>a.map((v,i)=>v-b[i]);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const normalise=a=>{let l=Math.hypot(...a)||1;return a.map(v=>v/l)};
export const direction=(b,v)=>[0,1,2].map(i=>dot(b.map(c=>c[i]),v)/16384);
export const point=(m,v)=>direction(m.basis,v).map((q,i)=>q+m.translation[i]);
export function sine(a,t){a=i16(a);let f=a;if(f&4096)f=-f+8192;let i=(f&8176)>>4;let v=t[i]+(((t[Math.min(i+1,t.length-1)]-t[i])*(f&15))>>4);return a&8192?-v:v}
function muldiv(a,b,c){return Math.trunc(Math.imul(a,b)/c)}
function rotate(b,axis,a,t){let s=sine(a,t),c=sine(a+4096,t),[i,j]=[[1,2],[2,0],[0,1]][axis],u=b[i].slice(),v=b[j].slice();for(let k=0;k<3;k++){b[i][k]=i16((u[k]*c>>14)+(v[k]*s>>14));b[j][k]=i16((v[k]*c>>14)-(u[k]*s>>14))}}
function translate(m,v){for(let i=0;i<3;i++)m.translation[i]=(m.translation[i]+Math.floor(dot(m.basis.map(c=>c[i]),v)/16384))|0}
function curve(c,p,g){let v=(c.global_parameter?g:p)[c.parameter]||0,q=c.pairs;if(q.length===1)return muldiv(v,q[0][1],q[0][0]);if(!q.length||v<q[0][0]||v>q.at(-1)[0])return null;for(let [x,y]of q)if(x===v)return y;for(let i=1;i<q.length;i++){let[x0,y0]=q[i-1],[x1,y1]=q[i];if(v>x0&&v<x1)return y0+muldiv(v-x0,y1-y0,x1-x0)}return null}
export function transform(s,shift,p,g,t,parent=identity(),rng=()=>0){let m={basis:parent.basis.map(v=>v.slice()),translation:parent.translation.slice(),flags:parent.flags,parameters:p};let c=s.condition;if(c){let v=(c&32768?g:p)[(c&112)>>4]||0;if(!(c&128))v=~v;if(v&(1<<(((c&15)-1)&31)))return null}translate(m,s.translation.map(v=>v<<shift));let value=0;for(let c of s.commands){let mode=c.mode,a=c.argument,op=c.opcode;if(!mode)value=a;else if(mode===256)value=(c.global_parameter?g:p)[c.parameter]||0;else if(mode===512){value=curve(c.curve,p,g);if(value===null)return null}else if(mode===768)value=rng(a);else if(mode===1024)p=p.slice(a&63);if(c.negate)value=-value;if([10,18,26].includes(op))rotate(m.basis,(op-10)/8,value,t);else if([11,19,27].includes(op))rotate(m.basis,(op-11)/8,4096,t);else if([12,20,28].includes(op))rotate(m.basis,(op-12)/8,-4096,t);else if([9,17,25].includes(op)){let d=[0,0,0];d[(op-9)/8]=value<<shift;translate(m,d)}else if([5,13,21,29].includes(op)){for(let i of op===5?[0,1,2]:[(op-13)/8])m.basis[i]=m.basis[i].map(v=>i16(Math.imul(v,value)>>14))}else if(![0,6].includes(op))return null;let mirror=c.mirror;if(op===6&&!(m.flags&16))mirror=0;for(let i=0;i<3;i++)if(mirror&(1<<i)){m.flags^=16;m.basis[i]=m.basis[i].map(v=>i16(-v))}}m.parameters=p;return m}
export function random(seed = 1) {
  function sample(limit) {
    sample.state = (Math.imul(sample.state, 0x015a4e35) + 1) >>> 0;
    return Math.imul((sample.state >>> 16) & 32767, limit) >> 15;
  }
  sample.state = seed;
  return sample;
}

// The country artwork is shared with aircraft decals. On a ship with a cloth
// face, fit its painted outline to the four corners of that particular flag.
const flagLayouts = new WeakMap();
export function flagOnCloth(node, corners) {
  let layout = flagLayouts.get(node);
  if (!layout) {
    const edges = node.surfaces.flatMap(face => face.indices.map((id, i, ids) =>
      [node.vertices[id], node.vertices[ids[(i + 1) % ids.length]]]));
    const rows = new Map(node.vertices.map(([, y]) => [y, null]));
    const top = Math.max(...rows.keys()), bottom = Math.min(...rows.keys());
    for (const y of rows.keys()) {
      // Include edges crossing this row. The Turkish emblem has many rows
      // of interior vertices between the corners of its red field.
      const xs = [];
      for (const [[ax, ay], [bx, by]] of edges) {
        if (y < Math.min(ay, by) || y > Math.max(ay, by)) continue;
        if (ay === by) xs.push(ax, bx);
        else xs.push(ax + (y - ay) * (bx - ax) / (by - ay));
      }
      rows.set(y, [Math.min(...xs), Math.max(...xs)]);
    }
    layout = node.vertices.map(([x, y]) => {
      const [left, right] = rows.get(y);
      return [(right - x) / (right - left), (top - y) / (top - bottom)];
    });
    flagLayouts.set(node, layout);
  }
  const [topHoist, topFly, bottomFly, bottomHoist] = corners;
  return layout.map(([u, v]) => topHoist.map((_, i) => {
    const top = topHoist[i] + u * (topFly[i] - topHoist[i]);
    const bottom = bottomHoist[i] + u * (bottomFly[i] - bottomHoist[i]);
    return top + v * (bottom - top);
  }));
}
// The stored view-dependent lists also omit surfaces that should not be drawn
// from that side (including coplanar detail). Select in the transformed frame.
export function surfaceOrder(node, pose, eye, count) {
  if (!node.ordering.length) return Array.from({length: count}, (_, i) => i);
  const toEye = sub(eye, pose.translation);
  let best = 0, order = [];
  for (const entry of node.ordering) {
    const score = dot(toEye, direction(pose.basis, entry.normal));
    if (score > best) { best = score; order = entry.surfaces; }
  }
  return order.filter(i => i < count);
}
// Railings can be a single folded polygon. The outline follows the foot
// of the rail, then returns along the same path at a fixed height. Join
// corresponding posts so a bend at the bow cannot put a triangle on deck.
export function patternedTriangles(points) {
  return triangles(points, true);
}
export function triangles(points, patterned = false) {
  const sides = points.length / 2, last = points.length - 1;
  if (Number.isInteger(sides) && sides >= 3) {
    const rise = sub(points[last], points[0]);
    if (dot(rise, rise) > 0 && points.slice(1, sides).every((p, i) =>
      p.every((v, axis) => Math.abs(points[last-i-1][axis] - v - rise[axis]) < 1e-6))) {
      // Keep the existing diagonals on planar shaded faces. Vertex colours
      // interpolate across them. A folded strip needs a separate quad per bay.
      const offsets = points.slice(1, sides).map(p => sub(p, points[0]));
      const normal = offsets.map(v => cross(rise, v)).find(n => Math.hypot(...n) > 1e-6);
      const tolerance = normal ? Math.hypot(...normal) * 1e-6 : 0;
      if (patterned || (normal && offsets.some(v => Math.abs(dot(normal, v)) > tolerance))) {
        const faces = [];
        for (let i = 0; i + 1 < sides; i++)
          faces.push([i, i+1, last-i-1], [i, last-i-1, last-i]);
        return faces;
      }
    }
  }
  return planarTriangles(points);
}
// Ear clipping handles concave silhouettes and lettering. A vertex on an ear
// boundary must block that ear too, or triangulation can cut across a notch.
function planarTriangles(points){if(points.length<3)return[];let n=cross(sub(points[1],points[0]),sub(points[2],points[0])),axis=n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))),axes=[0,1,2].filter(a=>a!==axis),q=points.map(p=>axes.map(a=>p[a]));const area=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);let orientation=Math.sign(q.reduce((s,a,i)=>{let b=q[(i+1)%q.length];return s+a[0]*b[1]-b[0]*a[1]},0))||1,ids=q.map((_,i)=>i),out=[],guard=0;while(ids.length>3&&guard++<points.length**2){let clipped=false;for(let k=0;k<ids.length;k++){let a=ids[(k+ids.length-1)%ids.length],b=ids[k],c=ids[(k+1)%ids.length];if(area(q[a],q[b],q[c])*orientation<=1e-8)continue;if(ids.some(d=>d!==a&&d!==b&&d!==c&&area(q[a],q[b],q[d])*orientation>=-1e-8&&area(q[b],q[c],q[d])*orientation>=-1e-8&&area(q[c],q[a],q[d])*orientation>=-1e-8))continue;out.push([a,b,c]);ids.splice(k,1);clipped=true;break}if(!clipped)break}if(ids.length===3)out.push(ids);if(!out.length)for(let i=1;i+1<points.length;i++)out.push([0,i,i+1]);return out}
