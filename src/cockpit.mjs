const $=id=>document.getElementById(id);
const descriptions={
 'hkurs.dat':'The compass ring uses six stored bitmap frames, combined in the game with rotated labels and vector needles. Change the frame to inspect the individual drawings.',
 'hsu27hud.dat':'Stored HUD artwork is mixed with lines and values drawn by code. These components include aiming and steering symbols; they are not a complete live HUD by themselves.',
 'tv.dat':'The target display has 48 component entries in the retail version. Some are only a few pixels across, so enlargement is useful here.',
 'mirror1.bin':'The centre mirror’s scanline mask. The original renders another view of the world and copies pixels only inside these spans.',
 'mirror2.bin':'The left mirror’s mask is tall and narrow. Its stored orientation and position determine how the reflected scene is placed.',
 'mirror3.bin':'The right mirror has its own mask and camera setup, rather than being a flipped copy of a static picture.',
 'helmet.dat':'A one-bit helmet-sight symbol. The drawing caller supplies its colour.'
};
try{
 const response=await fetch('../data/cockpit/catalog.json');if(!response.ok)throw Error('Component catalogue unavailable');
 const entries=await response.json();let selected=entries[0],index=0;
 function render(){const frame=selected.frames[index],image=$('component-image');image.src='../data/cockpit/'+frame.file;image.alt=`${selected.title}, stored component ${index+1}`;image.style.width=`${frame.width*Number($('magnification').value)}px`;image.style.height=`${frame.height*Number($('magnification').value)}px`;
  $('frame').value=index;$('frame').max=selected.frames.length-1;$('frame').disabled=selected.frames.length===1;$('frame-label').textContent=`${index+1} / ${selected.frames.length} · ${frame.width} × ${frame.height} pixels`;
  $('component-title').textContent=selected.title;$('component-description').textContent=descriptions[selected.name];
 }
 function choose(name){selected=entries.find(e=>e.name===name)||entries[0];index=0;for(const b of $('cockpit-tabs').children)b.setAttribute('aria-pressed',String(b.dataset.name===selected.name));history.replaceState(null,'','#'+selected.name);render();}
 for(const entry of entries){const b=document.createElement('button');b.type='button';b.textContent=entry.title;b.dataset.name=entry.name;b.onclick=()=>choose(entry.name);$('cockpit-tabs').append(b);}
 $('frame').oninput=()=>{index=Number($('frame').value);render();};$('magnification').onchange=render;
 $('previous-frame').onclick=()=>{index=(index+selected.frames.length-1)%selected.frames.length;render();};$('next-frame').onclick=()=>{index=(index+1)%selected.frames.length;render();};
 choose(location.hash.slice(1));addEventListener('hashchange',()=>choose(location.hash.slice(1)));window.flankerCockpit={choose,get selected(){return selected.name}};
}catch(error){$('component-description').textContent='The component images could not load. '+error.message;}
