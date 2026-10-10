import { calculateMortgage } from './mortgage.js';
import { mapStates } from './us-map.js?v=maps-3';
import { mapMarkup, bindMap, closeStateMap, zipCount } from './map-ui.js?v=cities-1';
import { getZipHomeValue } from './home-values.js?v=home-values-2';
import { getZipPropertyTax, estimateTaxPercent } from './property-taxes.js?v=estimates-1';
import { getInsuranceBenchmarks, estimateInsurance } from './insurance.js';
import { equityChartMarkup, bindEquityChart } from './equity-chart.js';
import { nearbyDefaults, regionalDefaults } from './area-estimates.js';
import { getPriceDistribution, renderPriceDistribution, selectDistributionPrice } from './price-distribution.js?v=selection-1';
import { getMortgageRates, rateForTerm, isRateStale } from './rates.js';
import { rateModalMarkup, bindRateModal } from './rate-modal.js?v=rates-taxes-2';

const stateNames = Object.fromEntries(mapStates.map(s=>[s.code,s.name]));
let selectedState = '';
let selectedZip = '';
let mapSelection = null;
let details = { price: 0, down: 20, rate: 0, term: 30, tax: null, taxMode: 'percent', annualTax: null, insurance: 0, dwellingCoverage: 400000, hoa: 0, pmiRate: .55, extra: 0, appreciation: 3 };
let homeValue = { status: 'idle', zip: null, data: null };
let homeValueRequest = 0, priceEdited = false;
let taxState = { status: 'idle', zip: null, data: null }, taxRequest = 0, taxEdited = false;
let rates = { status: 'idle', data: null }, rateMode = 'benchmark';
let insuranceState = { status:'idle', data:null }, insuranceMode = 'estimate';
let distributionState={status:'idle',selectedZip,data:null},distributionRequest=0;

function money(n, digits=0) { return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:digits}).format(n); }
function payment() { const result = calculateMortgage(details); return { ...result, pi: result.principalAndInterest, tax: result.propertyTax }; }
function app() {
  homeValueRequest++;
  const p = payment();
  document.querySelector('#app').innerHTML = `
    <header>
      <a class="brand" href="#"><span class="brand-mark">⌂</span><span>haven</span></a>
      <nav><a class="active" href="#calculator">Mortgage calculator</a><a class="homes" href="#homes">Browse homes <em>Coming soon</em></a><a href="#learn">Learn</a></nav>
    </header>
    <main>
      <section class="intro">
        <div class="eyebrow"><span></span> YOUR HOME, IN FOCUS</div>
        <h1>Find the place.<br><i>Know the payment.</i></h1>
        <p>Explore local home values and property taxes, with weekly mortgage-rate benchmarks to guide your estimate.</p>
      </section>
      <section class="workspace">
        <div class="map-card">
          <div class="map-top">
            <div><span class="step">01</span><h2>Where are you looking?</h2></div>
            <label class="state-select">Choose a state<select aria-label="Choose a state"><option value="">Select a state</option>${mapStates.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(s=>`<option value="${s.code}">${s.name}</option>`).join('')}</select></label>
          </div>
          <div class="map-wrap" id="mapWrap">
            <div class="geographic-map">${mapMarkup(mapSelection)}</div>
            <div class="map-label"><strong>Choose a state</strong><span>Tap a state · Drag to pan · Pinch to zoom</span></div>
            <div class="compass">N<br><span>✣</span></div>
            <div class="map-controls"><button aria-label="Zoom in">+</button><button aria-label="Zoom out">−</button><button aria-label="Reset US map">⌂</button></div>
          </div>
          <div class="map-foot"><span>✦ Census ZIP values & taxes</span><span>50 states · ${zipCount.toLocaleString('en-US')} ZIP locations</span></div>
        </div>
        <aside class="estimate-card">
          <div class="estimate-empty" ${selectedZip?'hidden':''}><span aria-hidden="true">⌂</span><h2>Your estimate starts here</h2><p>Choose a state, explore a city, and select a ZIP code to see your mortgage estimate.</p></div>
          <div class="estimate-content" ${selectedZip?'':'hidden'}>
          <div class="estimate-head"><div><span class="dot"></span> PAYMENT ESTIMATE</div><button class="edit" title="Edit details">✎</button></div>
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
          <p class="price-summary" role="status"></p>
          <button class="rate-trends rate-card-button">↗ Rate trends <span>Weekly history</span></button>
          <p class="estimate-assumptions" role="status"></p>
          </div>
        </aside>
      </section>
      <section class="trust"><div><strong>Make it your estimate.</strong><span>Adjust the defaults to match your lender quote and property.</span></div><div class="trust-items"><span>✓ Census ZIP home values & taxes</span><span>✓ Weekly rate benchmarks</span><span>✓ Compare loan terms</span></div></section>
    </main>
    <div class="overlay" aria-hidden="true"></div>
    <div class="zip-panel" role="dialog" aria-modal="true" aria-labelledby="state-title" inert>
      <button class="close-panel" aria-label="Close state map">×</button>
      <div class="state-panel-head"><span class="step">02</span><div><p class="mini">EXPLORE THE STATE</p><h2 id="state-title">${stateNames[selectedState]}</h2></div></div>
      <p class="state-instructions">Select an outlined ZIP area, or search by city or ZIP code.</p>
      <div class="city-shortcuts" role="group" aria-label="City shortcuts"></div>
      <div class="state-explorer">
        <div class="state-map-card"><div class="state-map-stage"></div><div class="state-map-controls"><button aria-label="Zoom into state">+</button><button aria-label="Zoom out of state">−</button><button aria-label="Reset state map">⌂</button></div><p class="state-map-hint"><span class="city-map-key" aria-hidden="true"></span> Purple ZIPs overlap shortcut cities. Pinch to zoom; drag to pan.</p></div>
        <div class="zip-browser"><label for="zip-search">Find your ZIP code</label><input id="zip-search" type="search" placeholder="City or ZIP code" autocomplete="off"><p class="zip-result-count" role="status"></p><div class="zip-results"></div><p class="zip-source-note">Census ZIP areas (2010). Postal ZIPs without mapped areas remain searchable.</p></div>
      </div>
    </div>
    <div class="calc-modal" role="dialog" aria-modal="true" aria-label="Mortgage details" inert>
      <button class="close-modal" aria-label="Close">×</button><span class="step">03</span><p class="mini">YOUR NUMBERS</p><h2>Shape your mortgage</h2>
      <p class="calc-assumptions">Start with sourced defaults. Your lender quote and the home's assessed value and exemptions determine your actual rate and tax bill.</p>
      <div class="field price-field"><label for="priceAmount">Home price <output id="priceOut" for="price priceAmount">${money(details.price)}</output></label><div class="price-amount"><span aria-hidden="true">$</span><input id="priceAmount" type="number" min="1" max="100000000" step="1" inputmode="numeric" required placeholder="Enter home price" aria-label="Home price in dollars" value="${details.price}"></div><input id="price" type="range" min="1" max="${Math.max(1500000,Math.ceil(details.price*1.25/100000)*100000)}" step="1" value="${details.price}" aria-label="Home price slider"><p class="price-source" role="status" aria-live="polite"></p></div>
      <div class="price-distribution"></div>
      <div class="field"><label>Down payment <output id="downOut">${details.down}% · ${money(details.price*details.down/100)}</output></label><input id="down" type="range" min="3" max="50" value="${details.down}"></div>
      <div class="field"><label for="rate">Interest rate <output id="rateOut">${details.rate.toFixed(2)}%</output></label><input id="rate" type="range" min="0" max="20" step="0.01" value="${details.rate}"><div class="rate-actions"><button class="rate-trends">↗ Rate trends</button><button class="use-benchmark">Use weekly benchmark</button></div><p class="rate-source source-note" role="status"></p></div>
      <div class="tax-field"><label for="tax">Property tax <select id="taxMode" aria-label="Property tax input format"><option value="percent" ${details.taxMode==='percent'?'selected':''}>Percent of home price</option><option value="annual" ${details.taxMode==='annual'?'selected':''}>Annual bill ($)</option></select></label><div class="tax-amount"><span class="tax-prefix">${details.taxMode==='annual'?'$':''}</span><input id="tax" type="number" min="0" max="100000000" step="any" required placeholder="Enter tax percentage" value="${details.taxMode==='annual'?(details.annualTax??''):(details.tax??'')}" aria-label="Property tax"><span class="tax-unit">${details.taxMode==='annual'?'/ yr':'% of price / yr'}</span></div><p class="tax-payment-note"></p><p class="tax-source source-note" role="status" aria-live="polite"></p><button class="use-zip-tax">Use ZIP tax estimate</button></div>
      <div class="insurance-field"><div class="insurance-heading"><label for="insurance">Home insurance</label><button class="use-insurance-estimate">Use state estimate</button></div><div class="input-grid"><label for="dwellingCoverage">Dwelling rebuild coverage <span>$ <input id="dwellingCoverage" type="number" min="1" max="100000000" step="any" value="${details.dwellingCoverage}" required></span></label><label for="insurance">Monthly premium <span>$ <input id="insurance" type="number" min="0" max="1000000" step="any" value="${insuranceMode==='estimate'&&!insuranceState.data?'':details.insurance}" required> / mo</span></label></div><p class="insurance-source source-note" role="status" aria-live="polite"></p></div>
      <div class="input-grid"><label>HOA dues <span>$ <input id="hoa" type="number" min="0" step="25" value="${details.hoa}"> / mo</span></label><label>Extra payment <span>$ <input id="extra" type="number" min="0" step="50" value="${details.extra}"> / mo</span></label><label>Home appreciation <span><input id="appreciation" type="number" min="-20" max="20" step="any" value="${details.appreciation}"> % / yr</span></label></div>
      <label class="term-label">Loan term</label><div class="terms">${[15,20,30].map(t=>`<button class="${t===details.term?'active':''}" data-term="${t}">${t} year</button>`).join('')}</div>
      <button class="calculate">See my estimate <span>→</span></button>
    </div>
    <div class="data-drawer">
      <button class="close-drawer" aria-label="Close">×</button><p class="mini">THE LONG VIEW</p><h2>Your path to ownership</h2>
      <div class="drawer-stat"><span>Monthly payment</span><strong>${money(p.total)}</strong></div>
      <div class="chart-head"><span>Equity over time</span><strong>Home equity</strong></div><div class="chart" id="chart">${chartSvg()}</div>
      <div class="compare"><h3>Compare loan terms</h3>${[15,20,30].map(term => compareRow(term)).join('')}</div>
    </div>${rateModalMarkup()}`;
  bind();
}

function chartSvg(){ return equityChartMarkup(details); }
function compareRow(term){ const rate=rateMode==='benchmark'&&rates.data?rateForTerm(rates.data,term):details.rate; const val=calculateMortgage({...details,term,rate}).total; return `<button class="compare-row ${term===details.term?'active':''}" data-compare="${term}"><span>${term}-year fixed<small>${rate.toFixed(2)}% · ${rateMode==='manual'?'your rate':term===20?'30-year proxy':'weekly benchmark'}</small></span><strong>${money(val)}<small>/mo</small></strong></button>`; }

function bind(){
  bindMap((code,zip)=>{selectedState=code;mapSelection=code;openCalculator(zip,true);});
  document.querySelector('.close-panel').onclick=closeAll; document.querySelector('.overlay').onclick=closeAll;
  document.querySelector('.close-modal').onclick=closeAll; document.querySelector('.edit').onclick=()=>openCalculator(selectedZip);
  document.querySelector('.calc-modal').onkeydown=e=>{
    if(e.key==='Escape'){closeAll();return;}
    if(e.key==='Tab'){
      const controls=[...document.querySelectorAll('.calc-modal button,.calc-modal input,.calc-modal select,.calc-modal a[href]')].filter(el=>!el.disabled);
      if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1).focus();}
      else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0].focus();}
    }
  };
  document.querySelector('.details-btn').onclick=()=>document.querySelector('.data-drawer').classList.add('open');
  document.querySelector('.close-drawer').onclick=()=>document.querySelector('.data-drawer').classList.remove('open');
  document.querySelector('#down').oninput=e=>{details.down=+e.target.value;updateOutput();refreshPriceEstimate();renderPriceSource();};
  document.querySelector('#rate').oninput=e=>{rateMode='manual';details.rate=+e.target.value;updateOutput();refreshPriceEstimate();renderDataSources();renderPriceSource();};
  document.querySelector('.use-benchmark').onclick=useBenchmark;
  bindRateModal({getRates:()=>rates, onUse:useBenchmark, onRetry:startRates});
  document.querySelector('#tax').oninput=e=>{taxEdited=true;taxState.status='manual';details[details.taxMode==='annual'?'annualTax':'tax']=e.target.value!==''&&e.target.validity.valid?+e.target.value:null;renderDataSources();refreshPriceEstimate();renderPriceSource();};
  document.querySelector('#taxMode').onchange=e=>{
    const hasTax=document.querySelector('#tax').value!=='';
    const annual=details.taxMode==='annual'?(details.annualTax??0):details.price*details.tax/100;
    details.taxMode=e.target.value;
    details.annualTax=hasTax?annual:null;details.tax=hasTax&&details.price>0?+(annual/details.price*100).toFixed(5):null;
    if(!hasTax&&details.taxMode==='annual'&&taxState.data){details.annualTax=taxState.data.annualTax;}
    if(hasTax){taxEdited=true;taxState.status='manual';}syncTaxInput();renderDataSources();refreshPriceEstimate();renderPriceSource();
  };
  document.querySelector('.use-zip-tax').onclick=()=>{if(taxState.data){taxEdited=false;taxState.status='loaded';details.taxMode='percent';details.tax=null;applyZipTaxDefault();syncTaxInput();refreshPriceEstimate();renderDataSources();}else startTaxLookup(selectedZip);};
  document.querySelector('#insurance').oninput=e=>{insuranceMode='manual';details.insurance=e.target.value!==''&&e.target.validity.valid?+e.target.value:0;renderInsuranceSource();refreshPriceEstimate();};
  document.querySelector('#dwellingCoverage').oninput=e=>{details.dwellingCoverage=+e.target.value;if(insuranceMode==='estimate')applyInsuranceEstimate();renderInsuranceSource();refreshPriceEstimate();};
  document.querySelector('.use-insurance-estimate').onclick=()=>{insuranceMode='estimate';if(insuranceState.data){applyInsuranceEstimate();renderInsuranceSource();refreshPriceEstimate();}else startInsurance();};
  ['hoa','extra','appreciation'].forEach(id=>document.querySelector('#'+id).oninput=e=>{details[id]=+e.target.value;refreshPriceEstimate();renderPriceSource();});
  document.querySelector('#price').oninput=e=>{setPriceControls(+e.target.value);markPriceEdited();};
  document.querySelector('#priceAmount').oninput=e=>{
    markPriceEdited();
    if(e.target.validity.valid&&e.target.value)setPriceControls(+e.target.value);
  };
  document.querySelectorAll('.terms button').forEach(b=>b.onclick=()=>{selectTerm(+b.dataset.term); document.querySelectorAll('.terms button').forEach(x=>x.classList.toggle('active',x===b));});
  document.querySelector('.calculate').onclick=()=>{ if(![...document.querySelectorAll('.calc-modal input')].every(input=>input.reportValidity()))return; readDetails(); app(); setTimeout(()=>document.querySelector('.data-drawer').classList.add('open'),20); };
  bindComparisons();
  renderPriceSource();
  renderDataSources();
  renderInsuranceSource();
  bindEquityChart(details);
  renderDistribution();
}
function openCalculator(zip,useMedian=false){
  homeValueRequest++;
  selectedZip=zip;
  document.querySelector('.estimate-empty').hidden=true;
  document.querySelector('.estimate-content').hidden=false;
  if(rates.status==='idle')startRates();
  if(insuranceState.status==='idle')startInsurance();
  document.querySelector('.location').textContent=`${stateNames[selectedState]} · ${selectedZip}`;
  closeStateMap(false);
  const modal=document.querySelector('.calc-modal');
  document.querySelectorAll('header,main').forEach(el=>el.inert=true);
  modal.inert=false; modal.classList.add('open');
  modal.scrollTop=0;
  document.querySelector('.overlay').classList.add('open');
  document.querySelector('.close-modal').focus({preventScroll:true});
  const needsMedian=useMedian||homeValue.zip!==zip||['idle','loading','cancelled','error'].includes(homeValue.status);
  if(useMedian||distributionState.selectedZip!==zip)startDistribution(zip);
  if(insuranceMode==='estimate'){applyInsuranceEstimate();renderInsuranceSource();}
  if(useMedian||taxState.zip!==zip||['idle','error'].includes(taxState.status))startTaxLookup(zip);
  if(!needsMedian){renderPriceSource();return;}
  startMedianLookup(zip,true);
}
function startMedianLookup(zip,requireOpen=false){
  const requestId=++homeValueRequest;
  priceEdited=false;
  homeValue={status:'loading',zip,data:null};
  document.querySelector('#priceAmount').value='';
  document.querySelector('#priceAmount').defaultValue='';
  document.querySelector('#priceOut').textContent='Loading…';
  renderPriceSource();
  getZipHomeValue(zip).then(async data=>{
    if(!data)data=(await nearbyDefaults(zip,selectedState)).home;
    if(requestId!==homeValueRequest||zip!==selectedZip||(requireOpen&&!document.querySelector('.calc-modal').classList.contains('open')))return;
    homeValue={status:priceEdited?'manual':data?'loaded':'unavailable',zip,data};
    applyZipTaxDefault();
    if(data&&!priceEdited)setPriceControls(data.value);
    if(!data&&!priceEdited)document.querySelector('#priceOut').textContent='Enter home price';
    renderPriceSource();
    renderDataSources();
  }).catch(async()=>{
    let data;try{data=(await nearbyDefaults(zip,selectedState)).home;}catch{data=regionalDefaults(zip,selectedState).home;}
    if(requestId!==homeValueRequest||zip!==selectedZip||(requireOpen&&!document.querySelector('.calc-modal').classList.contains('open')))return;
    homeValue={status:priceEdited?'manual':'loaded',zip,data};
    applyZipTaxDefault();
    if(!priceEdited)setPriceControls(data.value);
    renderPriceSource();
    renderDataSources();
  });
}
function closeAll(){
  homeValueRequest++;
  if(homeValue.status==='loading')homeValue.status='cancelled';
  document.querySelectorAll('.overlay,.zip-panel,.calc-modal').forEach(x=>x.classList.remove('open'));
  document.querySelector('.calc-modal').inert=true;
  closeStateMap();
  renderPriceSource();
}
function setPriceControls(value){
  const slider=document.querySelector('#price');
  if(value>+slider.max)slider.max=Math.ceil(value*1.25/100000)*100000;
  slider.value=value;
  slider.defaultValue=value;
  document.querySelector('#priceAmount').value=value;
  document.querySelector('#priceAmount').defaultValue=value;
  details.price=value;
  applyZipTaxDefault();
  updateOutput();
  refreshPriceEstimate();
  renderDataSources();
}
function bindComparisons(){document.querySelectorAll('[data-compare]').forEach(b=>b.onclick=()=>{selectTerm(+b.dataset.compare);app();setTimeout(()=>document.querySelector('.data-drawer').classList.add('open'),20);});}
function refreshPriceEstimate(){
  const p=payment();
  document.querySelector('.total strong').textContent=money(p.total);
  document.querySelector('.legend .lav').closest('div').querySelector('strong').textContent=money(p.pi);
  document.querySelector('.legend .mint').closest('div').querySelector('strong').textContent=money(p.tax);
  document.querySelector('.legend .gold').closest('div').querySelector('strong').textContent=money(p.insurance);
  const hoa=document.querySelector('.legend .blue');if(hoa)hoa.closest('div').querySelector('strong').textContent=money(p.hoa);
  const pmi=document.querySelector('.legend .rose');if(pmi)pmi.closest('div').querySelector('strong').textContent=money(p.pmi);
  document.querySelector('.payment-bar i').style.width=`${p.pi/p.total*100}%`;
  document.querySelector('.payment-bar b').style.width=`${p.tax/p.total*100}%`;
  document.querySelector('.scenario strong').innerHTML=`${money(details.price)} home · ${details.down}% down<br>${details.term}-year fixed at ${details.rate}%`;
  document.querySelector('.drawer-stat strong').textContent=money(p.total);
  document.querySelector('#chart').innerHTML=chartSvg();
  bindEquityChart(details);
  renderTaxPayment();
  document.querySelector('.compare').innerHTML=`<h3>Compare loan terms</h3>${[15,20,30].map(term=>compareRow(term)).join('')}`;
  bindComparisons();
  renderPriceSource();
}
function markPriceEdited(){priceEdited=true;homeValue.status='manual';renderPriceSource();}
function renderPriceSource(){
  const note=document.querySelector('.price-source');
  const input=document.querySelector('#priceAmount'),hasPrice=Boolean(input.value)&&input.validity.valid;
  selectDistributionPrice(document.querySelector('.price-distribution'),hasPrice?+input.value:null);
  const hasTax=document.querySelector('#tax').value!==''&&document.querySelector('#tax').validity.valid;
  const hasRate=rateMode==='manual'||Boolean(rates.data);
  const insuranceInput=document.querySelector('#insurance');
  const hasInsurance=insuranceInput.value!==''&&insuranceInput.validity.valid;
  const ready=hasPrice&&hasTax&&hasRate&&hasInsurance;
  document.querySelector('.calculate').disabled=!ready;
  document.querySelector('#price').disabled=!hasPrice;
  document.querySelector('.details-btn').disabled=!ready;
  document.querySelector('.payment-bar').style.visibility=ready?'visible':'hidden';
  const summary=document.querySelector('.price-summary');
  document.querySelector('.price-field').classList.toggle('default-estimate',Boolean(homeValue.data?.fallback)&&!priceEdited);
  summary.classList.toggle('default-estimate',Boolean(homeValue.data?.fallback)&&!priceEdited);
  summary.textContent=homeValue.status==='loading'?`Loading the median home value for ZIP ${homeValue.zip}…`:homeValue.status==='loaded'?`ZIP median home value · Census ACS ${homeValue.data.period}`:homeValue.status==='manual'?'Your entered home price':homeValue.status==='unavailable'?`ZIP ${homeValue.zip} has no reported median. Enter your home price.`:homeValue.status==='error'?'The ZIP median could not load. Open the editor to retry or enter a home price.':homeValue.status==='cancelled'?'Open the editor to finish loading the ZIP median.':'Choose a ZIP to start with its median home value.';
  if(homeValue.data?.fallback&&!priceEdited)summary.textContent=`${fallbackLabel(homeValue.data)} · Default home price`;
  if(!ready){
    if(!hasPrice&&homeValue.status!=='loading')document.querySelector('#priceOut').textContent='Enter home price';
    document.querySelector('.total strong').textContent='—';
    document.querySelectorAll('.legend strong').forEach(el=>el.textContent='—');
    document.querySelector('.scenario strong').textContent=!hasPrice?(homeValue.status==='loading'?'Loading ZIP median…':`Enter a home price for ZIP ${selectedZip}`):!hasTax?(taxState.status==='loading'?'Loading ZIP tax estimate…':'Enter a property-tax estimate.'):!hasRate?(rates.status==='loading'?'Loading weekly rates…':'Enter a lender rate in the editor.'):insuranceState.status==='loading'?'Loading insurance benchmarks…':'Enter an insurance premium.';
  }
  if(homeValue.status==='loading'){note.textContent=`Finding the median home value for ZIP ${homeValue.zip}…`;return;}
  if(homeValue.data){
    const data=homeValue.data;
    if(data.fallback){
      note.textContent=`${priceEdited?'Using your entered price. ':''}No reported home median for ZIP ${selectedZip}, or its data could not load. Default ${money(data.value)}${data.atLeast?'+':data.atMost?' or less':''} from ${fallbackLabel(data)}.${data.atLeast||data.atMost?' Census reports a bound; adjust for your home.':''} `;
      const source=document.createElement('a');source.href=data.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';source.textContent='Census ACS '+data.period;note.append(source);
      return;
    }
    const amount=`${money(data.value)}${data.atLeast?'+':data.atMost?' or less':''}`;
    const description=`ZIP ${homeValue.zip} median home value: ${amount}`;
    note.textContent=`${homeValue.status==='manual'?'Using your entered price. ':''}${description}. `;
    const source=document.createElement('a');source.href=data.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';
    source.textContent=`Census ACS ${data.year-4}–${data.year}`;
    source.title='Median owner-occupied home value, estimated over five years.';
    const bound=data.atLeast?'lower':data.atMost?'upper':null;
    note.append(source,document.createTextNode(bound?homeValue.status==='manual'?` · Census reports a ${bound} bound.`:` · Starting at the reported ${bound} bound; adjust for your home.`:' · Adjust for your home.'));
    return;
  }
  note.textContent=homeValue.status==='manual'?'Using your entered home price.':homeValue.status==='error'?`Could not load the median for ZIP ${homeValue.zip}. Enter your home price, or reopen the editor to retry.`:homeValue.status==='unavailable'?`No median home value available for ZIP ${homeValue.zip}. Enter your home price.`:homeValue.status==='cancelled'?'The ZIP median has not loaded yet. Reopen the calculator to load it.':'Choose a ZIP to start with its median home value.';
}
function updateOutput(){const price=+document.querySelector('#price').value, down=+document.querySelector('#down').value, rate=+document.querySelector('#rate').value; document.querySelector('#priceOut').textContent=money(price); document.querySelector('#downOut').textContent=`${down}% · ${money(price*down/100)}`; document.querySelector('#rateOut').textContent=`${rate.toFixed(2)}%`;}
function readDetails(){ details.price=+document.querySelector('#priceAmount').value; ['down','rate','insurance','hoa','extra','appreciation','dwellingCoverage'].forEach(key => { details[key]=+document.querySelector(`#${key}`).value; });details[details.taxMode==='annual'?'annualTax':'tax']=+document.querySelector('#tax').value; }

function syncTaxInput(){
  const annual=details.taxMode==='annual',input=document.querySelector('#tax');
  const value=annual?details.annualTax:details.tax;
  input.value=value??'';input.defaultValue=value??'';
  input.placeholder=annual?'Enter annual tax':'Enter tax percentage';
  document.querySelector('#taxMode').value=details.taxMode;
  document.querySelector('.tax-prefix').textContent=annual?'$':'';
  document.querySelector('.tax-unit').textContent=annual?'/ yr':'% of price / yr';
}
function applyZipTaxDefault(){
  if(taxEdited||taxState.zip!==selectedZip||homeValue.zip!==selectedZip)return;
  const rate=estimateTaxPercent(taxState.data,homeValue.data);
  if(rate===null)return;
  details.annualTax=taxState.data.annualTax;
  if(details.taxMode==='percent')details.tax=rate;
  syncTaxInput();
}
function renderTaxPayment(){
  const tax=document.querySelector('#tax'),note=document.querySelector('.tax-payment-note');
  if(tax.value===''||!tax.validity.valid){note.textContent='';return;}
  const annual=details.taxMode==='annual'?details.annualTax:details.price*details.tax/100;
  note.textContent=`${money(annual)} / year · ${money(annual/12)} / month${details.taxMode==='percent'?' · Scales with your home price':''}`;
}
function startTaxLookup(zip){
  const request=++taxRequest;taxEdited=false;taxState={status:'loading',zip,data:null};
  details.taxMode='percent';details.tax=null;details.annualTax=null;syncTaxInput();renderDataSources();renderPriceSource();
  getZipPropertyTax(zip).then(async data=>{
    if(!data)data=(await nearbyDefaults(zip,selectedState)).tax;
    if(request!==taxRequest||zip!==selectedZip)return;
    taxState={status:taxEdited?'manual':data?'loaded':'unavailable',zip,data};
    if(data&&!taxEdited){details.annualTax=data.annualTax;applyZipTaxDefault();syncTaxInput();}
    refreshPriceEstimate();renderDataSources();
  }).catch(async()=>{
    let data;try{data=(await nearbyDefaults(zip,selectedState)).tax;}catch{data=regionalDefaults(zip,selectedState).tax;}
    if(request!==taxRequest||zip!==selectedZip)return;
    taxState={status:taxEdited?'manual':'loaded',zip,data};
    if(!taxEdited){details.annualTax=data.annualTax;applyZipTaxDefault();syncTaxInput();}
    refreshPriceEstimate();renderDataSources();
  });
}
async function startRates(){
  rates.status='loading';renderDataSources();
  try{
    rates={status:'loaded',data:await getMortgageRates()};
    if(rateMode==='benchmark')applyBenchmark();
  }catch{rates.status='error';}
  refreshPriceEstimate();renderDataSources();
}
function applyBenchmark(){
  if(!rates.data)return;
  details.rate=rateForTerm(rates.data,details.term);
  const input=document.querySelector('#rate');
  input.max=Math.max(20,details.rate);input.value=details.rate;input.defaultValue=details.rate;
  updateOutput();
}
function useBenchmark(){if(!rates.data)return;rateMode='benchmark';applyBenchmark();refreshPriceEstimate();renderDataSources();}
function selectTerm(term){details.term=term;if(rateMode==='benchmark')applyBenchmark();refreshPriceEstimate();renderDataSources();}
function displayDate(date){return new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});}
function renderDataSources(){
  const rateNote=document.querySelector('.rate-source'),taxNote=document.querySelector('.tax-source');
  const rateButton=document.querySelector('.use-benchmark');rateButton.disabled=!rates.data;
  if(rates.data){
    const date=rates.data.series[30].at(-1)[0];
    rateNote.innerHTML=`${rateMode==='manual'?'Using your entered rate. ':details.term===20?'Using the 30-year benchmark as a 20-year proxy. ':''}<a href="https://www.freddiemac.com/pmms" target="_blank" rel="noopener noreferrer">Freddie Mac PMMS</a> · ${displayDate(date)}. National weekly average; your lender quote may differ.${isRateStale(rates.data)?' This benchmark is more than two weeks old.':''}`;
  }else{
    rateNote.textContent=rates.status==='loading'?'Loading weekly Freddie Mac benchmarks…':'Weekly rate data could not load. Set your lender rate or open Rate trends to retry.';
    if(rateMode==='benchmark')document.querySelector('#rateOut').textContent=rates.status==='loading'?'Loading…':'Set your rate';
  }
  document.querySelector('.use-zip-tax').disabled=taxState.status==='loading';
  document.querySelector('.tax-field').classList.toggle('default-estimate',Boolean(taxState.data?.fallback||homeValue.data?.fallback)&&!taxEdited);
  if(taxState.data){
    const data=taxState.data,amount=`${money(data.annualTax)}${data.atLeast?'+':data.atMost?' or less':''}`;
    const home=homeValue.zip===selectedZip?homeValue.data:null;
    const ratio=estimateTaxPercent(data,home);
    const method=details.taxMode==='percent'?ratio===null?'No ZIP home-value median is available to derive a percentage. Enter a rate or switch to an annual bill.':`ZIP tax-to-value proxy: ${ratio}%, calculated from median annual tax ÷ median home value. This is an estimate, not an assessed tax rate.`:'Using an annual amount that stays fixed when you edit the home price.';
    taxNote.innerHTML=`${taxEdited?'Using your entered tax. ':''}${data.fallback?`${fallbackLabel(data)} · Default tax estimate. `:home?.fallback?'The home-value denominator uses an area default. ':''}${method} ${data.fallback?'Source-area':'ZIP '+data.zip} median annual tax: ${amount}. <a href="${data.sourceUrl}" target="_blank" rel="noopener noreferrer">Census ACS ${data.period}</a>${data.atLeast||data.atMost||home?.atLeast||home?.atMost?' · One or both Census medians are capped; the proxy is approximate.':''}`;
  }else taxNote.textContent=taxState.status==='loading'?`Loading property taxes for ZIP ${selectedZip}…`:taxState.status==='error'?`${taxEdited?'Using your entered tax. ':''}ZIP tax data could not load. Enter a tax percentage or annual bill, or use ZIP tax estimate to retry.`:`${taxEdited?'Using your entered tax. ':''}No reported tax median for ZIP ${selectedZip}. Enter a tax percentage or annual bill.`;
  const rateSummary=rates.data?`${rateMode==='manual'?'Your rate':details.term===20?'30-year rate proxy':'Weekly rate benchmark'} · ${displayDate(rates.data.series[30].at(-1)[0])}${isRateStale(rates.data)?' (older data)':''}`:rateMode==='manual'?'Your entered rate':rates.status==='loading'?'Loading weekly rates':'Rate data unavailable';
  const taxSummary=taxEdited?'Your entered property tax':taxState.data?`ZIP ${details.taxMode==='percent'?'tax-to-value proxy':'tax median'} · Census ACS ${taxState.data.period}`:taxState.status==='loading'?'Loading ZIP taxes':'Enter property tax';
  document.querySelector('.estimate-assumptions').textContent=`${rateSummary}. ${taxSummary}. Adjust for your lender and property.`;
  renderTaxPayment();
  document.querySelector('.rate-modal')?.dispatchEvent(new Event('rates-changed'));
}
function fallbackLabel(data){return data.fallback==='nearby'?`Nearby ZIP ${data.sourceZip} (${data.distanceMiles.toFixed(1)} miles away)`:`${data.sourceArea} ${data.fallback} median`;}

async function startInsurance(){
  insuranceState.status='loading';renderInsuranceSource();
  try{insuranceState={status:'loaded',data:await getInsuranceBenchmarks()};if(insuranceMode==='estimate')applyInsuranceEstimate();}
  catch{insuranceState.status='error';}
  renderInsuranceSource();refreshPriceEstimate();
}
function applyInsuranceEstimate(){
  if(insuranceMode!=='estimate')return;
  const estimate=insuranceState.data?estimateInsurance(insuranceState.data,selectedState,details.dwellingCoverage):null;
  const input=document.querySelector('#insurance');
  details.insurance=estimate?.monthly??0;
  input.value=estimate?.monthly??'';input.defaultValue=estimate?.monthly??'';
}
function renderInsuranceSource(){
  const note=document.querySelector('.insurance-source');
  document.querySelector('#dwellingCoverage').required=insuranceMode==='estimate';
  const button=document.querySelector('.use-insurance-estimate');button.disabled=insuranceState.status==='loading';
  if(!insuranceState.data){note.textContent=insuranceMode==='manual'?'Using your entered monthly insurance premium.':insuranceState.status==='loading'?'Loading state insurance benchmarks…':'Insurance benchmarks could not load. Enter a monthly quote or use state estimate to retry.';return;}
  const data=insuranceState.data,estimate=estimateInsurance(data,selectedState,details.dwellingCoverage);
  const description=insuranceMode==='manual'?'Using your entered monthly premium.':estimate?`${stateNames[selectedState]} estimate for ${money(details.dwellingCoverage)} dwelling rebuild coverage: ${money(estimate.annual)} / year.`:'No estimate is available outside $200,000–$800,000 rebuild coverage. Enter a monthly insurer quote or a supported coverage amount.';
  note.innerHTML=`${description} <a href="${data.source.url}" target="_blank" rel="noopener noreferrer">NerdWallet / Quadrant</a> · ${displayDate(data.source.updatedDate)}. State benchmark at $400,000 coverage, adjusted with the national coverage-cost curve. Assumes good credit and a $1,000 deductible; this is a planning estimate, not a quote. <a href="${data.source.rebuildSourceUrl}" target="_blank" rel="noopener noreferrer">Use rebuilding cost, excluding land</a>. Flood/earthquake and separate wind coverage are extra.${selectedState==='HI'?' Hawaii’s benchmark excludes hurricane wind coverage.':''}`;
}
function renderDistribution(){const input=document.querySelector('#priceAmount');renderPriceDistribution(document.querySelector('.price-distribution'),distributionState,()=>startDistribution(selectedZip),input.value&&input.validity.valid?+input.value:null);}
async function startDistribution(zip){
  const request=++distributionRequest;distributionState={status:'loading',selectedZip:zip,data:null};renderDistribution();
  try{
    let data=await getPriceDistribution(zip);
    if(!data){const fallback=await nearbyDefaults(zip,selectedState);if(fallback.home.sourceZip)data=await getPriceDistribution(fallback.home.sourceZip);}
    if(request!==distributionRequest||zip!==selectedZip)return;
    distributionState={status:data?'loaded':'unavailable',selectedZip:zip,data};
  }catch{if(request!==distributionRequest||zip!==selectedZip)return;distributionState={status:'error',selectedZip:zip,data:null};}
  renderDistribution();
}
app();
