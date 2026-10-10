import { isRateStale } from './rates.js';

const dateLabel = date => new Date(date+'T12:00:00Z').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'UTC' });
const shortDate = date => new Date(date+'T12:00:00Z').toLocaleDateString('en-US', { month:'short', year:'2-digit', timeZone:'UTC' });

export function rateModalMarkup(){
  return `<dialog class="rate-modal" aria-labelledby="rate-title"><button class="close-rate" aria-label="Close rate trends">×</button><p class="mini">THE RATE PICTURE</p><h2 id="rate-title">Mortgage rate trends</h2><p class="rate-intro">Freddie Mac’s national weekly averages</p><div class="rate-modal-content"></div></dialog>`;
}

export function rateHistory(data, range){
  const end=Date.parse(data.series[30].at(-1)[0]);
  const days={ '1m':31,'6m':183,'1y':366,'5y':1827 }[range]??366;
  const fifteen=new Map(data.series[15]);
  return data.series[30].filter(([date])=>Date.parse(date)>=end-days*86400000&&fifteen.has(date))
    .map(([date,rate30])=>({date,rate30,rate15:fifteen.get(date)}));
}

export function rateChart(rows, selected){
  if(rows.length<2)return '<p>Not enough observations for this range.</p>';
  const width=660,left=46,right=642,top=18,bottom=218;
  const low=Math.floor((Math.min(...rows.flatMap(p=>[p.rate15,p.rate30]))-.2)*2)/2;
  const high=Math.ceil((Math.max(...rows.flatMap(p=>[p.rate15,p.rate30]))+.2)*2)/2;
  const start=Date.parse(rows[0].date),span=Date.parse(rows.at(-1).date)-start;
  const x=p=>left+(Date.parse(p.date)-start)/span*(right-left);
  const y=value=>bottom-(value-low)/(high-low)*(bottom-top);
  const path=key=>rows.map((p,i)=>`${i?'L':'M'}${x(p).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  const point=rows[Math.min(rows.length-1,selected)];
  const grid=Array.from({length:5},(_,i)=>{const value=low+(high-low)*i/4;return `<line x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}" class="rate-grid"/><text x="${left-8}" y="${y(value)+4}" text-anchor="end">${value.toFixed(1)}%</text>`;}).join('');
  const ticks=[0,Math.floor((rows.length-1)/2),rows.length-1].map(i=>`<text x="${x(rows[i])}" y="243" text-anchor="${i===0?'start':i===rows.length-1?'end':'middle'}">${shortDate(rows[i].date)}</text>`).join('');
  return `<svg class="rate-chart" viewBox="0 0 ${width} 255" role="img" aria-label="15-year and 30-year weekly mortgage rates from ${dateLabel(rows[0].date)} through ${dateLabel(rows.at(-1).date)}"><g class="rate-axis">${grid}${ticks}</g><path d="${path('rate30')}" class="rate-line rate-thirty"/><path d="${path('rate15')}" class="rate-line rate-fifteen"/><line x1="${x(point)}" x2="${x(point)}" y1="${top}" y2="${bottom}" class="rate-cursor"/><circle cx="${x(point)}" cy="${y(point.rate30)}" r="5" class="rate-dot-thirty"/><circle cx="${x(point)}" cy="${y(point.rate15)}" r="5" class="rate-dot-fifteen"/></svg>`;
}

export function bindRateModal({getRates,onUse,onRetry}){
  const dialog=document.querySelector('.rate-modal'),content=dialog.querySelector('.rate-modal-content');
  let range='1y',selected=null,opener=null;
  const close=()=>dialog.close();
  const draw=()=>{
    const rates=getRates();
    if(!rates.data){content.innerHTML=`<p role="status">${rates.status==='loading'?'Loading rate history…':'Rate history could not load.'}</p><button class="retry-rates">Retry rate data</button>`;content.querySelector('button').onclick=async()=>{await onRetry();draw();};return;}
    const data=rates.data,rows=rateHistory(data,range);selected=Math.min(selected??rows.length-1,rows.length-1);
    const latest=data.series[30].at(-1),fifteen=data.series[15].at(-1),weekChange=latest[1]-data.series[30].at(-2)[1];
    content.innerHTML=`<div class="rate-stats"><div><span><i class="rate-key thirty"></i>30-year fixed</span><strong>${latest[1].toFixed(2)}<small>%</small></strong><p>${weekChange>=0?'+':''}${weekChange.toFixed(2)} percentage points this week</p></div><div><span><i class="rate-key fifteen"></i>15-year fixed</span><strong>${fifteen[1].toFixed(2)}<small>%</small></strong><p>Published ${dateLabel(fifteen[0])}</p></div></div><div class="rate-ranges" role="group" aria-label="Rate history time range">${[['1m','1 month'],['6m','6 months'],['1y','1 year'],['5y','5 years']].map(([id,label])=>`<button data-range="${id}" aria-pressed="${range===id}">${label}</button>`).join('')}</div><div class="rate-chart-wrap">${rateChart(rows,selected)}</div><div class="rate-readout" role="status" aria-live="polite"></div><label class="rate-scrub-label" for="rate-week">Explore a week <input id="rate-week" type="range" min="0" max="${rows.length-1}" value="${selected}" step="1"></label><p class="rate-provenance">As of ${dateLabel(latest[0])} · <a href="https://www.freddiemac.com/pmms" target="_blank" rel="noopener noreferrer">Freddie Mac PMMS</a> via <a href="https://fred.stlouisfed.org/series/MORTGAGE30US" target="_blank" rel="noopener noreferrer">FRED</a>. Refreshed weekly.${isRateStale(data)?' <strong>This benchmark is over two weeks old; check your lender for current pricing.</strong>':''}</p><p class="rate-explainer">Conventional purchase-loan averages for borrowers with good credit and 20% down. These are interest rates, not APRs or personal quotes. No 20-year series is published; that term uses the 30-year benchmark as a proxy.</p><button class="apply-weekly-rate">Use weekly benchmark in my estimate →</button>`;
    const readout=()=>{const point=rows[selected];content.querySelector('.rate-readout').textContent=`${dateLabel(point.date)} · 30-year ${point.rate30.toFixed(2)}% · 15-year ${point.rate15.toFixed(2)}%`;content.querySelector('#rate-week').setAttribute('aria-valuetext',content.querySelector('.rate-readout').textContent);};
    const move=index=>{selected=Math.max(0,Math.min(rows.length-1,index));content.querySelector('#rate-week').value=selected;content.querySelector('.rate-chart-wrap').innerHTML=rateChart(rows,selected);bindPointer();readout();};
    const bindPointer=()=>{content.querySelector('.rate-chart').onpointermove=e=>{const rect=e.currentTarget.getBoundingClientRect();const fraction=Math.max(0,Math.min(1,((e.clientX-rect.left)/rect.width*660-46)/(642-46)));const target=Date.parse(rows[0].date)+fraction*(Date.parse(rows.at(-1).date)-Date.parse(rows[0].date));const index=rows.reduce((best,p,i)=>Math.abs(Date.parse(p.date)-target)<Math.abs(Date.parse(rows[best].date)-target)?i:best,0);if(index!==selected)move(index);};};
    content.querySelector('#rate-week').oninput=e=>move(+e.target.value);
    content.querySelectorAll('[data-range]').forEach(button=>button.onclick=()=>{range=button.dataset.range;selected=null;draw();content.querySelector(`[data-range="${range}"]`).focus();});
    content.querySelector('.apply-weekly-rate').onclick=()=>{onUse();close();};
    bindPointer();readout();
  };
  document.querySelectorAll('.rate-trends').forEach(button=>button.onclick=()=>{opener=button;selected=null;draw();dialog.showModal();});
  dialog.querySelector('.close-rate').onclick=close;
  dialog.addEventListener('rates-changed',()=>{if(dialog.open)draw();});
  dialog.addEventListener('close',()=>{opener?.focus();});
  dialog.addEventListener('click',e=>{const rect=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom))close();});
}
