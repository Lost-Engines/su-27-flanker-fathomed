import {cross, dot, sub, normalise, triangles} from './shape.mjs';

function plane(points) {
  if (points.length < 3) return null;
  for (let i = 1; i + 1 < points.length; i++) {
    let n = cross(sub(points[i], points[0]), sub(points[i + 1], points[0]));
    if (Math.hypot(...n) < 1e-8) continue;
    n = normalise(n);
    const axis = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs)));
    if (n[axis] < 0) n = n.map(v => -v);
    const d = dot(n, points[0]);
    if (points.some(p => Math.abs(dot(n, p) - d) > 1e-4)) return null;
    return {n, d, axes: [0, 1, 2].filter(i => i !== axis), key: [...n, d].map(v => Math.round(v * 1e5)).join(',')};
  }
  return null;
}
function bounds(points, axes) { return axes.map(i => [Math.min(...points.map(p => p[i])), Math.max(...points.map(p => p[i]))]); }
function overlaps(a, b) { return a.every(([lo, hi], i) => Math.min(hi, b[i][1]) - Math.max(lo, b[i][0]) > 1e-5); }
// Bounds alone overlap even for adjacent pieces of a letter. Only separate
// surfaces that share area: moving those disjoint pieces backwards can bury
// them in a supporting hull triangle that lies on a slightly different plane.
function surfaceOverlap(a, b) {
  if (!overlaps(a.box, b.box)) return false;
  return a.triangles.some(t => b.triangles.some(u => {
    for (const shape of [t, u]) for (let i = 0; i < 3; i++) {
      const p = shape[i], q = shape[(i + 1) % 3], n = [p[1] - q[1], q[0] - p[0]];
      const length = Math.hypot(...n);
      if (length < 1e-8) continue;
      const project = r => (r[0] * n[0] + r[1] * n[1]) / length;
      const x = t.map(project), y = u.map(project);
      if (Math.min(Math.max(...x), Math.max(...y)) - Math.max(Math.min(...x), Math.min(...y)) <= 1e-5) return false;
    }
    return true;
  }));
}
function insideTriangle(p, a, b, c) {
  const u = sub(b, a), v = sub(c, a), w = sub(p, a);
  const uu = dot(u, u), uv = dot(u, v), vv = dot(v, v), wu = dot(w, u), wv = dot(w, v);
  const den = uu * vv - uv * uv;
  if (Math.abs(den) < 1e-8) return false;
  const x = (wu * vv - wv * uv) / den, y = (wv * uu - wu * uv) / den;
  return x >= -1e-6 && y >= -1e-6 && x + y <= 1 + 1e-6;
}

// The flat MOSKWA lettering intersects the sloping hull in the source model.
// The original painter draws it over the hull. For depth testing, conform only
// this documented overlay to nearby, earlier hull faces; keep real occluders.
function conformOverlay(item, supports) {
  // Coarse-LOD lettering uses polylines, which cannot be polygon-clipped.
  if (item.line || item.pointCloud || item.points.length < 3) {
    return [{...item, decal: true, points: item.points.map(p => {
      let best = p, distance = Infinity;
      for (const support of supports) {
        const den = dot(support.plane.n, item.overlayNormal);
        if (Math.abs(den) < .9) continue;
        const t = (support.plane.d - dot(support.plane.n, p)) / den;
        if (Math.abs(t) > item.overlayReach || Math.abs(t) >= distance) continue;
        const q = p.map((x, i) => x + t * item.overlayNormal[i]);
        if (insideTriangle(q, ...support.points)) { best = q; distance = Math.abs(t); }
      }
      return best;
    })}];
  }
  // A letter can cross the seam between hull triangles. Clip and project each
  // piece separately so the GPU cannot interpolate a chord through the hull.
  return meshOverlay({...item, overlayMesh: supports
    .filter(s => Math.abs(dot(s.plane.n, item.overlayNormal)) >= .9)
    .map(s => s.points)});
}

// Keep the triangles used by the wall itself, including the Windows meshes
// whose vertex-normal records repeat the last index.
export function bindSurfaceDetails(node, markings) {
  for (const [index, wallIds] of Object.entries(markings)) {
    const walls = wallIds.map(i => node.surfaces[i]);
    const mesh = walls.flatMap(wall => {
      wall.carriesDetail = true;
      const ids = wall.vertex_normals ? wall.indices.slice(0, -1) : wall.indices;
      return triangles(ids.map(i => node.vertices[i])).map(face => face.map(j => ids[j]));
    });
    node.surfaces[index].wallSupport = {mesh, normal: walls[0].normal};
  }
}

// Clip an attached marking against the supporting mesh in its own projection
// plane, then place each fragment on its support triangle. Moving only the
// original corners would leave chords buried inside a curved fuselage.
function meshOverlay(item) {
  const direction = item.overlayNormal;
  const axis = direction.map(Math.abs).indexOf(Math.min(...direction.map(Math.abs)));
  const unit = [0, 0, 0]; unit[axis] = 1;
  const u = normalise(cross(direction, unit)), v = cross(direction, u);
  const project = p => [dot(u, p), dot(v, p)];
  const side = (p, a, b) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const result = [], line = item.line;
  // Clip each length of a door outline separately. Joining just its projected
  // corners would cut through the wall where the line crosses a triangle seam.
  const pieces = line
    ? item.points.slice(0, item.closed ? item.points.length : -1).map((p, i) => [p, item.points[(i + 1) % item.points.length]])
    : triangles(item.points).map(ids => ids.map(i => item.points[i]));
  for (const support of item.overlayMesh) {
    const surface = plane(support);
    if (!surface) continue;
    const den = dot(surface.n, direction);
    if (Math.abs(den) < .5) continue;
    const border = support.map(project), sign = Math.sign(side(border[2], border[0], border[1]));
    for (const piece of pieces) {
      let points = piece;
      for (let edge = 0; edge < 3 && points.length; edge++) {
        const a = border[edge], b = border[(edge + 1) % 3], clipped = [];
        for (let i = 0; i < points.length; i++) {
          const p = points[i], dp = side(project(p), a, b) * sign;
          if (dp >= -1e-7) clipped.push(p);
          if (line && i === points.length - 1) break;
          const q = points[(i + 1) % points.length], dq = side(project(q), a, b) * sign;
          if ((dp < -1e-7) !== (dq < -1e-7)) {
            const t = dp / (dp - dq);
            clipped.push(p.map((x, k) => x + t * (q[k] - x)));
          }
        }
        points = clipped;
      }
      const visible = line ? points.length === 2 && Math.hypot(...sub(points[1], points[0])) > 1e-7 : plane(points);
      if (!visible) continue;
      const distances = points.map(p => (surface.d - dot(surface.n, p)) / den);
      if (distances.some(t => Math.abs(t) > item.overlayReach)) continue;
      result.push({...item, decal: true, closed: false, overlayNormal: null, overlayMesh: null, overlayPlane: support,
        points: points.map((p, i) => p.map((x, k) => x + distances[i] * direction[k]))});
    }
  }
  return result;
}

export function depthLayers(items) {
  items = items.flatMap(item => item.overlayMesh ? meshOverlay(item) : item.overlayHost && !item.line && !item.pointCloud && item.points.length >= 3
    ? triangles(item.points).map(ids => ({...item, points: ids.map(i => item.points[i]),
        vertexColours: item.vertexColours && ids.map(i => item.vertexColours[i])})) : [item]);
  const planes = new Map(), supports = [], linedTriangles = [], prepared = [], result = [];
  const needsSupport = items.some(item => item.overlayNormal);
  let maximum = 0;
  for (const original of items) {
    for (let item of original.overlayNormal ? conformOverlay(original, supports) : [original]) {
      // Give fitted ship flags and car windscreens the same depth plane as
      // their support before assigning the draw layers.
      const attachmentPlane = item.overlayPlane && plane(item.overlayPlane);
      if (attachmentPlane) {
        if (item.line) linedTriangles.push(item.overlayPlane);
        const {n, d} = attachmentPlane;
        item = {...item, decal: true, points: item.points.map(p => {
          const offset = d - dot(n, p);
          return p.map((v, i) => v + offset * n[i]);
        })};
      }
      const p = attachmentPlane || plane(item.points);
      // A rounded hull face may itself be slightly non-planar. Use the same
      // triangles as the GPU, rather than rejecting the entire support face.
      if (needsSupport && !item.line && !item.pointCloud && !item.overlayNormal && !item.decal) {
        for (const ids of triangles(item.points)) {
          const points = ids.map(i => item.points[i]), support = plane(points);
          if (support) supports.push({plane: support, points});
        }
      }
      prepared.push({item, p});
    }
  }
  // Match geometry()'s draw order: solids first, then explicit overlays. The
  // source traversal can visit a marking before a later coplanar hull face.
  // Giving that hull a higher layer would hide the marking despite drawing it
  // last. Conforming above still uses the original support traversal order.
  prepared.sort((a, b) => Number(!!a.item.decal) - Number(!!b.item.decal));
  for (const {item, p} of prepared) {
    let layer = item.decal ? 1 : 0;
    // A line and its wall can sample different positions within one pixel
    // under MSAA. Give the touched wall triangles one pixel of depth slope.
    const lined = item.overlayHost && linedTriangles.some(tri => tri.every(v => item.points.includes(v)));
    const entry = {...item, layer, backLayers: lined ? 2 : 0};
    if (p && !item.line && !item.pointCloud) {
      const box = bounds(item.points, p.axes), group = planes.get(p.key) || [];
      const surface = {box, item: entry, triangles: triangles(item.points).map(ids => ids.map(i => p.axes.map(a => item.points[i][a])))};
      for (const previous of group) if (surfaceOverlap(surface, previous)) layer = Math.max(layer, previous.item.layer + 1);
      entry.layer = layer;
      group.push(surface); planes.set(p.key, group);
    }
    maximum = Math.max(maximum, layer);
    result.push(entry);
  }
  // Rasterisation snaps projected vertices to a subpixel grid. At shallow
  // angles, differently triangulated coplanar fills can then disagree in
  // depth by more than a constant bias. Offset only beneath overlapping
  // detail; unrelated polygons on the same infinite plane must not push a
  // marking back into its support.
  for (const group of planes.values()) for (const entry of group) {
    for (const other of group) if (other.item.layer > entry.item.layer && surfaceOverlap(entry, other))
      entry.item.backLayers = Math.max(entry.item.backLayers, other.item.layer - entry.item.layer);
  }
  // Lines already render last. Give their coplanar edges enough separation to
  // remain above layered fills, while retaining depth tests against geometry.
  for (const item of result) if (item.line || item.pointCloud || item.points.length < 3) item.layer = maximum + 1;
  return result;
}
