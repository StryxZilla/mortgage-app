const requests=new Map();
let cachePromise;
const groups=[['Under $100k',2,14],['$100k–$200k',15,18],['$200k–$300k',19,20],['$300k–$500k',21,22],['$500k–$750k',23,23],['$750k–$1m',24,24],['$1m–$2m',25,26],['$2m+',27,27]];
const labels=['<100k','100–200k','200–300k','300–500k','500–750k','750k–1m','1–2m','2m+'];
const thresholds=[100000,200000,300000,500000,750000,1000000,2000000];

export function priceDistributionBin(price){
  if(!Number.isFinite(price)||price<=0)return null;
  const index=thresholds.findIndex(limit=>price<limit);
  return index<0?7:index;
}

export function selectDistributionPrice(root,price){
  const selected=priceDistributionBin(price);
  root.querySelectorAll('[data-price-bin]').forEach(bar=>{
    const active=+bar.dataset.priceBin===selected;
    bar.classList.toggle('selected',active);bar.setAttribute('aria-pressed',String(active));
  });
  const note=root.querySelector('.distribution-selection');if(!note)return;
  note.textContent=selected===null?'Enter a home price to highlight its band.':`Your home price: ${new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(price)} · ${groups[selected][0]}`;
}

export function parsePriceDistribution(raw,zip){
  const estimates=raw.data?.[`86000US${zip}`]?.B25075?.estimate;
  const total=estimates?.B25075001;
  if(raw.release?.id!=='acs2024_5yr'||!Number.isFinite(total)||total<=0)return null;
  const bins=groups.map(([label,start,end])=>{
    let count=0;
    for(let i=start;i<=end;i++){
      const value=estimates[`B25075${String(i).padStart(3,'0')}`];
      if(!Number.isFinite(value)||value<0)return null;
      count+=value;
    }
    return {label,count,percent:count/total*100};
  });
  if(bins.some(bin=>bin===null)||Math.abs(bins.reduce((sum,bin)=>sum+bin.count,0)-total)>.01)return null;
  return {zip,total,bins,period:'2020–2024',sourceUrl:`https://data.census.gov/table/ACSDT5Y2024.B25075?g=860XX00US${zip}`};
}

export async function getPriceDistribution(zip){
  if(!/^\d{5}$/.test(zip))return null;
  if(!requests.has(zip)){
    const request=(async()=>{
      cachePromise??=fetch(new URL('./price-distribution-cache.json',import.meta.url)).then(r=>r.ok?r.json():{}).catch(()=>({}));
      const cached=await cachePromise;
      if(cached[zip])return parsePriceDistribution(cached[zip],zip);
      const response=await fetch(`https://api.censusreporter.org/1.0/data/show/acs2024_5yr?table_ids=B25075&geo_ids=86000US${zip}`,{signal:AbortSignal.timeout(10000)});
      if(!response.ok){if(response.status===400||response.status===404)return null;throw new Error('Price distribution could not load.');}
      return parsePriceDistribution(await response.json(),zip);
    })().catch(error=>{requests.delete(zip);throw error;});
    requests.set(zip,request);
  }
  return requests.get(zip);
}

export function renderPriceDistribution(root,state,onRetry,price=null){
  root.innerHTML='';
  const heading=document.createElement('strong');heading.className='distribution-title';heading.textContent='Home-value distribution';root.append(heading);
  if(!state.data){
    const status=document.createElement('p');status.className='source-note';status.textContent=state.status==='loading'?'Loading Census home-value bands…':'A price distribution is unavailable for this ZIP. Your estimate is still editable.';root.append(status);
    if(state.status==='error'){const retry=document.createElement('button');retry.textContent='Retry distribution';retry.className='retry-distribution';retry.onclick=onRetry;root.append(retry);}
    return;
  }
  const data=state.data,max=Math.max(...data.bins.map(bin=>bin.percent),1),chart=document.createElement('div');
  const fallback=state.selectedZip!==data.zip;
  const note=document.createElement('p');note.className='source-note'+(fallback?' default-estimate':'');note.textContent=`${fallback?'Nearby ZIP default · ':''}ZIP ${data.zip} · ${data.total.toLocaleString('en-US')} owner-occupied homes`;root.append(note);
  chart.innerHTML=`<svg class="distribution-chart" viewBox="0 0 520 155" role="group" aria-label="Census home-value distribution for ZIP ${data.zip}">${data.bins.map((bin,index)=>{const height=bin.percent/max*105;return `<g class="distribution-bin" data-price-bin="${index}" tabindex="0" role="button" aria-label="${bin.label}: ${bin.percent.toFixed(1)} percent, ${bin.count.toLocaleString('en-US')} homes"><rect x="${10+index*64}" y="8" width="55" height="112" fill="transparent"/><rect class="distribution-bar" x="${12+index*64}" y="${120-height}" width="50" height="${height}" rx="3"/><text x="${37+index*64}" y="137" text-anchor="middle">${labels[index]}</text></g>`;}).join('')}</svg>`;
  root.append(chart);
  const selection=document.createElement('p');selection.className='distribution-selection';selection.setAttribute('role','status');root.append(selection);
  selectDistributionPrice(root,price);
  const readout=document.createElement('p');readout.className='distribution-readout';readout.setAttribute('role','status');readout.textContent='Hover, tap, or focus a bar for its share of homes.';root.append(readout);
  chart.querySelectorAll('[data-price-bin]').forEach(bar=>{
    const show=()=>{const bin=data.bins[+bar.dataset.priceBin];readout.textContent=`${bin.label} · ${bin.percent.toFixed(1)}% · ${bin.count.toLocaleString('en-US')} homes`;};
    bar.onpointerover=show;bar.onfocus=show;bar.onclick=show;
    bar.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}};
  });
  const provenance=document.createElement('p');provenance.className='source-note';
  const link=document.createElement('a');link.href=data.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Census ACS '+data.period;
  provenance.append(link,document.createTextNode(' via Census Reporter · Estimated owner-occupied home values, not listing or sale prices.'));root.append(provenance);
}
