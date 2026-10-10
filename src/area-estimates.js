import { zipLocations } from './zip-data.js';
import { getZipHomeValue } from './home-values.js?v=home-values-2';
import { getZipPropertyTax } from './property-taxes.js?v=estimates-1';
import { areaDefaults } from './area-defaults.js';

const locations=Object.values(zipLocations).flat();
const byZip=new Map(locations.map(row=>[row[0],row]));
const requests=new Map();

export function distanceMiles(a,b){
  const rad=Math.PI/180,lat=(b[3]-a[3])*rad,lon=(b[2]-a[2])*rad;
  const h=Math.sin(lat/2)**2+Math.cos(a[3]*rad)*Math.cos(b[3]*rad)*Math.sin(lon/2)**2;
  return 3958.8*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
export function nearbyZips(zip){
  const center=byZip.get(zip);if(!center)return [];
  return locations.filter(row=>row[0]!==zip&&Number.isFinite(row[2])&&Number.isFinite(row[3]))
    .map(row=>({zip:row[0],distance:distanceMiles(center,row)})).filter(row=>row.distance<=50)
    .sort((a,b)=>a.distance-b.distance).slice(0,32);
}

export function regionalDefaults(zip,state){
  const area=areaDefaults.states[state]??areaDefaults.national;
  const fallback=areaDefaults.states[state]?'state':'national';
  const common={zip,fallback,sourceArea:area.name,period:areaDefaults.source.period,year:2024};
  return { home:{...common,value:area.price,sourceUrl:`${areaDefaults.source.url}.B25077?g=${area.geographyCode}`},
    tax:{...common,annualTax:area.annualTax,proxyRate:+(area.annualTax/area.price*100).toFixed(4),sourceUrl:`${areaDefaults.source.url}.B25103?g=${area.geographyCode}`} };
}

export async function nearbyDefaults(zip,state){
  const key=zip+':'+state;
  if(!requests.has(key)){
    const request=(async()=>{
      const defaults=regionalDefaults(zip,state),candidates=nearbyZips(zip);
      const rows=await Promise.all(candidates.map(async candidate=>{
        const [home,tax]=await Promise.allSettled([getZipHomeValue(candidate.zip),getZipPropertyTax(candidate.zip)]);
        return {...candidate,home:home.status==='fulfilled'?home.value:null,tax:tax.status==='fulfilled'?tax.value:null};
      }));
      const home=rows.find(row=>row.home);
      if(home)defaults.home={...home.home,zip,sourceZip:home.zip,distanceMiles:home.distance,fallback:'nearby'};
      const tax=rows.find(row=>row.home&&row.tax);
      if(tax)defaults.tax={...tax.tax,zip,sourceZip:tax.zip,distanceMiles:tax.distance,fallback:'nearby',proxyRate:+(tax.tax.annualTax/tax.home.value*100).toFixed(4)};
      return defaults;
    })();
    requests.set(key,request);
  }
  return requests.get(key);
}
