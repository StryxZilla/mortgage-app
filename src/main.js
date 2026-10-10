import { amortizationSchedule, calculateMortgage } from './mortgage.js';
import { mapStates } from './us-map.js';

const states = [
  ['WA',1,1],['MT',3,1],['ND',5,1],['MN',6,1],['WI',7,1],['MI',8,1],['VT',10,1],['ME',11,1],
  ['OR',1,2],['ID',2,2],['WY',3,2],['SD',5,2],['IA',6,2],['IL',7,2],['IN',8,2],['OH',9,2],['PA',10,2],['NY',11,2],['NH',12,2],
  ['CA',1,3],['NV',2,3],['UT',3,3],['CO',4,3],['NE',5,3],['MO',6,3],['KY',8,3],['WV',9,3],['VA',10,3],['MD',11,3],['NJ',12,3],['MA',13,3],
  ['AZ',2,4],['NM',3,4],['KS',5,4],['AR',6,4],['TN',8,4],['NC',10,4],['SC',11,4],['DE',12,4],['CT',13,4],['RI',14,4],
  ['AK',0,5],['HI',1,5],['TX',4,5],['OK',5,5],['LA',6,5],['MS',7,5],['AL',8,5],['GA',9,5],['FL',11,5]
];

const stateNames = Object.fromEntries(`AL Alabama|AK Alaska|AZ Arizona|AR Arkansas|CA California|CO Colorado|CT Connecticut|DE Delaware|FL Florida|GA Georgia|HI Hawaii|ID Idaho|IL Illinois|IN Indiana|IA Iowa|KS Kansas|KY Kentucky|LA Louisiana|ME Maine|MD Maryland|MA Massachusetts|MI Michigan|MN Minnesota|MS Mississippi|MO Missouri|MT Montana|NE Nebraska|NV Nevada|NH New Hampshire|NJ New Jersey|NM New Mexico|NY New York|NC North Carolina|ND North Dakota|OH Ohio|OK Oklahoma|OR Oregon|PA Pennsylvania|RI Rhode Island|SC South Carolina|SD South Dakota|TN Tennessee|TX Texas|UT Utah|VT Vermont|VA Virginia|WA Washington|WV West Virginia|WI Wisconsin|WY Wyoming`.split('|').map(item => item.split(/ (.*)/s).slice(0,2)));
const zipSeeds = { CA:['94107','90210','92101','95814'], NY:['10001','11201','12207','14604'], TX:['75201','77002','78701','78205'], FL:['33131','32801','33602','32202'], WA:['98101','99201','98402','98660'] };
let selectedState = 'CA';
let selectedZip = '94107';
let details = { price: 680000, down: 20, rate: 6.25, term: 30, tax: 1.1, insurance: 180, hoa: 0, pmiRate: .55, extra: 0, appreciation: 3 };

function money(n, digits=0) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:digits}).format(n); }
function payment() { const result = calculateMortgage(details); return { ...result, pi: result.principalAndInterest, tax: result.propertyTax }; }
function zipsForState(code) { return zipSeeds[code] || states.filter(([state]) => state === code).map((_, i) => `${String(states.findIndex(([state]) => state === code) + 10).padStart(2,'0')}${String(101 + i * 73).padStart(3,'0')}`).concat(['10101','20202','30303','40404']); }

function mapMarkup() {
  return `<svg class="us-map" viewBox="0 0 960 600" aria-label="United States: choose a state"><g class="map-geography">${mapStates.map(s=>`<path class="geo-state ${s.code===selectedState?'active':''}" d="${s.path}" data-state="${s.code}" tabindex="0" role="button" aria-label="Select ${s.name}" aria-pressed="${s.code===selectedState}"><title>${s.name}</title></path>`).join('')}${mapStates.map(s=>`<text class="state-label" x="${s.center[0]}" y="${s.center[1]}" ${['RI','DE','MD','NJ','CT','MA'].includes(s.code)?'font-size="8"':''}>${s.code}</text>`).join('')}</g></svg>`;
}

function app() {
  const p = payment();
  document.querySelector('#app').innerHTML = `
    <header>
      <a class="brand" href="#"><span class="brand-mark">⌂</span><span>haven</span></a>
      <nav><a class="active" href="#calculator">Mortgage calculator</a><a class="homes" href="#homes">Browse homes <em>Coming soon</em></a><a href="#learn">Learn</a></nav>
      <button class="save-btn">Save my scenario <span>↗</span></button>
    </header>
    <main>
      <section class="intro">
        <div class="eyebrow"><span></span> YOUR HOME, IN FOCUS</div>
        <h1>Find the place.<br><i>Know the payment.</i></h1>
        <p>Explore the map to get a mortgage estimate shaped by the place you want to call home.</p>
      </section>
      <section class="workspace">
        <div class="map-card">
          <div class="map-top">
            <div><span class="step">01</span><h2>Where are you looking?</h2></div>
            <div class="search"><span>⌕</span><input aria-label="Search by city or ZIP" placeholder="Search city or ZIP"/><kbd>⌘ K</kbd></div>
          </div>
          <div class="map-wrap" id="mapWrap">
            <div class="geographic-map">${mapMarkup()}</div>
            <div class="map-label"><strong>Choose a state</strong><span>Select anywhere on the map to begin</span></div>
            <div class="compass">N<br><span>✣</span></div>
            <div class="map-controls"><button aria-label="Zoom in">+</button><button aria-label="Zoom out">−</button></div>
          </div>
          <div class="map-foot"><span>✦ Rates and estimates tailored to your location</span><span>50 states · 32,000 ZIP codes</span></div>
        </div>
        <aside class="estimate-card">
          <div class="estimate-head"><div><span class="dot"></span> LIVE ESTIMATE</div><button class="edit" title="Edit details">✎</button></div>
          <p class="location">${stateNames[selectedState]||selectedState} · ${selectedZip}</p>
          <div class="total"><small>ESTIMATED MONTHLY</small><strong>${money(p.total)}</strong><span>/ month</span></div>
          <div class="payment-bar"><i style="width:${p.pi/p.total*100}%"></i><b style="width:${p.tax/p.total*100}%"></b><em></em></div>
          <div class="legend">
            <div><i class="lav"></i><span>Principal & interest</span><strong>${money(p.pi)}</strong></div>
            <div><i class="mint"></i><span>Property tax</span><strong>${money(p.tax)}</strong></div>
            <div><i class="gold"></i><span>Home insurance</span><strong>${money(p.insurance)}</strong></div>
            ${p.pmi ? `<div><i class="rose"></i><span>Mortgage insurance</span><strong>${money(p.pmi)}</strong></div>` : ''}
            ${p.hoa ? `<div><i class="blue"></i><span>HOA dues</span><strong>${money(p.hoa)}</strong></div>` : ''}
          </div>
          <button class="details-btn">View full breakdown <span>→</span></button>
          <div class="scenario"><span>Based on</span><strong>${money(details.price)} home · ${details.down}% down<br>${details.term}-year fixed at ${details.rate}%</strong></div>
        </aside>
      </section>
      <section class="trust"><div><strong>Built for clarity.</strong><span>No lender bias. No confusing fine print. Just the numbers you need.</span></div><div class="trust-items"><span>✓ Live rate estimates</span><span>✓ Location-aware taxes</span><span>✓ Private by default</span></div></section>
    </main>
    <div class="overlay" aria-hidden="true"></div>
    <div class="zip-panel" role="dialog" aria-modal="true" aria-label="Select a ZIP code">
      <button class="close-panel" aria-label="Close">×</button>
      <span class="step">02</span><p class="mini">ZOOMING INTO</p><h2>${stateNames[selectedState]||selectedState}</h2><p>Choose the neighborhood you’re considering.</p>
      <div class="state-shape">${zipsForState(selectedState).slice(0,4).map((zip,i)=>`<button class="zip-dot z${i+1}" data-zip="${zip}">${zip}</button>`).join('')}</div>
    </div>
    <div class="calc-modal" role="dialog" aria-modal="true" aria-label="Mortgage details">
      <button class="close-modal" aria-label="Close">×</button><span class="step">03</span><p class="mini">YOUR NUMBERS</p><h2>Shape your mortgage</h2>
      <div class="field"><label>Home price <output id="priceOut">${money(details.price)}</output></label><input id="price" type="range" min="200000" max="1500000" step="10000" value="${details.price}"></div>
      <div class="field"><label>Down payment <output id="downOut">${details.down}% · ${money(details.price*details.down/100)}</output></label><input id="down" type="range" min="3" max="50" value="${details.down}"></div>
      <div class="field"><label>Interest rate <output id="rateOut">${details.rate}%</output></label><input id="rate" type="range" min="3" max="10" step="0.05" value="${details.rate}"></div>
      <div class="input-grid"><label>Property tax <span><input id="tax" type="number" min="0" step=".1" value="${details.tax}"> % / yr</span></label><label>Insurance <span>$ <input id="insurance" type="number" min="0" step="10" value="${details.insurance}"> / mo</span></label><label>HOA dues <span>$ <input id="hoa" type="number" min="0" step="25" value="${details.hoa}"> / mo</span></label><label>Extra payment <span>$ <input id="extra" type="number" min="0" step="50" value="${details.extra}"> / mo</span></label></div>
      <label class="term-label">Loan term</label><div class="terms">${[15,20,30].map(t=>`<button class="${t===details.term?'active':''}" data-term="${t}">${t} year</button>`).join('')}</div>
      <button class="calculate">See my estimate <span>→</span></button>
    </div>
    <div class="data-drawer">
      <button class="close-drawer" aria-label="Close">×</button><p class="mini">THE LONG VIEW</p><h2>Your path to ownership</h2>
      <div class="drawer-stat"><span>Monthly payment</span><strong>${money(p.total)}</strong></div>
      <div class="chart-head"><span>Equity over time</span><strong>Home equity</strong></div><div class="chart" id="chart">${chartSvg()}</div>
      <div class="compare"><h3>Compare loan terms</h3>${[15,20,30].map(term => compareRow(term)).join('')}</div>
    </div>`;
  bind();
}

function chartSvg(){ const schedule=amortizationSchedule(details); const sampled=schedule.filter((_,i)=>i%Math.max(1,Math.ceil(schedule.length/12))===0||i===schedule.length-1); const max=Math.max(...sampled.map(p=>p.homeValue)); const pts=sampled.map((p,i)=>`${i/(sampled.length-1)*420},${180-p.equity/max*165}`).join(' '); return `<svg viewBox="0 0 430 205"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b4a7f8" stop-opacity=".55"/><stop offset="1" stop-color="#b4a7f8" stop-opacity="0"/></linearGradient></defs><path d="M0 180 L${pts.replaceAll(' ',', L')} L420 190 L0 190Z" fill="url(#fill)"/><polyline points="${pts}" fill="none" stroke="#7364d9" stroke-width="4" stroke-linecap="round"/><g class="axis"><text x="0" y="204">Now</text><text x="130" y="204">10 yr</text><text x="270" y="204">20 yr</text><text x="390" y="204">${details.term} yr</text></g></svg>`; }
function compareRow(term){ const old=details.term; details.term=term; const val=payment().total; details.term=old; return `<button class="compare-row ${term===old?'active':''}" data-compare="${term}"><span>${term}-year fixed<small>${details.rate}% rate</small></span><strong>${money(val)}<small>/mo</small></strong></button>`; }

function bind(){
  document.querySelectorAll('.geo-state').forEach(el=>{
    el.onclick=()=>openState(el.dataset.state);
    el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openState(el.dataset.state);}};
  });
  let mapScale=1;
  document.querySelectorAll('.map-controls button').forEach((button,i)=>button.onclick=()=>{mapScale=Math.max(1,Math.min(2,mapScale+(i===0?.25:-.25)));document.querySelector('.map-geography').style.transform=`scale(${mapScale})`;});
  document.querySelector('.close-panel').onclick=closeAll; document.querySelector('.overlay').onclick=closeAll;
  document.querySelectorAll('.zip-dot').forEach(el=>el.onclick=()=>openCalculator(el.dataset.zip));
  document.querySelector('.close-modal').onclick=closeAll; document.querySelector('.edit').onclick=()=>openCalculator(selectedZip);
  document.querySelector('.details-btn').onclick=()=>document.querySelector('.data-drawer').classList.add('open');
  document.querySelector('.close-drawer').onclick=()=>document.querySelector('.data-drawer').classList.remove('open');
  ['price','down','rate'].forEach(id=>document.querySelector('#'+id)?.addEventListener('input', updateOutput));
  document.querySelectorAll('.terms button').forEach(b=>b.onclick=()=>{details.term=+b.dataset.term; document.querySelectorAll('.terms button').forEach(x=>x.classList.toggle('active',x===b));});
  document.querySelector('.calculate').onclick=()=>{ readDetails(); app(); setTimeout(()=>document.querySelector('.data-drawer').classList.add('open'),20); };
  document.querySelectorAll('[data-compare]').forEach(b=>b.onclick=()=>{details.term=+b.dataset.compare; app(); setTimeout(()=>document.querySelector('.data-drawer').classList.add('open'),20);});
  document.querySelector('.save-btn').onclick=()=>{const b=document.querySelector('.save-btn'); b.innerHTML='Saved ✓'; setTimeout(()=>b.innerHTML='Save my scenario <span>↗</span>',1800)};
}
function openState(code){ selectedState=code; document.querySelector('.zip-panel h2').textContent=stateNames[code]||code; const region=mapStates.find(s=>s.code===code); const [[x0,y0],[x1,y1]]=region.bounds; document.querySelector('.state-shape').innerHTML=`<svg class="selected-state-map" viewBox="${x0-10} ${y0-10} ${x1-x0+20} ${y1-y0+20}" aria-label="${region.name} outline"><path d="${region.path}" /></svg><div class="zip-options">`+zipsForState(code).slice(0,4).map((zip,i)=>`<button class="zip-dot z${i+1}" data-zip="${zip}">${zip}</button>`).join('')+'</div>'; document.querySelectorAll('.geo-state').forEach(el=>{el.classList.toggle('active',el.dataset.state===code);el.setAttribute('aria-pressed',el.dataset.state===code);}); document.querySelectorAll('.zip-dot').forEach(el=>el.onclick=()=>openCalculator(el.dataset.zip)); document.querySelector('.map-wrap').classList.add('zooming'); document.querySelector('.overlay').classList.add('open'); setTimeout(()=>document.querySelector('.zip-panel').classList.add('open'),250); }
function openCalculator(zip){selectedZip=zip; document.querySelector('.zip-panel').classList.remove('open'); document.querySelector('.calc-modal').classList.add('open');}
function closeAll(){document.querySelectorAll('.overlay,.zip-panel,.calc-modal').forEach(x=>x.classList.remove('open')); document.querySelector('.map-wrap')?.classList.remove('zooming');}
function updateOutput(){const price=+document.querySelector('#price').value, down=+document.querySelector('#down').value, rate=+document.querySelector('#rate').value; document.querySelector('#priceOut').textContent=money(price); document.querySelector('#downOut').textContent=`${down}% · ${money(price*down/100)}`; document.querySelector('#rateOut').textContent=`${rate.toFixed(2)}%`;}
function readDetails(){ ['price','down','rate','tax','insurance','hoa','extra'].forEach(key => { details[key]=+document.querySelector(`#${key}`).value; }); }
app();
