export const ASSETS = [
  {symbol:'USDDZD_otc',label:'USD/DZD',country:'الجزائر',flag:'🇩🇿',base:134.27},
  {symbol:'USDBDT_otc',label:'USD/BDT',country:'بنغلادش',flag:'🇧🇩',base:121.76},
  {symbol:'USDPHP_otc',label:'USD/PHP',country:'الفلبين',flag:'🇵🇭',base:57.26},
  {symbol:'USDBRL_otc',label:'USD/BRL',country:'البرازيل',flag:'🇧🇷',base:5.2468},
  {symbol:'USDARS_otc',label:'USD/ARS',country:'الأرجنتين',flag:'🇦🇷',base:1280.4},
  {symbol:'USDCOP_otc',label:'USD/COP',country:'كولومبيا',flag:'🇨🇴',base:4152.31},
  {symbol:'USDIDR_otc',label:'USD/IDR',country:'إندونيسيا',flag:'🇮🇩',base:16221.45},
  {symbol:'USDINR_otc',label:'USD/INR',country:'الهند',flag:'🇮🇳',base:86.614},
  {symbol:'USDNGN_otc',label:'USD/NGN',country:'نيجيريا',flag:'🇳🇬',base:1512.87},
  {symbol:'EURUSD_otc',label:'EUR/USD',country:'منطقة اليورو',flag:'🇪🇺',base:1.08325},
] as const;
// USD/COP appears twice in the request; keep a single canonical instrument.
export type Candle={time:number;open:number;high:number;low:number;close:number;volume?:number};
export type Source='offline'|'demo'|'live';
export type Direction='CALL'|'PUT'|'HOLD';
export type Signal={id:string;asset:string;direction:'CALL'|'PUT';score:number;source:string;server_url?:string;created_at:number;entry_at:number;exit_at:number;entry_price:string|null;exit_price:string|null;entry_observed_at?:number|null;exit_observed_at?:number|null;result:'PENDING'|'ACTIVE'|'WIN'|'LOSS'|'DRAW'|'UNVERIFIED';amount:string;payout:string|null;pnl:string|null;reason?:string;factors?:string};
export type Factor={name:string;label:string;vote:number;value:string;detail:string};
export const assetOf=(s:string)=>ASSETS.find(a=>a.symbol===s)||ASSETS[9];
export const validAsset=(s:string)=>ASSETS.some(a=>a.symbol===s);
export const mean=(a:number[])=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
export function emaSeries(a:number[],p:number):(number|null)[]{
  const out:(number|null)[]=a.map(()=>null);if(a.length<p)return out;
  let e=mean(a.slice(0,p));out[p-1]=e;const k=2/(p+1);
  for(let i=p;i<a.length;i++){e=a[i]*k+e*(1-k);out[i]=e;}return out;
}
export function rsiSeries(a:number[],p=14):(number|null)[]{
  const out:(number|null)[]=a.map(()=>null);if(a.length<=p)return out;
  let gain=0,loss=0;for(let i=1;i<=p;i++){gain+=Math.max(0,a[i]-a[i-1]);loss+=Math.max(0,a[i-1]-a[i]);}gain/=p;loss/=p;
  const value=()=>gain===0&&loss===0?50:loss===0?100:100-100/(1+gain/loss);out[p]=value();
  for(let i=p+1;i<a.length;i++){gain=(gain*(p-1)+Math.max(0,a[i]-a[i-1]))/p;loss=(loss*(p-1)+Math.max(0,a[i-1]-a[i]))/p;out[i]=value();}return out;
}
export function cciSeries(c:Candle[],p=20):(number|null)[]{
  const tp=c.map(x=>(x.high+x.low+x.close)/3);return tp.map((v,i)=>{if(i<p-1)return null;const s=tp.slice(i-p+1,i+1),m=mean(s),d=mean(s.map(v=>Math.abs(v-m)));return d?(v-m)/(.015*d):0;});
}
export function bands(c:Candle[],p=20){const a=c.map(c=>c.close);return a.map((_,i)=>{if(i<p-1)return null;const s=a.slice(i-p+1,i+1),m=mean(s),sd=Math.sqrt(mean(s.map(x=>(x-m)**2)));return {mid:m,upper:m+2*sd,lower:m-2*sd};});}
export function macdSeries(c:Candle[]){const a=c.map(x=>x.close),e12=emaSeries(a,12),e26=emaSeries(a,26);const m=a.map((_,i)=>e12[i]!=null&&e26[i]!=null?e12[i]!-e26[i]!:null);const signal=emaSeries(m.slice(25).filter(x=>x!=null) as number[],9);return m.map((v,i)=>({value:v,signal:i>=25?signal[i-25]??null:null,hist:v!=null&&signal[i-25]!=null?v-signal[i-25]!:null}));}
export function analyze(input:Candle[],now=Date.now()/1000){
  const c=input.filter(x=>x.time+60<=now);if(c.length<60)return null;
  const a=c.map(x=>x.close),last=c.at(-1)!,e9=emaSeries(a,9).at(-1)!,e21=emaSeries(a,21).at(-1)!,e50=emaSeries(a,50),rsi=rsiSeries(a).at(-1)!,cci=cciSeries(c).at(-1)!;
  const range=last.high-last.low,body=range?Math.abs(last.close-last.open)/range:0;
  const f:Factor[]=[
    {name:'RSI',label:'قوة الحركة',vote:rsi>=52&&rsi<=70?1:rsi<=48&&rsi>=30?-1:0,value:rsi.toFixed(1),detail:'Wilder RSI · 14'},
    {name:'EMA',label:'تقاطع المتوسطات',vote:e9>e21?1:e9<e21?-1:0,value:'9 / 21',detail:'EMA 9 مقابل EMA 21'},
    {name:'CCI',label:'زخم السعر',vote:cci>20&&cci<200?1:cci<-20&&cci>-200?-1:0,value:cci.toFixed(1),detail:'CCI · 20'},
    {name:'TREND',label:'الاتجاه العام',vote:last.close>e50.at(-1)!&&e50.at(-1)!>e50.at(-4)!?1:last.close<e50.at(-1)!&&e50.at(-1)!<e50.at(-4)!?-1:0,value:last.close>e50.at(-1)!?'صاعد':'هابط',detail:'اتجاه EMA 50 عبر 3 شموع'},
    {name:'CANDLE',label:'بنية الشمعة',vote:body<.35?0:last.close>last.open?1:-1,value:Math.round(body*100)+'%',detail:'جسم آخر شمعة مغلقة'},
  ];
  const up=f.filter(x=>x.vote===1).length,down=f.filter(x=>x.vote===-1).length,score=Math.max(up,down)*20;
  const direction:Direction=up===down?'HOLD':up>down?'CALL':'PUT';
  const trs=c.slice(-14).map((x,i)=>{const prev=c[c.length-15+i]?.close??x.open;return Math.max(x.high-x.low,Math.abs(x.high-prev),Math.abs(x.low-prev));});
  return {factors:f,score,direction,ready:score>=80,rsi,cci,ema9:e9,ema21:e21,ema50:e50.at(-1)!,atr:mean(trs),support:Math.min(...c.slice(-24).map(x=>x.low)),resistance:Math.max(...c.slice(-24).map(x=>x.high)),candleTime:last.time,macd:macdSeries(c).at(-1)!};
}
// Deterministic synthetic data, always labelled DEMO. Never used for a live quote.
export function demoPrice(asset:string,at:number){const i=ASSETS.findIndex(a=>a.symbol===asset),base=assetOf(asset).base,t=at/60;return Number((base*(1+.002*Math.sin(t/29+i)+.0013*Math.cos(t/8+i*2)+.00014*Math.sin(t*3.7+i)+.00005*Math.sin(t*17))).toFixed(6));}
export function demoCandles(asset:string,now=Date.now()/1000,count=160):Candle[]{const end=Math.floor(now/60)*60;return Array.from({length:count},(_,i)=>{const t=end-(count-1-i)*60,last=Math.min(t+59,now),points=Array.from({length:Math.max(1,Math.floor((last-t)/5)+1)},(_,j)=>demoPrice(asset,t+j*5));points.push(demoPrice(asset,last));return {time:t,open:points[0],high:Math.max(...points),low:Math.min(...points),close:points.at(-1)!};});}
export function validateCandles(value:unknown):Candle[]{if(!Array.isArray(value))throw Error('invalid_candles');const map=new Map<number,Candle>();for(const x of value){const c={time:Number(x.time),open:Number(x.open),high:Number(x.high),low:Number(x.low),close:Number(x.close)};if(!Object.values(c).every(Number.isFinite)||c.time<=0||c.time%60!==0||Math.min(c.open,c.high,c.low,c.close)<=0||c.high<Math.max(c.open,c.close,c.low)||c.low>Math.min(c.open,c.close,c.high))throw Error('invalid_candle');map.set(c.time,c);}return [...map.values()].sort((a,b)=>a.time-b.time).slice(-500);}
export function decimalUnits(value:string,scale=8){if(!/^\d+(\.\d{1,8})?$/.test(value))throw Error('invalid_decimal');const [a,b='']=value.split('.');return BigInt(a)*BigInt(10)**BigInt(scale)+BigInt(b.padEnd(scale,'0'));}
export function outcome(direction:string,entry:string,exit:string):'WIN'|'LOSS'|'DRAW'{if(!['CALL','PUT','BUY','SELL'].includes(direction))throw Error('invalid_direction');const a=decimalUnits(entry),b=decimalUnits(exit);return a===b?'DRAW':((direction==='CALL'||direction==='BUY')?b>a:b<a)?'WIN':'LOSS';}
export function metrics(s:Signal[]){const win=s.filter(x=>x.result==='WIN').length,loss=s.filter(x=>x.result==='LOSS').length,draw=s.filter(x=>x.result==='DRAW').length;return {win,loss,draw,total:win+loss+draw,rate:win+loss?win/(win+loss)*100:null,pnl:s.reduce((t,x)=>t+(Number(x.pnl)||0),0),unverified:s.filter(x=>x.result==='UNVERIFIED').length};}

// Unix seconds in UTC. Keep fractional seconds when calculating preparation time.
export function nextSignalEntry(nowSeconds:number){
 if(!Number.isFinite(nowSeconds)||nowSeconds<0)throw new Error('Invalid server time');
 return Math.ceil((nowSeconds+10)/60)*60;
}
