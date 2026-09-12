import {flushAccumulatedCandles,pollMarketOnce,type MarketAccumulator,type MarketWorkerState,type PriceEnvironment} from './price-server';

const LEASE_KEY='__market_background_lease';

export type BackgroundRunOptions={
 durationMs?:number;
 intervalMs?:number;
 checkpointMs?:number;
 now?:()=>number;
 sleep?:(milliseconds:number)=>Promise<void>;
};

export type BackgroundRunReport={
 ok:boolean;
 skipped:boolean;
 polls:number;
 candles_written:number;
 started_at:number;
 finished_at:number;
 state:MarketWorkerState['state']|null;
};

const wait=(milliseconds:number)=>new Promise<void>(resolve=>setTimeout(resolve,milliseconds));

async function acquireLease(e:PriceEnvironment,at:number,leaseSeconds:number){
 const row=await e.DB.prepare(
  'INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?) '+
  'ON CONFLICT(key) DO UPDATE SET count=count+1,reset_at=excluded.reset_at '+
  'WHERE reset_at<=? RETURNING reset_at',
 ).bind(LEASE_KEY,at+leaseSeconds,at).first<{reset_at:number}>();
 return row?.reset_at??null;
}

async function releaseLease(e:PriceEnvironment,leaseUntil:number,at:number){
 // Compare-and-set ensures an old invocation cannot release a newer lease.
 await e.DB.prepare('UPDATE rate_limits SET reset_at=? WHERE key=? AND reset_at=?').bind(at,LEASE_KEY,leaseUntil).run();
}

/**
 * Cloudflare cron fires once per minute. This invocation remains alive for the
 * minute and samples every two seconds, so the browser is never part of the
 * collection or settlement lifecycle.
 */
export async function runScheduledMarketWindow(e:PriceEnvironment,options:BackgroundRunOptions={}):Promise<BackgroundRunReport>{
 const durationMs=Math.max(0,Math.min(options.durationMs??56_000,58_000));
 const intervalMs=Math.max(250,Math.min(options.intervalMs??2_000,10_000));
 const checkpointMs=Math.max(intervalMs,Math.min(options.checkpointMs??20_000,55_000));
 const clock=options.now??Date.now;
 const sleep=options.sleep??wait;
 const startedMs=clock(),startedAt=startedMs/1000;
 const leaseSeconds=Math.ceil((durationMs+15_000)/1000);
 const leaseUntil=await acquireLease(e,startedAt,leaseSeconds);
 if(leaseUntil===null)return {ok:true,skipped:true,polls:0,candles_written:0,started_at:startedAt,finished_at:clock()/1000,state:null};

 const accumulator:MarketAccumulator=new Map();
 let polls=0,candlesWritten=0,lastCheckpoint=startedMs,lastState:MarketWorkerState|null=null,ok=true;
 try{
  while(true){
   const cycleStarted=clock();
   lastState=await pollMarketOnce(e,accumulator,cycleStarted/1000);
   polls+=1;

   const currentBucket=Math.floor(cycleStarted/60_000)*60;
   candlesWritten+=await flushAccumulatedCandles(e,accumulator,currentBucket);
   if(cycleStarted-lastCheckpoint>=checkpointMs){
    candlesWritten+=await flushAccumulatedCandles(e,accumulator);
    lastCheckpoint=cycleStarted;
   }

   const elapsed=clock()-startedMs;
   if(elapsed>=durationMs)break;
   await sleep(Math.min(intervalMs,Math.max(0,durationMs-elapsed)));
  }
 }catch(error){
  ok=false;
  console.error('Market worker cycle failed',error instanceof Error?error.name:'unknown');
 }finally{
  try{candlesWritten+=await flushAccumulatedCandles(e,accumulator);}catch{ok=false;}
  try{await releaseLease(e,leaseUntil,clock()/1000);}catch{ok=false;}
 }
 return {ok,skipped:false,polls,candles_written:candlesWritten,started_at:startedAt,finished_at:clock()/1000,state:lastState?.state??null};
}
