'use strict';
const $=x=>document.getElementById(x),money=x=>Number.isFinite(x)?new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:2}).format(x):'—';
let history=[],steps=[],cursor=0,run=null,clock=null,loaded=false;
const number=id=>Number($(id).value);
const source='https://raw.githubusercontent.com/typedcypher/historical-bitcoin-prices/main/data/daily_bitcoin_prices.csv';
function loadCSV(csv){const lines=csv.replace(/^\\uFEFF/,'').split(/\\r?\\n/).filter(Boolean),heads=lines.shift().replace(/^"/,'').split(',').map(s=>s.trim().replaceAll('"','').toLowerCase());
const dateCol=heads.findIndex(x=>x==='date'),priceCol=heads.findIndex(x=>x==='btc_gbp');
if(dateCol<0||priceCol<0)throw Error('CSV needs Date and BTC_GBP columns');
const points=lines.map(line=>{const parts=line.split(',');return {date:(parts[dateCol]||'').replaceAll('"','').trim().slice(0,10),price:Number((parts[priceCol]||'').replaceAll('"','').trim())}}).filter(p=>/^\\d{4}-\\d{2}-\\d{2}$/.test(p.date)&&Number.isFinite(p.price)&&p.price>0).sort((a,b)=>a.date.localeCompare(b.date));
const unique=points.filter((p,i)=>i===0||p.date!==points[i-1].date);
if(unique.length<20)throw Error('Too few valid daily GBP Bitcoin prices');
return unique;
}
async function loadPrices(){try{const response=await fetch(source,{cache:'no-store'});if(!response.ok)throw Error('Historical price server returned '+response.status);history=loadCSV(await response.text());loaded=true;$('source').textContent='Source: typedcypher/historical-bitcoin-prices · BTC_GBP daily CSV (Kaggle-derived; may contain forward-filled FX rates).';setupLoaded();}catch(e){$('source').textContent='Automatic data feed unavailable: '+e.message+'. Import a Date,BTC_GBP CSV instead.';$('status').textContent='Historical prices unavailable; waiting for CSV.';}}
function setupLoaded(){$('coverage').textContent=history.length+' price observations · '+history[0].date+' to '+history.at(-1).date;for(const id of ['play','reset','month','finish'])$(id).disabled=false;$('status').textContent='Select a date range and start the replay.';drawTree(100,100,0);$('end').max=history.at(-1).date;$('start').min=history[0].date;}
function settings(){const s={initial:number('starting'),buy:number('buySize'),dip:number('dip')/100,rise:number('rebound')/100,sell:number('harvest')/100,fee:number('fee')/100};
if(!Object.values(s).every(Number.isFinite)||s.initial<20||s.initial>1e6||s.buy<1||s.buy>s.initial||s.dip<=0||s.dip>=1||s.rise<=0||s.rise>5||s.sell<=0||s.sell>1||s.fee<0||s.fee>.1)throw Error('Please check your amounts and trading percentages.');
return s;}
function prepare(){if(!loaded)throw Error('Historical prices are not loaded');const s=settings(),from=$('start').value,to=$('end').value;
if(!from||!to||from>=to)throw Error('Start date must be before end date');
steps=history.filter(p=>p.date>=from&&p.date<=to);
if(steps.length<2||steps[0].date!==from||steps.at(-1).date!==to)throw Error('There is no complete daily data for the selected exact dates. Choose dates within the displayed coverage.');
const gaps=steps.slice(1).some((p,i)=>(Date.parse(p.date+'T00:00:00Z')-Date.parse(steps[i].date+'T00:00:00Z'))>2*86400000);
if(gaps)throw Error('Historical data has gaps of more than one day; choose a cleaner period.');
run={s,cash:s.initial,btc:0,ref:steps[0].price,lots:[],events:[],portfolio:[],buys:0,sells:0,peak:s.initial,worst:0,first:steps[0].price};cursor=0;render();}
function processOne(){if(!run||cursor>=steps.length)return false;
const p=steps[cursor],s=run.s;const sellable=[];
for(const lot of run.lots){if(!lot.harvested&&p.price+1e-8>=lot.price*(1+s.rise))sellable.push(lot);}
for(const lot of sellable){const qty=lot.btc*s.sell;const gross=qty*p.price,net=gross*(1-s.fee);run.btc-=qty;run.cash+=net;lot.harvested=true;run.sells++;run.events.push({date:p.date,side:'SELL',price:p.price,gbp:net,btc:qty});}
if(!run.lots.some(l=>!l.harvested)&&p.price<=run.ref*(1-s.dip)&&run.cash>=s.buy){const qty=s.buy*(1-s.fee)/p.price;run.btc+=qty;run.cash-=s.buy;run.lots.push({price:p.price,btc:qty,harvested:false});run.ref=p.price;run.buys++;run.events.push({date:p.date,side:'BUY',price:p.price,gbp:s.buy,btc:qty});}
const total=run.cash+run.btc*p.price,hold=s.initial*p.price/run.first;run.peak=Math.max(run.peak,total);run.worst=Math.max(run.worst,100*(run.peak-total)/run.peak);run.portfolio.push({date:p.date,total,hold,price:p.price});cursor++;return true;
}
function tick(n){for(let j=0;j<n&&processOne();j++);render();if(cursor>=steps.length)pause(true);}
function pause(done=false){if(clock){clearInterval(clock);clock=null;}$('pause').disabled=true;$('play').disabled=false;$('play').textContent=done?'↻ Replay':'▶ Resume';if(done)$('status').textContent='Historical run complete. These are virtual results, not actual trades.';}
function start(){try{if(!run||cursor>=steps.length)prepare();pause();$('play').disabled=true;$('pause').disabled=false;$('play').textContent='▶ Resume';clock=setInterval(()=>tick(Math.floor(number('speed'))||1),90);$('status').textContent='Replaying real historical daily closing prices…';}catch(e){$('status').textContent=e.message;}}
function svg(tag,attrs,parent){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);parent.appendChild(e);return e;}
function drawTree(total,initial,sales){const root=$('tree');root.replaceChildren();const ratio=Math.max(0,total/initial),stage=ratio<.7?0:ratio<1.1?1:ratio<1.6?2:ratio<3?3:ratio<7?4:5;
const names=['Wilted seedling','Seedling','Small plant','Bush','Young tree','Golden tree'];$('stage').textContent=names[stage];svg('ellipse',{cx:160,cy:248,rx:83,ry:11,fill:'#102216'},root);
svg('path',{d:'M110 206 L210 206 L193 250 Q160 266 127 250Z',fill:'#bd8656'},root);svg('path',{d:'M110 206 L210 206 L205 217 L115 217Z',fill:'#dfb380'},root);
svg('path',{d:'M160 206 Q158 148 160 94',stroke:stage>2?'#6c9451':'#8dca70','stroke-width':stage>3?12:7,'stroke-linecap':'round',fill:'none'},root);
const count=[1,2,4,7,10,14][stage];for(let i=0;i<count;i++){const side=i%2?1:-1,y=188-i*(stage>3?9:13),x=160+side*(19+i%3*10);svg('ellipse',{cx:x,cy:y,rx:stage>2?27:21,ry:stage>2?12:9,fill:stage===0?'#6c8469':i%2?'#b0e283':'#73ba6b',transform:'rotate('+side*30+' '+x+' '+y+')'},root);}
for(let i=0;i<Math.min(sales,12);i++){const x=128+(i%4)*21,y=104+Math.floor(i/4)*25;svg('circle',{cx:x,cy:y,r:8,fill:'#dfb64d',stroke:'#f2d788','stroke-width':2},root);svg('text',{x:x,y:y+4,'font-size':11,'text-anchor':'middle',fill:'#27211a'},root).textContent='₿';}
}
function chart(){const root=$('chart');root.replaceChildren();const pts=run?.portfolio||[];if(pts.length<2)return;let show=pts.length>350?pts.filter((x,i)=>i%Math.ceil(pts.length/350)===0||i===pts.length-1):pts;const values=show.flatMap(x=>[x.total,x.hold]),min=Math.min(...values),max=Math.max(...values),pad=Math.max(.01,(max-min)*.08),lo=min-pad,hi=max+pad;
for(const [key,color] of [['total','#b8ed8b'],['hold','#e2bf57']]){const d=show.map((p,i)=>(i?'L':'M')+(20+i*660/(show.length-1)).toFixed(1)+' '+(209-188*(p[key]-lo)/(hi-lo)).toFixed(1)).join(' ');svg('path',{d,fill:'none',stroke:color,'stroke-width':3},root);}svg('text',{x:20,y:14,'font-size':12,fill:'#c5d8c0'},root).textContent=money(hi);svg('text',{x:20,y:224,'font-size':12,fill:'#c5d8c0'},root).textContent=money(lo);}
function render(){if(!run)return;const sample=run.portfolio.at(-1),s=run.s,p=sample?.price||run.first,total=sample?.total??s.initial,hold=sample?.hold??s.initial;
$('dateNow').textContent=sample?.date||steps[0]?.date||'—';$('total').textContent=money(total);$('pnl').textContent=(total>=s.initial?'+':'')+money(total-s.initial)+' ('+(100*(total/s.initial-1)).toFixed(2)+'%)';
$('cash').textContent=money(run.cash);$('btc').textContent=run.btc.toFixed(8)+' BTC';$('price').textContent=money(p);$('hold').textContent=money(hold);$('progress').value=steps.length?100*cursor/steps.length:0;
$('counts').textContent=run.buys+' / '+run.sells;$('best').textContent=money(run.peak);$('drawdown').textContent=run.worst.toFixed(2)+'%';$('difference').textContent=money(total-hold);
$('result').textContent='Grower '+money(total)+' versus buy-and-hold '+money(hold)+'. No returns are guaranteed.';
drawTree(total,s.initial,run.sells);chart();const body=$('journal');body.replaceChildren();for(const t of run.events.slice(-150).reverse()){const row=body.insertRow();for(const v of [t.date,t.side,money(t.price),money(t.gbp)])row.insertCell().textContent=v;}if(!run.events.length)body.insertRow().insertCell().textContent='No trades triggered yet';}
$('play').onclick=start;$('pause').onclick=()=>pause();$('reset').onclick=()=>{pause();try{prepare()}catch(e){$('status').textContent=e.message;}};$('month').onclick=()=>{pause();try{if(!run||cursor>=steps.length)prepare();tick(30)}catch(e){$('status').textContent=e.message;}};$('finish').onclick=()=>{pause();try{if(!run||cursor>=steps.length)prepare();tick(steps.length)}catch(e){$('status').textContent=e.message;}};
$('csv').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{history=loadCSV(await file.text());loaded=true;$('source').textContent='Imported CSV: '+file.name+' (check provenance and accuracy before using results).';setupLoaded();}catch(err){$('status').textContent=err.message;}};
loadPrices();
