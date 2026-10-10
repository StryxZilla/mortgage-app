import { amortizationSchedule, calculateMortgage } from './mortgage.js';
import { mapStates } from './us-map.js?v=maps-3';
import { mapMarkup, bindMap, closeStateMap, zipCount } from './map-ui.js?v=maps-3';

const stateNames = Object.fromEntries(mapStates.map(s=>[s.code,s.name]));
let selectedState = 'CA';
let selectedZip = '94107';
let details = { price: 680000, down: 20, rate: 6.25, term: 30, tax: 1.1, insurance: 180, hoa: 0, pmiRate: .55, extra: 0, appreciation: 3 };

function money(n, digits=0) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:digits}).format(n); }
function payment() { const result = calculateMortgage(details); return { ...result, pi: result.principalAndInterest, tax: result.propertyTax }; }
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
            <label class="state-select">Choose a state<select aria-label="Choose a state"><option value="">Select a state</option>${mapStates.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(s=>`<option value="${s.code}">${s.name}</option>`).join('')}</select></label>
          </div>
          <div class="map-wrap" id="mapWrap">
            <div class="geographic-map">${mapMarkup(selectedState)}</div>
            <div class="map-label"><strong>Choose a state</strong><span>Select anywhere on the map to begin</span></div>
            <div class="compass">N<br><span>✣</span></div>
            <div class="map-controls"><button aria-label="Zoom in">+</button><button aria-label="Zoom out">−</button><button aria-label="Reset US map">⌂</button></div>
          </div>
          <div class="map-foot"><span>✦ Rates and estimates tailored to your location</span><span>50 states · ${zipCount.toLocaleString('en-US')} ZIP locations</span></div>
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
    <div class="zip-panel" role="dialog" aria-modal="true" aria-labelledby="state-title" inert>
      <button class="close-panel" aria-label="Close state map">×</button>
      <div class="state-panel-head"><span class="step">02</span><div><p class="mini">EXPLORE THE STATE</p><h2 id="state-title">${stateNames[selectedState]}</h2></div></div>
      <p class="state-instructions">Choose a ZIP on the map, or search by city or ZIP code.</p>
      <div class="state-explorer">
        <div class="state-map-card"><div class="state-map-stage"></div><div class="state-map-controls"><button aria-label="Zoom into state">+</button><button aria-label="Zoom out of state">−</button><button aria-label="Reset state map">⌂</button></div><p class="state-map-hint">Dots show ZIP locations. Select a numbered group to zoom in.</p></div>
        <div class="zip-browser"><label for="zip-search">Find your ZIP code</label><input id="zip-search" type="search" placeholder="City or ZIP code" autocomplete="off"><p class="zip-result-count" role="status"></p><div class="zip-results"></div><p class="zip-source-note">Approximate ZIP centers, not ZIP boundaries.</p></div>
      </div>
    </div>
    <div class="calc-modal" role="dialog" aria-modal="true" aria-label="Mortgage details" inert>
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
  bindMap((code,zip)=>{selectedState=code;openCalculator(zip);});
  document.querySelector('.close-panel').onclick=closeAll; document.querySelector('.overlay').onclick=closeAll;
  document.querySelector('.close-modal').onclick=closeAll; document.querySelector('.edit').onclick=()=>openCalculator(selectedZip);
  document.querySelector('.calc-modal').onkeydown=e=>{
    if(e.key==='Escape'){closeAll();return;}
    if(e.key==='Tab'){
      const controls=[...document.querySelectorAll('.calc-modal button,.calc-modal input')];
      if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1).focus();}
      else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0].focus();}
    }
  };
  document.querySelector('.details-btn').onclick=()=>document.querySelector('.data-drawer').classList.add('open');
  document.querySelector('.close-drawer').onclick=()=>document.querySelector('.data-drawer').classList.remove('open');
  ['price','down','rate'].forEach(id=>document.querySelector('#'+id)?.addEventListener('input', updateOutput));
  document.querySelectorAll('.terms button').forEach(b=>b.onclick=()=>{details.term=+b.dataset.term; document.querySelectorAll('.terms button').forEach(x=>x.classList.toggle('active',x===b));});
  document.querySelector('.calculate').onclick=()=>{ readDetails(); app(); setTimeout(()=>document.querySelector('.data-drawer').classList.add('open'),20); };
  document.querySelectorAll('[data-compare]').forEach(b=>b.onclick=()=>{details.term=+b.dataset.compare; app(); setTimeout(()=>document.querySelector('.data-drawer').classList.add('open'),20);});
  document.querySelector('.save-btn').onclick=()=>{const b=document.querySelector('.save-btn'); b.innerHTML='Saved ✓'; setTimeout(()=>b.innerHTML='Save my scenario <span>↗</span>',1800)};
}
function openCalculator(zip){
  selectedZip=zip;
  document.querySelector('.location').textContent=`${stateNames[selectedState]} · ${selectedZip}`;
  closeStateMap(false);
  const modal=document.querySelector('.calc-modal');
  document.querySelectorAll('header,main').forEach(el=>el.inert=true);
  modal.inert=false; modal.classList.add('open');
  document.querySelector('.overlay').classList.add('open');
  document.querySelector('.close-modal').focus();
}
function closeAll(){
  document.querySelectorAll('.overlay,.zip-panel,.calc-modal').forEach(x=>x.classList.remove('open'));
  document.querySelector('.calc-modal').inert=true;
  closeStateMap();
}
function updateOutput(){const price=+document.querySelector('#price').value, down=+document.querySelector('#down').value, rate=+document.querySelector('#rate').value; document.querySelector('#priceOut').textContent=money(price); document.querySelector('#downOut').textContent=`${down}% · ${money(price*down/100)}`; document.querySelector('#rateOut').textContent=`${rate.toFixed(2)}%`;}
function readDetails(){ ['price','down','rate','tax','insurance','hoa','extra'].forEach(key => { details[key]=+document.querySelector(`#${key}`).value; }); }
app();
