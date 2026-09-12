import {ApiError,seal,unseal} from './security';
import {ASSETS,nextSignalEntry,analyze,demoPrice,metrics,outcome,type Candle,type Signal,validAsset} from './market';
import {get_saved_server_url} from './server-settings';

export type PriceEnvironment={
 DB:D1Database;
 APP_SECRET:string;
 PRICE_SERVER_API_KEY?:string;
 PRICE_SERVER_ADMIN_SECRET?:string;
};

export type Quote={
 symbol:string;
 price:number;
 at:number|null;
 available:boolean;
 status?:string;
 payout:number|null;
};

type HealthState={
 server:'ok'|'unknown';
 authorized:boolean;
 ssid_loaded:boolean;
 quotex:boolean|string;
 live_pairs:number|null;
 total_pairs:number|null;
 price_updates:number|null;
 has_error:boolean;
};

export type MarketWorkerState={
 version:1;
 state:'LIVE'|'NO_QUOTES'|'UNAUTHORIZED'|'ERROR';
 server_url:string;
 last_poll_at:number;
 last_success_at:number|null;
 health:HealthState;
 pairs:Quote[];
 error:string|null;
};

export type CandleSegment={
 storageAsset:string;
 time:number;
 open:number;
 high:number;
 low:number;
 close:number;
 firstAt:number;
 lastAt:number;
 samples:number;
 maxGap:number;
};

export type MarketAccumulator=Map<string,CandleSegment>;

const WORKER_STATE_ID='market_worker_state';
const atNow=()=>Date.now()/1000;
const object=(value:unknown):Record<string,unknown>|null=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
const count=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;

export function timestamp(value:unknown):number|null{
 if(value==null)return null;
 const n=typeof value==='number'?value:typeof value==='string'&&/^\d+(\.\d+)?$/.test(value)?Number(value):typeof value==='string'?Date.parse(value)/1000:NaN;
 if(!Number.isFinite(n)||n<=0)return null;
 return n>1e11?n/1000:n;
}

export function normalizePrices(raw:unknown):Quote[]{
 const root=object(raw),nested=object(root?.data);
 const data=root?.pairs??root?.prices??nested?.pairs??nested?.prices??root?.data??raw;
 const recordData=object(data);
 const records:Array<[string,unknown]>=Array.isArray(data)
  ?data.map(value=>{const item=object(value);return [String(item?.symbol??item?.asset??''),value];})
  :recordData?Object.entries(recordData):[];
 const quotes:Quote[]=[];
 for(const [symbol,value] of records){
  if(!validAsset(symbol))continue;
  const item=object(value);
  const price=typeof value==='number'||typeof value==='string'?Number(value):Number(item?.price??item?.close??item?.value);
  if(!Number.isFinite(price)||price<=0)continue;
  const at=timestamp(item?.timestamp??item?.updated_at??item?.time??item?.ts??item?.last_update??item?.last_updated);
  const payout=Number(item?.payout),status=typeof item?.status==='string'?item.status.toLowerCase():undefined;
  quotes.push({symbol,price,at,available:item?.is_open!==false&&(!status||status==='live'),status,payout:Number.isFinite(payout)&&payout>0&&payout<=100?payout:null});
 }
 return quotes;
}

async function call(e:PriceEnvironment,path:string,payload?:unknown,base?:string){
 const serverURL=base??await get_saved_server_url(e),headers:Record<string,string>={Accept:'application/json'};
 if(path==='/prices'){
  if(!e.PRICE_SERVER_API_KEY)throw new ApiError(503,'price_key_missing');
  headers['X-API-Key']=e.PRICE_SERVER_API_KEY;
 }
 if(payload!==undefined){
  if(!e.PRICE_SERVER_ADMIN_SECRET)throw new ApiError(503,'price_admin_missing');
  headers.Authorization='Bearer '+e.PRICE_SERVER_ADMIN_SECRET;
  headers['Content-Type']='application/json';
 }
 let response:Response;
 try{response=await fetch(serverURL+path,{method:payload===undefined?'GET':'POST',headers,body:payload===undefined?undefined:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(10000)});}
 catch{throw new ApiError(502,'price_server_unreachable');}
 if(!response.ok)throw new ApiError(502,'price_server_http_'+response.status);
 const text=await response.text();
 if(text.length>1_000_000)throw new ApiError(502,'price_response_large');
 try{return JSON.parse(text) as unknown;}
 catch{throw new ApiError(502,'price_response_invalid');}
}

export const getHealth=(e:PriceEnvironment,base?:string)=>call(e,'/health',undefined,base);
export const getAllPrices=(e:PriceEnvironment,base?:string)=>call(e,'/prices',undefined,base);
export const sendSSID=(e:PriceEnvironment,ssid:string)=>call(e,'/admin/session',{ssid});

export function isAuthorized(health:unknown){
 const root=object(health),nested=object(root?.data);
 return root?.authorized===true||nested?.authorized===true;
}

export function safeHealth(health:unknown):HealthState{
 const root=object(health),value=object(root?.data)??root,quotex=value?.quotex;
 return {
  server:value?.server==='ok'?'ok':'unknown',
  authorized:isAuthorized(health),
  ssid_loaded:value?.ssid_loaded===true,
  quotex:typeof quotex==='boolean'?quotex:typeof quotex==='string'&&['connected','disconnected','connecting','authorized'].includes(quotex)?quotex:'unknown',
  live_pairs:count(value?.live_pairs),
  total_pairs:count(value?.total_pairs),
  price_updates:count(value?.price_updates),
  has_error:!!value?.error,
 };
}

export async function readMarketWorkerState(e:PriceEnvironment):Promise<MarketWorkerState|null>{
 const row=await e.DB.prepare('SELECT encrypted FROM settings WHERE id=?').bind(WORKER_STATE_ID).first<{encrypted:string}>();
 if(!row)return null;
 try{
  const state=await unseal<MarketWorkerState>(e.APP_SECRET,row.encrypted);
  return state?.version===1&&typeof state.server_url==='string'&&Array.isArray(state.pairs)?state:null;
 }catch{return null;}
}

async function writeMarketWorkerState(e:PriceEnvironment,state:MarketWorkerState){
 const encrypted=await seal(e.APP_SECRET,state);
 await e.DB.prepare('INSERT INTO settings(id,encrypted,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET encrypted=excluded.encrypted,updated_at=excluded.updated_at').bind(WORKER_STATE_ID,encrypted,Math.floor(state.last_poll_at)).run();
}

function failureCode(error:unknown){return error instanceof ApiError?error.code:'service_unavailable';}

export function captureQuotes(accumulator:MarketAccumulator,serverURL:string,quotes:Quote[],observedAt:number){
 for(const quote of quotes){
  if(!quote.available||quote.at==null||quote.at>observedAt+2||observedAt-quote.at>8)continue;
  const bucket=Math.floor(quote.at/60)*60,storageAsset=serverURL+'|'+quote.symbol,key=storageAsset+'|'+bucket,current=accumulator.get(key);
  if(!current){
   accumulator.set(key,{storageAsset,time:bucket,open:quote.price,high:quote.price,low:quote.price,close:quote.price,firstAt:quote.at,lastAt:quote.at,samples:1,maxGap:0});
   continue;
  }
  if(quote.at<=current.lastAt)continue;
  current.high=Math.max(current.high,quote.price);
  current.low=Math.min(current.low,quote.price);
  current.close=quote.price;
  current.maxGap=Math.max(current.maxGap,quote.at-current.lastAt);
  current.lastAt=quote.at;
  current.samples+=1;
 }
}

export async function flushAccumulatedCandles(e:PriceEnvironment,accumulator:MarketAccumulator,beforeBucket=Infinity){
 const selected=[...accumulator.entries()].filter(([,segment])=>segment.time<beforeBucket);
 if(!selected.length)return 0;
 const sql='INSERT INTO market_candles(asset,time,open,high,low,close,first_at,last_at,samples,max_gap) VALUES(?,?,?,?,?,?,?,?,?,?) '+
  'ON CONFLICT(asset,time) DO UPDATE SET '+
  'open=CASE WHEN excluded.first_at<first_at THEN excluded.open ELSE open END,'+
  'high=MAX(high,excluded.high),low=MIN(low,excluded.low),'+
  'close=CASE WHEN excluded.last_at>last_at THEN excluded.close ELSE close END,'+
  'first_at=MIN(first_at,excluded.first_at),last_at=MAX(last_at,excluded.last_at),'+
  'samples=samples+excluded.samples,'+
  'max_gap=MAX(max_gap,excluded.max_gap,CASE WHEN excluded.first_at>last_at THEN excluded.first_at-last_at ELSE 0 END)';
 const statements=selected.map(([,segment])=>e.DB.prepare(sql).bind(segment.storageAsset,segment.time,segment.open,segment.high,segment.low,segment.close,segment.firstAt,segment.lastAt,segment.samples,segment.maxGap));
 await e.DB.batch(statements);
 for(const [key] of selected)accumulator.delete(key);
 return selected.length;
}

export async function settleLiveSignals(e:PriceEnvironment,quotes:Quote[],observedAt:number,serverURL:string){
 const rows=await e.DB.prepare("SELECT id,data FROM trades WHERE source='live' AND result IN ('PENDING','ACTIVE')").all<{id:string;data:string}>();
 let changed=0;
 for(const row of rows.results){
  let signal:Signal;
  try{signal=JSON.parse(row.data) as Signal;}catch{continue;}
  const quote=quotes.find(item=>item.symbol===signal.asset&&item.available&&item.at!==null&&item.at<=observedAt&&observedAt-item.at<8),before=JSON.stringify(signal);
  if(signal.server_url&&signal.server_url!==serverURL){signal.result='UNVERIFIED';signal.reason='تغيّر مصدر الأسعار أثناء الإشارة';}
  if(signal.result==='PENDING'&&quote?.at!=null&&quote.at>=signal.entry_at&&quote.at<=signal.entry_at+3){signal.entry_price=quote.price.toFixed(8);signal.entry_observed_at=quote.at;signal.result='ACTIVE';}
  if(signal.result==='PENDING'&&observedAt>signal.entry_at+8){signal.result='UNVERIFIED';signal.reason='لم يصل سعر مؤرّخ خلال 3 ثوانٍ من موعد الدخول';}
  if(signal.result==='ACTIVE'&&quote?.at!=null&&quote.at>=signal.exit_at&&quote.at<=signal.exit_at+3){signal.exit_price=quote.price.toFixed(8);signal.exit_observed_at=quote.at;signal.result=outcome(signal.direction,signal.entry_price!,signal.exit_price);signal.pnl=signal.result==='DRAW'?'0.00':signal.result==='LOSS'?(-Number(signal.amount)).toFixed(2):signal.payout!==null?(Number(signal.amount)*Number(signal.payout)).toFixed(2):null;}
  if(signal.result==='ACTIVE'&&observedAt>signal.exit_at+8){signal.result='UNVERIFIED';signal.reason='لا يوجد سعر خروج موثوق ضمن مهلة 3 ثوانٍ';}
  const after=JSON.stringify(signal);
  if(after!==before){const result=await e.DB.prepare('UPDATE trades SET data=?,result=? WHERE id=? AND data=?').bind(after,signal.result,row.id,before).run();changed+=result.meta.changes??0;}
 }
 return changed;
}

export async function settleDemoSignals(e:PriceEnvironment,observedAt:number){
 const rows=await e.DB.prepare("SELECT id,data FROM trades WHERE source='demo' AND result IN ('PENDING','ACTIVE')").all<{id:string;data:string}>();
 let changed=0;
 for(const row of rows.results){
  let signal:Signal;
  try{signal=JSON.parse(row.data) as Signal;}catch{continue;}
  const before=JSON.stringify(signal);
  if(observedAt>=signal.entry_at&&signal.entry_price===null){signal.entry_price=demoPrice(signal.asset,signal.entry_at).toFixed(6);signal.entry_observed_at=signal.entry_at;signal.result='ACTIVE';}
  if(observedAt>=signal.exit_at&&signal.entry_price!==null){signal.exit_price=demoPrice(signal.asset,signal.exit_at).toFixed(6);signal.exit_observed_at=signal.exit_at;signal.result=outcome(signal.direction,signal.entry_price,signal.exit_price);signal.pnl=(signal.result==='DRAW'?0:signal.result==='WIN'?Number(signal.amount)*Number(signal.payout):-Number(signal.amount)).toFixed(2);}
  const after=JSON.stringify(signal);
  if(after!==before){const result=await e.DB.prepare('UPDATE trades SET data=?,result=? WHERE id=? AND data=?').bind(after,signal.result,row.id,before).run();changed+=result.meta.changes??0;}
 }
 return changed;
}

export async function pollMarketOnce(e:PriceEnvironment,accumulator:MarketAccumulator,observedAt=atNow()):Promise<MarketWorkerState>{
 const serverURL=await get_saved_server_url(e),previous=await readMarketWorkerState(e);
 try{
  const rawHealth=await getHealth(e,serverURL),health=safeHealth(rawHealth);
  let quotes:Quote[]=[];
  if(health.authorized){
   quotes=normalizePrices(await getAllPrices(e,serverURL));
   if(await get_saved_server_url(e)!==serverURL)throw new ApiError(409,'server_changed');
   // The persisted worker snapshot is the cross-invocation cursor. Filtering
   // already-seen timestamps prevents a quote at a cron boundary from being
   // counted twice in the minute candle.
   const previousQuotes=previous?.server_url===serverURL?previous.pairs:[];
   captureQuotes(accumulator,serverURL,quotes.filter(quote=>{
    const seen=previousQuotes.find(item=>item.symbol===quote.symbol)?.at;
    return quote.at===null||seen===null||seen===undefined||quote.at>seen;
   }),observedAt);
  }
  await settleLiveSignals(e,quotes,observedAt,serverURL);
  await settleDemoSignals(e,observedAt);
  const fresh=quotes.filter(quote=>quote.available&&quote.at!==null&&quote.at<=observedAt+2&&observedAt-quote.at<=8);
  const state:MarketWorkerState={version:1,state:!health.authorized?'UNAUTHORIZED':fresh.length?'LIVE':'NO_QUOTES',server_url:serverURL,last_poll_at:observedAt,last_success_at:fresh.length?observedAt:previous?.last_success_at??null,health,pairs:quotes,error:null};
  await writeMarketWorkerState(e,state);
  return state;
 }catch(error){
  await settleLiveSignals(e,[],observedAt,serverURL);
  await settleDemoSignals(e,observedAt);
  const state:MarketWorkerState={version:1,state:'ERROR',server_url:serverURL,last_poll_at:observedAt,last_success_at:previous?.server_url===serverURL?previous.last_success_at:null,health:previous?.server_url===serverURL?previous.health:safeHealth(null),pairs:previous?.server_url===serverURL?previous.pairs:[],error:failureCode(error)};
  await writeMarketWorkerState(e,state);
  return state;
 }
}

export async function liveSignals(e:PriceEnvironment,owner:string){
 const rows=await e.DB.prepare("SELECT data FROM trades WHERE owner=? AND source='live' ORDER BY created_at DESC LIMIT 1000").bind(owner).all<{data:string}>();
 return rows.results.flatMap(row=>{try{return [JSON.parse(row.data) as Signal];}catch{return [];}});
}

export function completeCandles(candles:(Candle&{first_at?:number;last_at?:number;samples?:number;max_gap?:number})[],observedAt:number){
 return candles.filter(candle=>candle.time+60<=observedAt&&candle.first_at!=null&&candle.first_at-candle.time<=3&&candle.last_at!=null&&candle.time+60-candle.last_at<=8&&(candle.samples??0)>=8&&(candle.max_gap??Infinity)<=8);
}

async function storedCandles(e:PriceEnvironment,serverURL:string,asset:string){
 const rows=await e.DB.prepare('SELECT time,open,high,low,close,first_at,last_at,samples,max_gap FROM market_candles WHERE asset=? ORDER BY time DESC LIMIT 240').bind(serverURL+'|'+asset).all<Candle&{first_at:number;last_at:number;samples:number;max_gap:number}>();
 return rows.results.reverse();
}

export async function liveMarket(e:PriceEnvironment,owner:string,asset:string){
 const serverURL=await get_saved_server_url(e),worker=await readMarketWorkerState(e),observedAt=atNow(),same=worker?.server_url===serverURL,quotes=same?worker.pairs:[];
 const pairs=ASSETS.map(item=>{
  const quote=quotes.find(value=>value.symbol===item.symbol),fresh=!!quote&&quote.available&&quote.at!==null&&quote.at<=observedAt+2&&observedAt-quote.at<=8;
  return quote?{...quote,available:fresh,status:fresh?'live':'stale'}:{symbol:item.symbol,price:null,at:null,available:false,payout:null};
 });
 const selected=pairs.find(pair=>pair.symbol===asset),authorized=!!same&&!!worker?.health.authorized;
 const status=!same||!worker?'UNAUTHORIZED':worker.state==='ERROR'&&!selected?.available?'ERROR':!authorized?'UNAUTHORIZED':!selected||selected.price==null?'NO_QUOTES':selected.at==null?'UNTIMED':selected.available?'LIVE':'STALE';
 const signals=await liveSignals(e,owner),candles=await storedCandles(e,serverURL,asset);
 return {source:'live',server_url:serverURL,status,at:observedAt,candles,pairs,signals,metrics:metrics(signals),engine:{enabled:true,mode:'scheduled',running:!!worker&&same&&observedAt-worker.last_poll_at<15,last_poll_at:worker?.last_poll_at??null,last_success_at:worker?.last_success_at??null,error:worker?.error??null},health:worker?.health??safeHealth(null)};
}

export async function createLiveSignal(e:PriceEnvironment,owner:string,asset:string,duration:number,amount:number,minScore=80){
 const market=await liveMarket(e,owner,asset),observedAt=Math.floor(atNow());
 if(market.status!=='LIVE')throw new ApiError(409,market.status==='UNTIMED'?'quote_timestamp_missing':'stale_feed');
 if(market.signals.some(signal=>['PENDING','ACTIVE'].includes(signal.result)))throw new ApiError(409,'signal_active');
 const complete=completeCandles(market.candles,observedAt),last=complete.at(-1);
 if(!last||observedAt-last.time>125)throw new ApiError(409,'need_history');
 const tail:Candle[]=[];
 for(let index=complete.length-1;index>=0;index--){if(tail.length&&tail[0].time-complete[index].time!==60)break;tail.unshift(complete[index]);}
 const analysis=analyze(tail,observedAt);
 if(!analysis)throw new ApiError(409,'need_history');
 if(!analysis.ready||analysis.score<minScore||analysis.direction==='HOLD')throw new ApiError(409,'no_signal');
 const pair=market.pairs.find(value=>value.symbol===asset);
 if(!pair?.available)throw new ApiError(409,'asset_unavailable');
 const entryAt=nextSignalEntry(Date.now()/1000),lock=await e.DB.prepare('INSERT INTO signal_locks(owner,until) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET until=excluded.until WHERE signal_locks.until<=? RETURNING owner').bind(owner,entryAt+duration,observedAt).first();
 if(!lock)throw new ApiError(409,'signal_active');
 const signal:Signal={id:crypto.randomUUID(),asset,direction:analysis.direction,score:analysis.score,source:'live',server_url:market.server_url,created_at:observedAt,entry_at:entryAt,exit_at:entryAt+duration,entry_price:null,exit_price:null,result:'PENDING',amount:amount.toFixed(2),payout:pair.payout!=null?String(pair.payout/100):null,pnl:null,factors:JSON.stringify(analysis.factors)};
 await e.DB.prepare('INSERT INTO trades(id,owner,source,created_at,exit_at,result,data) VALUES(?,?,?,?,?,?,?)').bind(signal.id,owner,'live',observedAt,signal.exit_at,signal.result,JSON.stringify(signal)).run();
 return {signal};
}

export async function strongestLiveAsset(e:PriceEnvironment,owner:string,symbols:string[],minScore:number){
 const market=await liveMarket(e,owner,symbols[0]),observedAt=atNow();
 const ranked=await Promise.all(symbols.map(async asset=>{
  const quote=market.pairs.find(pair=>pair.symbol===asset);
  if(!quote?.available||quote.at==null||observedAt-quote.at>8||quote.at>observedAt)return null;
  const complete=completeCandles(await storedCandles(e,market.server_url,asset),observedAt),tail:Candle[]=[];
  for(let index=complete.length-1;index>=0;index--){if(tail.length&&tail[0].time-complete[index].time!==60)break;tail.unshift(complete[index]);}
  if(!tail.length||observedAt-tail.at(-1)!.time>125)return null;
  const analysis=analyze(tail,observedAt);
  return analysis?.ready&&analysis.score>=minScore?{asset,score:analysis.score}:null;
 }));
 const best=ranked.filter((value):value is {asset:string;score:number}=>value!==null).sort((a,b)=>b.score-a.score)[0];
 if(!best)throw new ApiError(409,'no_signal');
 return best.asset;
}
