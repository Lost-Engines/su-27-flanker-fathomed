try {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) document.getElementById('perturb').checked = false;
  await import('./viewer.mjs');
  const api = window.flankerModelViewer;
  window.addEventListener('hashchange', () => {
    const name = location.hash.slice(1);
    const known = Array.from(document.getElementById('model-select').options).some(o => o.value === name);
    api.select(known ? name : 'su27').catch(error => document.getElementById('status').textContent = error.message);
  });
  let yaw = .85, pitch = .35, zoom = 1;
  const step = (axis, amount) => {
    // Read the current pose so keyboard and pointer controls can be mixed.
    ({yaw, pitch, zoom} = api.camera);
    if (axis === 'yaw') yaw += amount;
    if (axis === 'pitch') pitch = Math.max(-1.5, Math.min(1.5, pitch + amount));
    if (axis === 'zoom') zoom = Math.max(.15, Math.min(20, zoom * amount));
    api.setCamera(yaw, pitch, zoom);
  };
  for (const button of document.querySelectorAll('[data-camera]')) button.onclick = () => step(button.dataset.camera, Number(button.dataset.amount));
  document.getElementById('view').addEventListener('keydown', event => {
    const keys = {ArrowLeft:['yaw',-.1],ArrowRight:['yaw',.1],ArrowUp:['pitch',.1],ArrowDown:['pitch',-.1],'+':['zoom',1.1],'-':['zoom',1/1.1]};
    if (keys[event.key]) { event.preventDefault(); step(...keys[event.key]); }
  });
  document.getElementById('model-fallback').hidden = true;
} catch (error) {
  document.getElementById('status').textContent = 'The interactive model could not start. It needs WebGL 2; the preview and article are still available.';
  document.getElementById('view').hidden = true;
  document.getElementById('model-fallback').hidden = false;
  document.getElementById('viewer-error').textContent = error.message;
}
