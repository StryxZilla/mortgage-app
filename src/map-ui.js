import { mapStates, projectStatePoint } from './us-map.js?v=maps-3';
import { zipLocations } from './zip-data.js';

export const zipCount = Object.values(zipLocations).reduce((n,rows)=>n+rows.length,0);
const postalDirectory = new Map(Object.values(zipLocations).flat().map(row=>[row[0],row]));
const nationView = [0,0,1040,610];
const callouts = {VT:[948,100],NH:[998,138],MA:[998,205],RI:[998,243],CT:[998,281],NJ:[998,319],DE:[998,357],MD:[998,395]};
let nationalView = [...nationView], detailView = [0,0,960,600];
let currentRegion, onZip, returnFocus, points = [], areas = [], areaByZip = new Map();
let loadId=0, loading=false, loadError='';
const boundaryCache=new Map();
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
function zoom(view,factor,limits,maxZoom=12){
  const width=Math.max(limits[2]/maxZoom,Math.min(limits[2],view[2]*factor));
  const height=width*limits[3]/limits[2];
  return [Math.max(limits[0],Math.min(limits[0]+limits[2]-width,view[0]+(view[2]-width)/2)),Math.max(limits[1],Math.min(limits[1]+limits[3]-height,view[1]+(view[3]-height)/2)),width,height];
}

function pan(svg,getView,setView,limits=nationView,maxZoom=12){
  const pointers=new Map();let start=null,pinch=null,dragged=false,resetTimer;
  const midpoint=()=>{const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.hypot(a.x-b.x,a.y-b.y)};};
  const coordinates=(point,view)=>{
    const box=svg.getBoundingClientRect(),scale=Math.min(box.width/view[2],box.height/view[3]);
    return [view[0]+(point.x-box.left-(box.width-view[2]*scale)/2)/scale,view[1]+(point.y-box.top-(box.height-view[3]*scale)/2)/scale];
  };
  const begin=()=>{
    if(pointers.size>=2){const mid=midpoint(),view=[...getView()];pinch={...mid,view,anchor:coordinates(mid,view)};start=null;dragged=true;svg.dataset.dragged='true';}
    else if(pointers.size===1){const point=[...pointers.values()][0];start={...point,view:[...getView()]};pinch=null;}
  };
  svg.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    clearTimeout(resetTimer);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});begin();
    if(pointers.size>=2)for(const id of pointers.keys())svg.setPointerCapture(id);
  });
  svg.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;
    if(e.pointerType==='mouse'&&!(e.buttons&1)){end(e);return;}
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch&&pointers.size>=2){
      const mid=midpoint();if(pinch.distance<2||mid.distance<2)return;
      const width=Math.max(limits[2]/maxZoom,Math.min(limits[2],pinch.view[2]*pinch.distance/mid.distance));
      const height=width*limits[3]/limits[2],box=svg.getBoundingClientRect(),scale=Math.min(box.width/width,box.height/height);
      setView([pinch.anchor[0]-(mid.x-box.left-(box.width-width*scale)/2)/scale,pinch.anchor[1]-(mid.y-box.top-(box.height-height*scale)/2)/scale,width,height]);
      return;
    }
    if(!start)return;
    const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.hypot(dx,dy)<5&&!dragged)return;
    dragged=true;svg.dataset.dragged='true';svg.setPointerCapture(e.pointerId);
    const box=svg.getBoundingClientRect(),scale=Math.min(box.width/start.view[2],box.height/start.view[3]);
    setView([start.view[0]-dx/scale,start.view[1]-dy/scale,start.view[2],start.view[3]]);
  });
  const end=e=>{
    pointers.delete(e.pointerId);if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);
    if(pointers.size){begin();return;}
    start=null;pinch=null;dragged=false;resetTimer=setTimeout(()=>delete svg.dataset.dragged,0);
  };
  svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
}

export function bindMap(selectZip){
  loadId++; onZip=selectZip; currentRegion=null; nationalView=[...nationView];
  resizeObserver?.disconnect();
  resizeObserver=new ResizeObserver(()=>{if(currentRegion&&document.querySelector('.zip-panel.open'))renderAreaLabels();});
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
    fitSearch();
    updateDetail();
  };
  document.querySelector('.zip-results').onclick=e=>{
    const button=e.target.closest('[data-zip]');if(button)onZip(currentRegion.code,button.dataset.zip);
  };
  document.querySelectorAll('.state-map-controls button').forEach((button,i)=>button.onclick=()=>{detailView=i===2?[0,0,960,600]:zoom(detailView,i===0?.6:1/.6,[0,0,960,600],480);updateDetail();});
  document.querySelector('.zip-panel').addEventListener('keydown',e=>{
    if(e.key==='Escape'){document.querySelector('.close-panel').click();return;}
    if(e.key==='Tab'){
      const focusable=[...document.querySelectorAll('.zip-panel button,.zip-panel input,.zip-panel [tabindex="0"]')].filter(el=>!el.disabled);
      if(e.shiftKey&&document.activeElement===focusable[0]){e.preventDefault();focusable.at(-1)?.focus();}
      else if(!e.shiftKey&&document.activeElement===focusable.at(-1)){e.preventDefault();focusable[0]?.focus();}
    }
  });
}

function areaColor(zip){return ['#e2ecde','#ede9f5','#dfeae6','#f0ecd9','#e6ebdc','#e5e4f3'][Number(zip)%6];}

async function loadBoundaries(code){
  if(!boundaryCache.has(code)){
    const request=fetch(new URL(`./zip-boundaries/${code}.json?v=zip-areas-1`,import.meta.url))
      .then(response=>{if(!response.ok)throw new Error('ZIP areas could not be loaded.');return response.json();})
      .then(data=>{if(!Array.isArray(data.areas)||!data.areas.length)throw new Error('ZIP areas are unavailable.');return data;})
      .catch(error=>{boundaryCache.delete(code);throw error;});
    boundaryCache.set(code,request);
  }
  return boundaryCache.get(code);
}

export async function openState(code){
  currentRegion=mapStates.find(s=>s.code===code);if(!currentRegion)return;
  const requestId=++loadId;
  returnFocus=document.activeElement;
  const region=currentRegion;
  points=(zipLocations[code]||[]).map(row=>{const [x,y]=projectStatePoint(region,row[2],row[3]);return {row,x,y};}).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  areas=[];areaByZip=new Map();loading=true;loadError='';
  detailView=[0,0,960,600];
  document.querySelector('#state-title').textContent=region.name;
  document.querySelector('#zip-search').value='';
  document.querySelector('.state-map-stage').innerHTML=`<svg class="selected-state-map" viewBox="0 0 960 600" aria-label="${region.name} ZIP areas"><path class="detail-land" d="${region.detailPath}"/><g class="zip-areas"></g><g class="zip-labels"></g><path class="state-border" d="${region.detailPath}"/></svg><div class="boundary-status" role="status">Loading ZIP area outlines…</div><div class="area-tooltip" role="status"></div>`;
  const svg=document.querySelector('.selected-state-map');
  pan(svg,()=>detailView,view=>{detailView=view;updateDetail();},[0,0,960,600],480);
  svg.addEventListener('click',e=>{
    if(svg.dataset.dragged)return;
    const target=e.target.closest('.zip-area');if(target)onZip(currentRegion.code,target.dataset.zip);
  });
  svg.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const target=e.target.closest('.zip-area');if(target){e.preventDefault();onZip(currentRegion.code,target.dataset.zip);}}});
  svg.addEventListener('pointerover',e=>{
    const path=e.target.closest('.zip-area');if(!path)return;
    const entry=points.find(p=>p.row[0]===path.dataset.zip);
    document.querySelector('.area-tooltip').textContent=`${path.dataset.zip}${entry?.row[1]&&entry.row[1]!=='ZIP area'?' · '+entry.row[1]:''}`;
    document.querySelector('.area-tooltip').classList.add('visible');
  });
  svg.addEventListener('pointerleave',()=>document.querySelector('.area-tooltip').classList.remove('visible'));
  svg.addEventListener('wheel',e=>{e.preventDefault();detailView=zoom(detailView,e.deltaY<0?.8:1.25,[0,0,960,600],480);updateDetail();},{passive:false});
  document.querySelectorAll('.state-choice').forEach(el=>{el.classList.toggle('active',el.dataset.state===code);el.setAttribute('aria-pressed',el.dataset.state===code);});
  document.querySelectorAll('header,main').forEach(el=>el.inert=true);
  const panel=document.querySelector('.zip-panel');panel.inert=false;panel.classList.add('open');
  document.querySelector('.overlay').classList.add('open');
  renderResults();
  document.querySelector('.close-panel').focus();
  try{
    const data=await loadBoundaries(code);
    if(requestId!==loadId)return;
    areas=data.areas;areaByZip=new Map(areas.map(area=>[area.zip,area]));loading=false;
    const known=new Set(points.map(p=>p.row[0]));
    // Census areas can cross postal-state borders or lack a current postal record.
    // Keep every geographic ZIP area selectable, including those state portions.
    for(const area of areas)if(!known.has(area.zip))points.push({row:postalDirectory.get(area.zip)||[area.zip,'ZIP area'],x:area.center[0],y:area.center[1]});
    points.sort((a,b)=>a.row[0].localeCompare(b.row[0]));
    svg.querySelector('.zip-areas').innerHTML=areas.map(area=>`<path class="zip-area" data-zip="${area.zip}" d="${area.path}" fill="${areaColor(area.zip)}" fill-rule="evenodd" role="button" tabindex="-1" aria-label="Select ZIP ${area.zip}"><title>ZIP ${area.zip}</title></path>`).join('');
    document.querySelector('.boundary-status').classList.add('hidden');
    renderResults();
    // A search entered during loading must fit the newly available area bounds.
    if(document.querySelector('#zip-search').value.trim())fitSearch();
    updateDetail();
  }catch(error){
    if(requestId!==loadId)return;
    loading=false;loadError='ZIP outlines could not load. Close and reopen this state to retry.';
    document.querySelector('.boundary-status').textContent=loadError;renderResults();
  }
}

function filteredPoints(){const query=document.querySelector('#zip-search').value.trim().toLowerCase();return points.filter(p=>!query||p.row[0].startsWith(query)||p.row[1].toLowerCase().includes(query));}

function fitSearch(){
  const matches=filteredPoints();detailView=[0,0,960,600];
  if(!document.querySelector('#zip-search').value.trim()||!matches.length)return;
  const bounds=matches.flatMap(p=>areaByZip.get(p.row[0])?.bounds||[[p.x,p.y],[p.x,p.y]]);
  const x0=Math.min(...bounds.map(p=>p[0])),x1=Math.max(...bounds.map(p=>p[0]));
  const y0=Math.min(...bounds.map(p=>p[1])),y1=Math.max(...bounds.map(p=>p[1]));
  const width=Math.min(960,Math.max(12,(x1-x0)*1.25,(y1-y0)*960/600*1.25));
  detailView=[(x0+x1-width)/2,(y0+y1-width*600/960)/2,width,width*600/960];
}

function renderResults(){
  if(!currentRegion)return;
  const matches=filteredPoints(),mapped=matches.filter(p=>areaByZip.has(p.row[0])).length;
  document.querySelector('.zip-result-count').textContent=loading?`${matches.length.toLocaleString('en-US')} ZIP codes · loading outlines…`:`${matches.length.toLocaleString('en-US')} ZIP codes · ${mapped.toLocaleString('en-US')} mapped areas`;
  document.querySelector('.zip-results').innerHTML=matches.length?matches.map(p=>`<button class="zip-result" data-zip="${p.row[0]}"><strong>${p.row[0]}</strong><span>${escape(p.row[1])}${!loading&&!areaByZip.has(p.row[0])?'<small>Postal ZIP · no mapped area</small>':''}</span><b aria-hidden="true">→</b></button>`).join(''):'<p class="zip-empty">No matching ZIP codes in this state. Try another city or ZIP.</p>';
  document.querySelector('.zip-results').scrollTop=0;
}

function renderAreaLabels(){
  if(!currentRegion)return;
  const svg=document.querySelector('.selected-state-map');if(!svg)return;
  const box=svg.getBoundingClientRect(),scale=Math.min(box.width/detailView[2],box.height/detailView[3])||.5;
  svg.querySelector('.state-border').style.opacity=detailView[2]<300?'0':'1';
  svg.querySelector('.detail-land').style.opacity=detailView[2]<300?'.2':'1';
  const query=document.querySelector('#zip-search').value.trim();
  const matching=new Set(filteredPoints().map(p=>p.row[0]));
  svg.querySelectorAll('.zip-area').forEach(path=>{
    path.classList.toggle('muted',Boolean(query)&&!matching.has(path.dataset.zip));
    path.classList.toggle('matching',Boolean(query)&&matching.has(path.dataset.zip));
  });
  const occupied=[];
  svg.querySelector('.zip-labels').innerHTML=areas.filter(area=>{
    if(query&&!matching.has(area.zip))return false;
    const [[x0,y0],[x1,y1]]=area.bounds,[x,y]=area.center;
    if(x<detailView[0]||x>detailView[0]+detailView[2]||y<detailView[1]||y>detailView[1]+detailView[3])return false;
    if(!(query&&matching.size===1)&&((x1-x0)*scale<28||(y1-y0)*scale<16))return false;
    if(occupied.some(p=>Math.abs(p[0]-x)*scale<42&&Math.abs(p[1]-y)*scale<16))return false;
    occupied.push([x,y]);return true;
  }).map(area=>`<text class="zip-area-label" x="${area.center[0]}" y="${area.center[1]}" style="font-size:${11/scale}px">${area.zip}</text>`).join('');
}

function updateDetail(){applyView(document.querySelector('.selected-state-map'),detailView);renderAreaLabels();}

export function closeStateMap(restoreFocus=true){
  loadId++;
  const panel=document.querySelector('.zip-panel');panel.classList.remove('open');panel.inert=true;
  if(restoreFocus){document.querySelectorAll('header,main').forEach(el=>el.inert=false);returnFocus?.focus();returnFocus=null;}
}
