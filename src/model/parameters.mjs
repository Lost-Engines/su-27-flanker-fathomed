// The exhibit catalogue contains only identified, selected controls.
export function parameterDefinitions(model, catalog) {
  return catalog.parameter_controls[model.name] || {controls: []};
}
export function parameterValue(d, value) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return null;
  if (d.kind === 'select') return d.options.some(o => o.value === n) ? n : null;
  return Math.max(d.min, Math.min(d.max, n));
}
function readout(d, value) {
  if (d.id === 17) return `Mach ${(value / 4096).toFixed(2)}`;
  if (d.angle) return `${Math.round(value * 360 / 16384)}°`;
  if (d.ticks_per_second) return `Stage ${value}`;
  if (d.id === 13) return value <= 4096 ? 'Off' : `${Math.round((value - 4096) / (d.max - 4096) * 100)}%`;
  if (d.min === 0 && d.max === 16384) return `${Math.round(value / 16384 * 100)}%`;
  return String(value);
}
export function renderParameters(box, schema, parameters, changed) {
  box.replaceChildren();
  for (const d of schema.controls) {
    const row = document.createElement('div'); row.className = 'model-parameter'; row.dataset.parameter = d.id;
    if (d.kind === 'bits') {
      const fieldset = document.createElement('fieldset'), legend = document.createElement('legend');
      legend.textContent = d.label; fieldset.append(legend);
      for (const bit of d.bits) {
        const label = document.createElement('label'), input = document.createElement('input');
        input.type = 'checkbox'; input.checked = Boolean(parameters[d.id] & bit.value); input.dataset.bit = bit.value;
        input.onchange = () => { parameters[d.id] = input.checked ? parameters[d.id] | bit.value : parameters[d.id] & ~bit.value; changed(); };
        label.append(input, document.createTextNode(bit.label)); fieldset.append(label);
      }
      row.append(fieldset);
    } else {
      const label = document.createElement('label'); label.textContent = d.label; label.htmlFor = `parameter-${d.id}`;
      const input = document.createElement(d.kind === 'select' ? 'select' : 'input'); input.id = label.htmlFor;
      const output = document.createElement('output'); output.htmlFor = input.id;
      if (d.kind === 'select') for (const option of d.options) input.add(new Option(option.label, option.value));
      else { input.type = 'range'; input.min = d.min; input.max = d.max; input.step = 1; }
      const value = parameters[d.id] || 0;
      input.value = d.kind === 'select' ? value : Math.max(d.min, Math.min(d.max, value));
      output.textContent = readout(d, value);
      input.oninput = () => { const n = parameterValue(d, input.value); if (n !== null) {parameters[d.id] = n; output.textContent = readout(d, n); changed();} };
      row.append(label, input); if (d.kind !== 'select') row.append(output);
    }
    box.append(row);
  }
  if (!schema.controls.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'This exhibit has no animation controls. Drag the model to inspect its shape.'; box.append(p); }
}
