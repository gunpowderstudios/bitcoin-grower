// Display currency only: historical BTC price data and simulation maths remain in GBP.
const CODES=['GBP','USD','EUR','CAD','AUD'];
const SYMBOLS={GBP:'£',USD:'$',EUR:'€',CAD:'C$',AUD:'A$'};
const key='bitcoin-garden-currency';
let chosen='GBP',rates={GBP:1},error='';
try { const saved=localStorage.getItem(key); if(CODES.includes(saved))chosen=saved; } catch {}
function money(n){if(!Number.isFinite(n))return '—';return new Intl.NumberFormat('en-GB',{style:'currency',currency:chosen,minimumFractionDigits:2,maximumFractionDigits:2}).format(n*rate());}
function moneyShort(n){return money(n).replace(/\\.00$/, '');}
function rate(){return Number(rates[chosen])||1;}
function toGBP(n){return Number(n)/rate();}
function currency(){return chosen;}
function symbol(){return SYMBOLS[chosen];}
function setup(){
 for(const id of ['currencySelect']) {
  const select=document.getElementById(id);if(!select)continue;
  select.value=chosen;
  select.addEventListener('change',()=>{try{localStorage.setItem(key,select.value);}catch{} location.reload();});
 }
 document.querySelectorAll('[data-currency-symbol]').forEach(el=>el.textContent=symbol());
 const note=document.getElementById('currencyNote');
 if(note)note.textContent=chosen==='GBP'?'Base currency: GBP.': 'Converted using a recent GBP exchange rate ('+chosen+'). Historical GBP prices use this same display rate; not historical FX quotes.' + (error?' FX feed unavailable; showing GBP instead.':'');
}
async function initCurrency(){
 if(chosen!=='GBP'){
  try{
   const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),6500);
   let response;try{response=await fetch('https://api.frankfurter.dev/v1/latest?base=GBP&symbols=USD,EUR,CAD,AUD',{signal:ac.signal,cache:'no-store'});}finally{clearTimeout(tm);}
   if(!response.ok)throw Error('FX response');
   const data=await response.json();
   if(!Number.isFinite(data?.rates?.[chosen])||data.rates[chosen]<=0)throw Error('FX rate');
   rates={GBP:1,...data.rates};
  }catch{chosen='GBP';error='Rates unavailable';}
 }
 setup();
}
export {initCurrency,money,moneyShort,toGBP,currency,symbol};
