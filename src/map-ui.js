import { mapStates, projectStatePoint } from './us-map.js?v=maps-3';
import { zipLocations } from './zip-data.js';

export const zipCount = Object.values(zipLocations).reduce((n,rows)=>n+rows.length,0);
const nationView = [0,0,1040,610];
const callouts = {VT:[948,100],NH:[998,138],MA:[998,205],RI:[998,243],CT:[998,281],NJ:[998,319],DE:[998,357],MD:[998,395]};
let nationalView = [...nationView], detailView = [0,0,960,600];
let currentRegion, onZip, returnFocus, points = [], groups = [];
let resizeObserver;
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function mapMarkup(selectedCode){
  return `<svg class="us-map" viewBox="${nationView.join(' ')}" aria-label="United States: choose a state">
    <g class="map-geography">${mapStates.map(s=>`<path class="geo-state state-choice ${s.code===selectedCode?'active':''}" d="${s.path}" data-state="${s.code}" tabindex="0" role="button" aria-label="Select ${s.name}" aria-pressed="${s.code===selectedCode}"><title>${s.name}</title></path>`).join('')}
    ${mapStates.filter(s=>!callouts[s.code]).map(s=>`<text class="state-label" x="${s.code==='HI'?354:s.center[0]}" y="${s.code==='HI'?550:s.center[1]}">${s.code}</text>`).join('')}
    ${Object.entries(callouts).map(([code,[x,y]])=>{const s=mapStates.find(s=>s.code===code);return `<g class="map-callout state-choice" data-state="${code}" role="button" tabindex="0" aria-label="Select ${s.name}"><path d="M${s.center.join(',')}L${x-22},${y}"/><rect x="${x-21}" y="${y-13}" width="42" height="26" rx="6"/><text x="${x}" y="${y}">${code}</text></g>`;}).join('')}
    </g></svg>`;
}

function applyView(svg,view){svg.setAttribute('viewBox',view.join(' '));}
function zoom(view,factor,limits){
  const width=Math.max(limits[2]/12,Math.min(limits[2],view[2]*factor));
  const height=width*limits[3]/limits[2];
  return [Math.max(limits[0],Math.min(limits[0]+limits[2]-width,view[0]+(view[2]-width)/2)),Math.max(limits[1],Math.min(limits[1]+limits[3]-height,view[1]+(view[3]-height)/2)),width,height];
}

function pan(svg,getView,setView){
  let start;
  svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;const view=getView();start={x:e.clientX,y:e.clientY,view:[...view],drag:false};});
  svg.addEventListener('pointermove',e=>{if(!start||!(e.buttons&1))return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.hypot(dx,dy)<5&&!start.drag)return;start.drag=true;svg.setPointerCapture(e.pointerId);const box=svg.getBoundingClientRect();const scale=Math.min(box.width/start.view[2],box.height/start.view[3]);setView([start.view[0]-dx/scale,start.view[1]-dy/scale,start.view[2],start.view[3]]);});
  svg.addEventListener('pointerup',()=>{if(start?.drag){svg.dataset.dragged='true';setTimeout(()=>delete svg.dataset.dragged,0);}start=null;});
  svg.addEventListener('pointercancel',()=>{start=null;});
}

export function bindMap(selectZip){
  onZip=selectZip; currentRegion=null; nationalView=[...nationView];
  resizeObserver?.disconnect();
  resizeObserver=new ResizeObserver(()=>{if(currentRegion&&document.querySelector('.zip-panel.open'))renderMarkers();});
  resizeObserver.observe(document.querySelector('.state-map-stage'));
  const svg=document.querySelector('.us-map');
  document.querySelectorAll('.state-choice').forEach(el=>{
    el.onclick=()=>{if(!svg.dataset.dragged)openState(el.dataset.state);};
    el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openState(el.dataset.state);}};
  });
  document.querySelector('.state-select select').onchange=e=>{if(e.target.value){openState(e.target.value);e.target.value='';}};
  document.querySelectorAll('.map-controls button').forEach((button,i)=>button.onclick=()=>{nationalView=i===2?[...nationView]:zoom(nationalView,i===0?.75:4/3,nationView);applyView(svg,nationalView);});
  pan(svg,()=>nationalView,view=>{nationalView=view;applyView(svg,view);});
  document.querySelector('#zip-search').oninput=()=>{
    renderResults();
    const matches=filteredPoints();detailView=[0,0,960,600];
    if(document.querySelector('#zip-search').value.trim()&&matches.length){
      const x0=Math.min(...matches.map(p=>p.x)),x1=Math.max(...matches.map(p=>p.x));
      const y0=Math.min(...matches.map(p=>p.y)),y1=Math.max(...matches.map(p=>p.y));
      const width=Math.min(960,Math.max(150,(x1-x0+30)*1.2,(y1-y0+30)*960/600*1.2));
      detailView=[(x0+x1-width)/2,(y0+y1-width*600/960)/2,width,width*600/960];
    }
    updateDetail();
  };
  document.querySelectorAll('.state-map-controls button').forEach((button,i)=>button.onclick=()=>{detailView=i===2?[0,0,960,600]:zoom(detailView,i===0?.6:1/.6,[0,0,960,600]);updateDetail();});
  document.querySelector('.zip-panel').addEventListener('keydown',e=>{
    if(e.key==='Escape'){document.querySelector('.close-panel').click();return;}
    if(e.key==='Tab'){
      const focusable=[...document.querySelectorAll('.zip-panel button,.zip-panel input,.zip-panel [tabindex="0"]')].filter(el=>!el.disabled);
      if(e.shiftKey&&document.activeElement===focusable[0]){e.preventDefault();focusable.at(-1)?.focus();}
      else if(!e.shiftKey&&document.activeElement===focusable.at(-1)){e.preventDefault();focusable[0]?.focus();}
    }
  });
}

export function openState(code){
  currentRegion=mapStates.find(s=>s.code===code);if(!currentRegion)return;
  returnFocus=document.activeElement;
  const region=currentRegion;
  points=(zipLocations[code]||[]).map(row=>{const [x,y]=projectStatePoint(region,row[2],row[3]);return {row,x,y};}).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  detailView=[0,0,960,600];
  document.querySelector('#state-title').textContent=region.name;
  document.querySelector('#zip-search').value='';
  document.querySelector('.state-map-stage').innerHTML=`<svg class="selected-state-map" viewBox="0 0 960 600" aria-label="${region.name} ZIP locations"><path class="detail-land" d="${region.detailPath}"/><g class="zip-markers"></g></svg>`;
  const svg=document.querySelector('.selected-state-map');
  pan(svg,()=>detailView,view=>{detailView=view;updateDetail();});
  svg.addEventListener('click',e=>{
    if(svg.dataset.dragged)return;
    const target=e.target.closest('[data-marker]');if(!target)return;
    selectMarker(+target.dataset.marker);
  });
  svg.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const target=e.target.closest('[data-marker]');if(target){e.preventDefault();selectMarker(+target.dataset.marker);}}});
  document.querySelectorAll('.state-choice').forEach(el=>{el.classList.toggle('active',el.dataset.state===code);el.setAttribute('aria-pressed',el.dataset.state===code);});
  document.querySelectorAll('header,main').forEach(el=>el.inert=true);
  const panel=document.querySelector('.zip-panel');panel.inert=false;panel.classList.add('open');
  document.querySelector('.overlay').classList.add('open');
  renderResults();renderMarkers();
  document.querySelector('.close-panel').focus();
}

function filteredPoints(){const query=document.querySelector('#zip-search').value.trim().toLowerCase();return points.filter(p=>!query||p.row[0].startsWith(query)||p.row[1].toLowerCase().includes(query));}

function renderResults(){
  if(!currentRegion)return;
  const matches=filteredPoints();
  document.querySelector('.zip-result-count').textContent=`${matches.length.toLocaleString('en-US')} ZIP locations${matches.length>40?' · showing first 40':''}`;
  document.querySelector('.zip-results').innerHTML=matches.length?matches.slice(0,40).map(p=>`<button class="zip-result" data-zip="${p.row[0]}"><strong>${p.row[0]}</strong><span>${escape(p.row[1])}</span><b aria-hidden="true">→</b></button>`).join(''):'<p class="zip-empty">No matching ZIP codes in this state. Try another city or ZIP.</p>';
  document.querySelectorAll('.zip-result').forEach(button=>button.onclick=()=>onZip(currentRegion.code,button.dataset.zip));
}

function renderMarkers(){
  if(!currentRegion)return;
  const svg=document.querySelector('.selected-state-map'), box=svg.getBoundingClientRect();
  const scale=Math.min(box.width/detailView[2],box.height/detailView[3])||.5;
  const cell=38/scale, bins=new Map();
  for(const p of filteredPoints()){
    if(p.x<detailView[0]||p.x>detailView[0]+detailView[2]||p.y<detailView[1]||p.y>detailView[1]+detailView[3])continue;
    const key=`${Math.floor(p.x/cell)},${Math.floor(p.y/cell)}`;
    if(!bins.has(key))bins.set(key,[]);bins.get(key).push(p);
  }
  groups=[...bins.values()];
  // Neighboring grid cells can place their centers too close together.
  // Merge those groups so the visible markers remain distinct click targets.
  const center=items=>[items.reduce((n,p)=>n+p.x,0)/items.length,items.reduce((n,p)=>n+p.y,0)/items.length];
  for(let i=0;i<groups.length;i++){
    for(let j=i+1;j<groups.length;j++){
      const a=center(groups[i]),b=center(groups[j]);
      if(Math.hypot(a[0]-b[0],a[1]-b[1])<30/scale){groups[i].push(...groups[j]);groups.splice(j,1);j=i;}
    }
  }
  svg.querySelector('.zip-markers').innerHTML=groups.map((items,i)=>{
    const x=items.reduce((n,p)=>n+p.x,0)/items.length,y=items.reduce((n,p)=>n+p.y,0)/items.length;
    const single=items.length===1,r=(single?5:13)/scale;
    const label=single?`${items[0].row[0]} · ${items[0].row[1]}`:`Zoom into ${items.length} ZIP locations`;
    return `<g class="zip-marker ${single?'single':'cluster'}" data-marker="${i}" tabindex="0" role="button" aria-label="${escape(label)}"><title>${escape(label)}</title><circle cx="${x}" cy="${y}" r="${r}"/>${single?'':`<text x="${x}" y="${y}" style="font-size:${10/scale}px">${items.length}</text>`}</g>`;
  }).join('');
}

function selectMarker(index){
  const items=groups[index];if(!items)return;
  if(items.length===1){onZip(currentRegion.code,items[0].row[0]);return;}
  // ZIPs can share a centroid (PO boxes); show those choices instead of endless zoom.
  const x0=Math.min(...items.map(p=>p.x)),x1=Math.max(...items.map(p=>p.x));
  const y0=Math.min(...items.map(p=>p.y)),y1=Math.max(...items.map(p=>p.y));
  if(Math.max(x1-x0,y1-y0)<1||detailView[2]<=60.01){
    document.querySelector('.zip-result-count').textContent=`${items.length} ZIP codes at this location`;
    document.querySelector('.zip-results').innerHTML=items.map(p=>`<button class="zip-result" data-zip="${p.row[0]}"><strong>${p.row[0]}</strong><span>${escape(p.row[1])}</span><b aria-hidden="true">→</b></button>`).join('');
    document.querySelectorAll('.zip-result').forEach(b=>b.onclick=()=>onZip(currentRegion.code,b.dataset.zip));return;
  }
  const width=Math.max(60,(x1-x0+20)*1.5,(y1-y0+20)*960/600*1.5),height=width*600/960;
  detailView=[(x0+x1-width)/2,(y0+y1-height)/2,width,height];updateDetail();
}

function updateDetail(){applyView(document.querySelector('.selected-state-map'),detailView);renderMarkers();}

export function closeStateMap(restoreFocus=true){
  const panel=document.querySelector('.zip-panel');panel.classList.remove('open');panel.inert=true;
  if(restoreFocus){document.querySelectorAll('header,main').forEach(el=>el.inert=false);returnFocus?.focus();returnFocus=null;}
}
