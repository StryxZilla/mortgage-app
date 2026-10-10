import { amortizationSchedule } from './mortgage.js';

const money = value => new Intl.NumberFormat('en-US', { style:'currency',currency:'USD',maximumFractionDigits:0 }).format(value);
const yearLabel = point => point.month===0?'Now':`Year ${(point.month/12).toFixed(point.month%12?1:0)}`;

export function equitySeries(details) {
  const points = amortizationSchedule(details);
  const last = points.at(-1);
  // Keep the selected term visible after early payoff; the home can still
  // appreciate while its remaining mortgage balance stays at zero.
  for (let month = Math.floor(last.month/12)*12+12; month <= details.term*12; month += 12) {
    const homeValue = details.price * (1 + (Number(details.appreciation)||0)/100) ** (month/12);
    points.push({ month,balance:0,equity:homeValue,homeValue,interestPaid:last.interestPaid });
  }
  return points;
}

export function equityChartMarkup(details) {
  const points=equitySeries(details),months=details.term*12;
  const left=55,right=445,top=18,bottom=195;
  const min=Math.min(0,...points.map(p=>p.equity)),max=Math.max(1,...points.map(p=>p.equity));
  const x=p=>left+p.month/months*(right-left),y=p=>bottom-(p.equity-min)/(max-min)*(bottom-top);
  const coordinates=points.map(p=>`${x(p).toFixed(2)},${y(p).toFixed(2)}`).join(' ');
  const zero=bottom-(0-min)/(max-min)*(bottom-top);
  const ticks=Array.from({length:Math.floor(details.term/5)+1},(_,i)=>i*5);
  if(ticks.at(-1)!==details.term)ticks.push(details.term);
  const labels=ticks.map(year=>`<text x="${left+year/details.term*(right-left)}" y="218" text-anchor="${year===0?'start':year===details.term?'end':'middle'}">${year===0?'Now':year+' yr'}</text>`).join('');
  const grid=[min,(min+max)/2,max].map(value=>{const pos=bottom-(value-min)/(max-min)*(bottom-top);const label=Math.abs(value)>=1000000?`$${(value/1000000).toFixed(1)}m`:`$${Math.round(value/1000)}k`;return `<line x1="${left}" x2="${right}" y1="${pos}" y2="${pos}" class="equity-grid"/><text x="${left-7}" y="${pos+4}" text-anchor="end">${label}</text>`;}).join('');
  const markers=points.flatMap((p,index)=>p.month%60===0||p.month===months?[`<g class="equity-point" data-point="${index}" tabindex="0" role="button" aria-label="${yearLabel(p)}, home equity ${money(p.equity)}, loan balance ${money(p.balance)}, home value ${money(p.homeValue)}"><circle cx="${x(p)}" cy="${y(p)}" r="13" fill="transparent"/><circle class="equity-marker" cx="${x(p)}" cy="${y(p)}" r="4"/></g>`]:[]).join('');
  return `<div class="equity-interactive"><svg class="equity-svg" viewBox="0 0 465 225" aria-label="Projected home equity over ${details.term} years" role="group"><defs><linearGradient id="equity-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b4a7f8" stop-opacity=".5"/><stop offset="1" stop-color="#b4a7f8" stop-opacity=".04"/></linearGradient></defs><g class="equity-axis">${grid}${labels}</g><polygon points="${left},${zero} ${coordinates} ${right},${zero}" fill="url(#equity-fill)"/><polyline points="${coordinates}" fill="none" stroke="#7364d9" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${markers}<line class="equity-guide" x1="${left}" x2="${left}" y1="${top}" y2="${bottom}" hidden/><circle class="equity-selected" r="5" cx="${left}" cy="${y(points[0])}" hidden/></svg><div class="equity-tooltip" role="tooltip" hidden></div></div><div class="equity-readout" role="status" aria-live="polite">${yearLabel(points[0])} · Equity ${money(points[0].equity)}</div><label class="equity-explore" for="equity-year">Explore the timeline<input id="equity-year" type="range" min="0" max="${points.length-1}" step="1" value="0" aria-label="Explore equity by year"></label><p class="equity-help">Hover, tap, or focus a point for values. Assumes ${details.appreciation}% annual home-price growth; this is a projection.</p>`;
}

export function bindEquityChart(details) {
  const root=document.querySelector('#chart'),svg=root?.querySelector('.equity-svg');
  if(!svg)return;
  const points=equitySeries(details),tooltip=root.querySelector('.equity-tooltip'),guide=root.querySelector('.equity-guide'),dot=root.querySelector('.equity-selected');
  const slider=root.querySelector('#equity-year');
  const min=Math.min(0,...points.map(p=>p.equity)),max=Math.max(1,...points.map(p=>p.equity));
  let selected=-1;
  const show=index=>{
    selected=Math.max(0,Math.min(points.length-1,index));const point=points[selected];
    const x=55+point.month/(details.term*12)*(445-55),y=195-(point.equity-min)/(max-min)*(195-18);
    guide.setAttribute('x1',x);guide.setAttribute('x2',x);dot.setAttribute('cx',x);dot.setAttribute('cy',y);
    guide.removeAttribute('hidden');dot.removeAttribute('hidden');tooltip.hidden=false;
    tooltip.innerHTML=`<strong>${yearLabel(point)}</strong><span>Home equity <b>${money(point.equity)}</b></span><span>Loan balance <b>${money(point.balance)}</b></span><span>Home value <b>${money(point.homeValue)}</b></span>`;
    tooltip.style.left=x>250?'10px':'auto';tooltip.style.right=x>250?'auto':'10px';
    slider.value=selected;
    const text=`${yearLabel(point)} · Equity ${money(point.equity)} · Loan balance ${money(point.balance)} · Home value ${money(point.homeValue)}`;
    root.querySelector('.equity-readout').textContent=text;slider.setAttribute('aria-valuetext',text);
  };
  svg.onpointermove=e=>{
    const box=svg.getBoundingClientRect(),month=Math.max(0,Math.min(1,((e.clientX-box.left)/box.width*465-55)/390))*details.term*12;
    const index=points.reduce((best,point,i)=>Math.abs(point.month-month)<Math.abs(points[best].month-month)?i:best,0);
    if(index!==selected||tooltip.hidden)show(index);
  };
  svg.onpointerleave=()=>{if(!root.contains(document.activeElement)){tooltip.hidden=true;guide.setAttribute('hidden','');dot.setAttribute('hidden','');}};
  root.querySelectorAll('.equity-point').forEach(marker=>{
    marker.onfocus=()=>show(+marker.dataset.point);marker.onclick=()=>show(+marker.dataset.point);
    marker.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show(+marker.dataset.point);}};
  });
  slider.oninput=e=>show(+e.target.value);slider.onfocus=()=>show(+slider.value);
  slider.setAttribute('aria-valuetext',`Now · Equity ${money(points[0].equity)}`);
}
