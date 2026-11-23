// Classification is generated from the equipment tables and inspected models.
export function createModelBrowser(catalog, onSelect, root = '../../extracted/shapes/win_1_5/') {
  const list = document.getElementById('models');
  const search = document.getElementById('search');
  const category = document.getElementById('category');
  const count = document.getElementById('model-count');
  const expanded = new Map();
  const quickSelect = document.getElementById('model-select');
  if (quickSelect) {
    for (const model of catalog.models) quickSelect.add(new Option(`${model.display_name || model.label} · ${model.name}`, model.name));
    quickSelect.onchange = () => onSelect(quickSelect.value);
  }
  let selected;
  category.add(new Option(`All models (${catalog.models.length})`, 'all'));
  for (const group of catalog.categories) category.add(new Option(`${group.label} (${group.count})`, group.id));
  const categories = new Map(catalog.categories.map(c => [c.id, c.label]));
  const models = [...catalog.models].sort((a, b) => a.name.localeCompare(b.name, 'en', {numeric: true}));
  const text = m => [m.name, m.label, m.display_name, categories.get(m.category), ...(m.tags || [])].join(' ').toLowerCase();

  function render() {
    const query = search.value.trim().toLowerCase();
    const tokens = query.split(/\s+/).filter(Boolean);
    const visible = models.filter(m => (category.value === 'all' || m.category === category.value) && tokens.every(t => text(m).includes(t)));
    const scroll = list.scrollTop;
    list.replaceChildren();
    count.textContent = `${visible.length} of ${models.length} models`;
    for (const group of catalog.categories) {
      const members = visible.filter(m => m.category === group.id);
      if (!members.length) continue;
      const section = document.createElement('details');
      section.className = 'model-group';
      section.dataset.category = group.id;
      section.open = Boolean(query || category.value !== 'all' || (expanded.get(group.id) ?? members.some(m => m.name === selected)));
      const heading = document.createElement('summary');
      heading.append(document.createTextNode(group.label));
      const tally = document.createElement('small');
      tally.textContent = members.length;
      heading.append(tally);
      section.append(heading);
      section.ontoggle = () => {
        if (section.isConnected && !query && category.value === 'all') expanded.set(group.id, section.open);
      };
      for (const model of members) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.name = model.name;
        button.classList.toggle('selected', model.name === selected);
        if (model.name === selected) button.setAttribute('aria-current', 'true');
        const heading = document.createElement('span');
        heading.className = 'model-heading';
        const name = document.createElement('span');
        name.className = 'model-name';
        const identified = ['SCE aircraft and mission-editor tables', 'SCE weapon-definition table',
          'SCE surface-unit table; role from model geometry'].includes(model.classification_source) && model.display_name;
        name.textContent = identified || model.name;
        heading.append(name);
        const parameters = model.parameter_count + (model.motion_clocks?.length || 0);
        if (parameters > 0) {
          const badge = document.createElement('span');
          badge.className = 'model-parameter-count';
          badge.textContent = `${parameters} ${parameters === 1 ? 'param' : 'params'}`;
          badge.setAttribute('aria-label', `${parameters} adjustable ${parameters === 1 ? 'parameter' : 'parameters'}`);
          heading.append(badge);
        }
        const preview = document.createElement('span');
        preview.className = 'model-thumbnail';
        preview.setAttribute('aria-hidden', 'true');
        if (model.thumbnail) {
          const image = document.createElement('img');
          image.alt = '';
          image.width = 224;
          image.height = 168;
          image.loading = 'lazy';
          image.decoding = 'async';
          image.src = root + model.thumbnail;
          image.onerror = () => { image.remove(); preview.classList.add('unavailable'); };
          preview.append(image);
        } else preview.classList.add('unavailable');
        const caption = document.createElement('span');
        caption.className = 'model-caption';
        caption.append(heading);
        if (model.display_name) {
          const label = document.createElement('small');
          label.textContent = identified ? model.name : model.display_name;
          caption.append(label);
        }
        button.append(preview, caption);
        const parameterInfo = Number.isInteger(parameters)
          ? ` · ${parameters ? `${parameters} adjustable ${parameters === 1 ? 'parameter' : 'parameters'}` : 'No adjustable parameters'}` : '';
        button.title = `${model.display_name ? `${model.display_name} · ` : ''}${model.name}${parameterInfo}`;
        button.onclick = () => onSelect(model.name);
        section.append(button);
      }
      list.append(section);
    }
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'No models match. Try another group or search term.';
      list.append(empty);
    }
    list.scrollTop = scroll;
  }
  search.oninput = render;
  category.onchange = () => { list.scrollTop = 0; render(); };
  render();
  return {
    select(name) {
      selected = name;
      if (quickSelect) quickSelect.value = name;
      const model = models.find(m => m.name === name);
      if (model) expanded.set(model.category, true);
      render();
      const button = list.querySelector('button.selected');
      if (button) {
        // Scroll only the sidebar, without moving the model or controls.
        const box = button.getBoundingClientRect(), viewport = list.getBoundingClientRect();
        if (box.top < viewport.top || box.bottom > viewport.bottom) list.scrollTop += box.top - viewport.top - list.clientHeight / 2;
      }
    }
  };
}
