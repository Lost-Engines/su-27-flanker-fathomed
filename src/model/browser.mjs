const notes = {
 su27: 'One aircraft, 41 shape nodes. Extend the gear to watch the doors and struts follow their own curves.',
 'su27-1': 'One of the 26 additional Su-27 colour schemes. Missions select these as aircraft types; they share geometry and flight data.',
 mig23: 'The wing-sweep input is Mach number, not an angle. The model curves contain two short transitions separated by plateaux.',
 f15: 'The F-15 uses the same broad arrangement of state flags, flight controls and attachment slots as the Su-27.',
 il76: 'The ramp waits until the cargo doors begin opening, then lowers. Try extending the gear as well.',
 tu95: 'A large aircraft built from a small number of shaded polygons. The propellers and their drawing order are part of the shape.',
 akr: 'Moskva, a helicopter cruiser. These controls operate the first gun mount and the flag insignia.',
 bpk: 'The game identifies this ship as Udaloy. Each weapon mount has its own animation inputs; this selection exposes the first mount.',
 bmp_2: 'A rotating turret, elevating barrel and firing effect are separate from the hull and running gear.',
 buk_pzu: 'The state word selects which missiles are still present. The whole launcher then rotates and elevates.',
 trproj: 'The searchlight truck has no model animation inputs. Its appearance alone does not establish a moving searchlight mechanism.',
 car1: 'The original paints the windows over the body even where the geometry intersects. This preview adapts those two faces to preserve the intended appearance.',
 chear: 'The seat’s rockets fade before its drogue parachute extends. The pilot later separates into the epilot model.',
 epilot: 'Scrub the deployment stage to open the parachute and settle the pilot’s arms and legs. Subtle canopy movement comes from the model’s random transforms.',
 betab500: 'The live bomb starts with its parachute, then switches to the booster. Both can be shown here to inspect the individual parts.',
 agm65: 'A single flag shows the missile’s engine flame.',
 expl_03: 'Several expanding parts and conditional stages form the explosion. Auto-fit keeps it in frame while you scrub its age.',
 hangar: 'A scenery building, drawn from the same shape format as the aircraft and weapons.'
};
export function createModelBrowser(catalog, onSelect) {
  const select = document.getElementById('model-select'), grid = document.getElementById('models');
  for (const model of catalog.models) {
    select.add(new Option(model.display_name || model.label, model.name));
    const button = document.createElement('button'); button.type = 'button'; button.dataset.name = model.name;
    const image = document.createElement('img'); image.src = `../data/models/${model.thumbnail}`; image.alt = ''; image.width = 224; image.height = 168; image.loading = 'lazy';
    const label = document.createElement('span'); label.textContent = model.display_name || model.label;
    button.append(image, label); button.onclick = () => { onSelect(model.name); document.getElementById('model-select').focus({preventScroll: true}); };
    grid.append(button);
  }
  select.onchange = () => onSelect(select.value);
  return {select(name) {
    select.value = name;
    document.getElementById('model-description').textContent = notes[name] || '';
    for (const button of grid.children) button.setAttribute('aria-pressed', String(button.dataset.name === name));
  }};
}
