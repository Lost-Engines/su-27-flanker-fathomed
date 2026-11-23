// The display-pose pass (FSIM 0x438b6d) drives four model angles at 16 Hz.
const clocks = {
  1: {label: 'Rotation 1', rate: -204, min: 0, max: 16383},
  2: {label: 'Rotation 2', rate: -341, min: 0, max: 16383},
  3: {label: 'Oscillation', half: 48, min: -2048, max: 2048},
  4: {label: 'Tilt', half: 24, min: 0, max: 2048},
};

function angle(clock, tick, offset) {
  if (clock.rate) return (tick * clock.rate + offset) << 16 >> 16;
  const period = clock.half * 2;
  const phase = ((tick + offset) % period + period) % period;
  return clock.min + Math.floor(Math.min(phase, period - phase) * (clock.max - clock.min) / clock.half);
}

export function restoreMotionCommands(model, repairs) {
  if (!repairs?.length) return;
  const surfaces = new Map(model.nodes.flatMap(n => n.surfaces.map(s => [s.offset, s])));
  for (const {surface, index, word} of repairs) {
    const c = surfaces.get(surface).commands[index];
    Object.assign(c, {word, mode: 256, global_parameter: true, parameter: c.argument & 63, negate: Boolean(word & 32768)});
  }
}

// Some meshes also use a flags word directly as a rotation angle.
export function wordAngleControl(name, onAngle) {
  const label = document.createElement('label'), input = document.createElement('input');
  const output = document.createElement('output');
  input.type = 'range';
  input.min = 0;
  input.max = 16383;
  input.setAttribute('aria-label', name);
  input.oninput = () => onAngle(Number(input.value));
  label.append(name, input, output);
  return {label, sync(word) {
    const angle = word & 16383;
    input.value = angle;
    output.value = Math.round(angle * 360 / 16384) + '°';
  }};
}

export function createMotionControls(box, changed) {
  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.id = 'play-motion';
  toggle.checked = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const play = document.createElement('label');
  play.append(toggle, ' Play animation');
  const offsets = Array(5).fill(0), values = Array(5).fill(0);
  const handles = new Map();
  let tick = 0, last = null;

  function sync(id) {
    const handle = handles.get(id);
    if (!handle) return;
    const angle = clocks[id].rate ? values[id] & 16383 : values[id];
    handle.slider.value = angle;
    handle.readout.value = (angle * 360 / 16384).toFixed(1) + '°';
  }
  function update() {
    for (const [key, clock] of Object.entries(clocks)) {
      const id = Number(key);
      values[id] = angle(clock, tick, offsets[id]);
      sync(id);
    }
  }
  toggle.onchange = () => { last = null; };
  function scrub(id, value) {
    toggle.checked = false;
    last = null;
    const clock = clocks[id];
    if (clock.rate) offsets[id] = value - tick * clock.rate;
    else {
      const period = clock.half * 2;
      const descending = ((tick + offsets[id]) % period + period) % period > clock.half;
      const phase = Math.round((value - clock.min) * clock.half / (clock.max - clock.min));
      offsets[id] = (descending ? period - phase : phase) - tick;
    }
    values[id] = value;
    sync(id);
    changed();
  }

  return {
    select(name, ids = []) {
      handles.clear();
      offsets.fill(0);
      tick = 0;
      last = null;
      box.replaceChildren();
      box.hidden = !ids.length;
      if (ids.length) box.append(play);
      for (const id of ids) {
        const clock = clocks[id], label = document.createElement('label');
        const rotor = ['tu95', 'tu95c', 'tu142'].includes(name);
        label.textContent = rotor ? 'Propeller row ' + id : name === 'rls' ? 'Dish tilt' : name === 'rls1' ? 'Dish rotation' : clock.label;
        const slider = document.createElement('input'), readout = document.createElement('output');
        slider.type = 'range';
        slider.id = 'motion-' + id;
        slider.min = clock.min;
        slider.max = clock.max;
        slider.step = 1;
        slider.oninput = () => scrub(id, Number(slider.value));
        label.htmlFor = slider.id;
        readout.htmlFor = slider.id;
        const row = document.createElement('div');
        row.append(label, slider, readout);
        box.append(row);
        handles.set(id, {slider, readout});
      }
      update();
    },
    apply(globals) {
      for (let id = 1; id <= 4; id++) globals[id] = values[id];
    },
    advance(time) {
      if (!toggle.checked || document.hidden) { last = null; return false; }
      if (last === null) last = time;
      const steps = Math.floor((time - last) * 16 / 1000);
      if (!steps) return false;
      tick += steps;
      last += steps * 1000 / 16;
      update();
      return handles.size > 0;
    },
  };
}
