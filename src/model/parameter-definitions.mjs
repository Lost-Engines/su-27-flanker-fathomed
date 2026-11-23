// Model-specific meanings live in the generated catalogue. Unlabelled models
// retain curve-derived controls; a one-point curve is a signed linear scale.
export function parameterDefinitions(model, catalog) {
  const known = catalog.parameter_controls?.[/^su27-\d+$/.test(model.name) ? 'su27' : model.name];
  if (known && !known.partial) return known;
  const refs = new Map();
  function add(id, min, max) {
    const old = refs.get(id);
    refs.set(id, {id, label: `Parameter ${id}`, kind: 'range',
      min: Math.min(old?.min ?? 0, min), max: Math.max(old?.max ?? 0, max)});
  }
  const nodes = new Map(model.nodes.map(n => [n.offset, n])), visited = new Set();
  function visit(offset, base = 0, depth = 0) {
    if (depth > 40 || visited.has(`${offset}:${base}`)) return;
    visited.add(`${offset}:${base}`);
    const node = nodes.get(offset);
    if (!node) return;
    for (const surface of node.surfaces) {
      let childBase = base;
      if (surface.condition && !(surface.condition & 32768)) add(base + ((surface.condition & 112) >> 4), 0, 65535);
      for (const command of surface.commands || []) {
        if (command.mode === 1024) childBase += command.argument & 63;
        if (command.mode === 256 && !command.global_parameter) add(childBase + command.parameter, -16384, 16384);
        if (command.curve && !command.curve.global_parameter) {
          const {parameter, pairs} = command.curve;
          if (pairs.length === 1) add(childBase + parameter, -16384, 16384);
          else add(childBase + parameter, Math.min(0, ...pairs.map(p => p[0])), Math.max(16384, ...pairs.map(p => p[0])));
        }
      }
      if (surface.kind === 18) add(childBase + (surface.reference & 255), 0, Math.max(...Object.keys(catalog.registry).map(Number)));
      if (surface.kind === 16) visit(surface.node, childBase, depth + 1);
    }
  }
  visit(0);
  // A partly identified model still exposes all of its discovered parameters.
  const overrides = new Map((known?.controls || []).map(d => [d.id, d]));
  return {...known, controls: [...refs.values()].sort((a, b) => a.id - b.id)
      .map(d => ({...d, ...overrides.get(d.id)})),
    note: known?.note || (refs.size ? 'Unlabelled controls use the stored model curves.' : '')};
}

export function parameterValue(definition, value) {
  value = Math.trunc(Number(value));
  if (!Number.isFinite(value)) return null;
  if (definition.kind === 'select') return definition.options.some(o => o.value === value) ? value : null;
  return Math.max(definition.raw_min ?? definition.min, Math.min(definition.raw_max ?? definition.max, value));
}
