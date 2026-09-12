"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {Activity,ChevronLeft,ChevronRight,Minus,Plus,RotateCcw,ScanLine} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {assetOf,bands,emaSeries,rsiSeries,cciSeries,macdSeries,type Candle,type Signal} from '@/lib/market';
export type Layers={ema:boolean;bands:boolean;levels:boolean;rsi:boolean;cci:boolean;macd:boolean};
type Hover={index:number;x:number;y:number}|null;
type Drag={x:number;y:number;offset:number;axis:'pending'|'x'|'y';pointerId:number}|null;
const COLORS={ink:'#183d35',muted:'#718a7d',grid:'#e3eee8',green:'#07966a',red:'#e44f70',gold:'#c28b30',violet:'#7967dc',blue:'#4f86a2',surface:'#fbfefc',pane:'#f6faf7'};
export default function MarketChart({candles,asset,layers,source,signal}:{candles:Candle[];asset:string;layers:Layers;source:string;signal?:Signal}){
 const wrap=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),drag=useRef<Drag>(null);
 const [width,setWidth]=useState(760),[count,setCount]=useState(64),[offset,setOffset]=useState(0),[hover,setHover]=useState<Hover>(null);
 const precision=assetOf(asset).base>=1000?3:assetOf(asset).base>=10?4:5;
 const data=useMemo(()=>{const sorted=candles.filter(v=>Number.isFinite(v.time)&&[v.open,v.high,v.low,v.close].every(Number.isFinite)&&v.high>=Math.max(v.open,v.close,v.low)&&v.low<=Math.min(v.open,v.close,v.high)).sort((a,b)=>a.time-b.time);return sorted.filter((v,i)=>!i||v.time!==sorted[i-1].time);},[candles]);
 const series=useMemo(()=>{const close=data.map(v=>v.close);return{e9:emaSeries(close,9),e21:emaSeries(close,21),e50:emaSeries(close,50),bb:bands(data),rsi:rsiSeries(close),cci:cciSeries(data),macd:macdSeries(data)};},[data]);
 const paneCount=[layers.rsi,layers.cci,layers.macd].filter(Boolean).length,mainHeight=390,height=mainHeight+paneCount*108;
 const maxOffset=Math.max(0,data.length-Math.min(count,data.length));
 useEffect(()=>{setOffset(0);setHover(null);},[asset,source]);
 useEffect(()=>{setOffset(v=>Math.min(v,maxOffset));},[maxOffset]);
 useEffect(()=>{if(!wrap.current)return;const ob=new ResizeObserver(e=>{const w=Math.max(290,Math.floor(e[0].contentRect.width));setWidth(w);if(w<560)setCount(v=>Math.min(v,38));});ob.observe(wrap.current);return()=>ob.disconnect();},[]);
 const windowed=useMemo(()=>{const end=Math.max(0,data.length-offset),start=Math.max(0,end-count);return{start,end,rows:data.slice(start,end)};},[data,count,offset]);
 useEffect(()=>{const el=canvas.current;if(!el)return;const dpr=Math.min(2,window.devicePixelRatio||1);el.width=Math.floor(width*dpr);el.height=Math.floor(height*dpr);el.style.width=width+'px';el.style.height=height+'px';const x=el.getContext('2d');if(!x)return;x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,width,height);x.fillStyle=COLORS.surface;x.fillRect(0,0,width,height);
  const rows=windowed.rows,left=14,right=76,top=19,bottom=31,plotW=Math.max(1,width-left-right),plotH=mainHeight-top-bottom,step=plotW/Math.max(1,rows.length),cx=(i:number)=>left+(i+.5)*step;
  const priceValues=rows.flatMap(v=>[v.high,v.low]);if(layers.bands)series.bb.slice(windowed.start,windowed.end).forEach(v=>{if(v)priceValues.push(v.upper,v.lower);});if(layers.ema)for(const k of ['e9','e21','e50'] as const)series[k].slice(windowed.start,windowed.end).forEach(v=>{if(v!=null)priceValues.push(v);});
  let lo=priceValues.length?Math.min(...priceValues):0,hi=priceValues.length?Math.max(...priceValues):1;const pad=(hi-lo)*.12||Math.abs(hi)*.0005||.01;lo-=pad;hi+=pad;const cy=(v:number)=>top+(hi-v)/(hi-lo)*plotH,fmt=(v:number)=>v.toFixed(precision);
  x.font='11px Arial';x.lineWidth=1;x.textBaseline='middle';for(let i=0;i<6;i++){const yy=top+plotH*i/5,val=hi-(hi-lo)*i/5;x.strokeStyle=COLORS.grid;x.beginPath();x.moveTo(left,yy+.5);x.lineTo(width-right,yy+.5);x.stroke();x.fillStyle=COLORS.muted;x.textAlign='left';x.fillText(fmt(val),width-right+8,yy);}
  const ticks=width<500?3:6;for(let i=0;i<ticks;i++){const at=Math.min(rows.length-1,Math.round(i*Math.max(0,rows.length-1)/(ticks-1||1)));if(at<0)continue;const xx=cx(at);x.strokeStyle='#edf3ef';x.beginPath();x.moveTo(xx,top);x.lineTo(xx,mainHeight-bottom);x.stroke();x.fillStyle=COLORS.muted;x.textAlign='center';x.fillText(new Date(rows[at].time*1000).toLocaleTimeString('en-GB',{timeZone:'UTC',hour:'2-digit',minute:'2-digit'}),xx,mainHeight-13);}
  const line=(values:(number|null)[],color:string,dash:number[]=[] )=>{x.beginPath();x.strokeStyle=color;x.lineWidth=1.45;x.setLineDash(dash);let begun=false;values.slice(windowed.start,windowed.end).forEach((v,i)=>{if(v==null||!Number.isFinite(v)){begun=false;return;}const xx=cx(i),yy=cy(v);if(!begun){x.moveTo(xx,yy);begun=true;}else x.lineTo(xx,yy);});x.stroke();x.setLineDash([]);};
  if(layers.bands){line(series.bb.map(v=>v?.upper??null),COLORS.blue,[4,4]);line(series.bb.map(v=>v?.lower??null),COLORS.blue,[4,4]);}
  if(layers.levels&&rows.length>=24){const tail=rows.slice(-24),levels=[[Math.min(...tail.map(v=>v.low)),'S','#24a585'],[Math.max(...tail.map(v=>v.high)),'R',COLORS.gold]] as const;for(const [v,label,color] of levels){const yy=cy(v);x.strokeStyle=color;x.setLineDash([6,5]);x.beginPath();x.moveTo(left,yy);x.lineTo(width-right,yy);x.stroke();x.setLineDash([]);x.fillStyle=color;x.textAlign='left';x.fillText(label,left+4,yy-7);}}
  const body=Math.max(2,Math.min(16,step*.64));rows.forEach((v,i)=>{const up=v.close>=v.open,color=up?COLORS.green:COLORS.red,xx=cx(i);x.strokeStyle=color;x.lineWidth=Math.max(1,Math.min(2,step*.12));x.beginPath();x.moveTo(xx,cy(v.high));x.lineTo(xx,cy(v.low));x.stroke();x.fillStyle=color;const y1=cy(v.open),y2=cy(v.close);x.fillRect(xx-body/2,Math.min(y1,y2),body,Math.max(1.5,Math.abs(y1-y2)));});
  if(layers.ema){line(series.e9,'#0ab691');line(series.e21,COLORS.gold);line(series.e50,COLORS.violet);}
  if(signal?.asset===asset&&signal.entry_price){const v=Number(signal.entry_price);if(v>=lo&&v<=hi){const yy=cy(v);x.strokeStyle=COLORS.gold;x.setLineDash([8,4]);x.beginPath();x.moveTo(left,yy);x.lineTo(width-right,yy);x.stroke();x.setLineDash([]);x.fillStyle=COLORS.gold;x.textAlign='left';x.fillText('ENTRY '+signal.direction,left+6,yy-9);}}
  const last=rows.at(-1);if(last){const yy=cy(last.close);x.strokeStyle=last.close>=last.open?COLORS.green:COLORS.red;x.setLineDash([3,3]);x.beginPath();x.moveTo(left,yy);x.lineTo(width-right,yy);x.stroke();x.setLineDash([]);x.fillStyle=last.close>=last.open?COLORS.green:COLORS.red;x.fillRect(width-right,yy-11,right-3,22);x.fillStyle='#fff';x.textAlign='left';x.fillText(fmt(last.close),width-right+6,yy);}
  let pane=0;const drawPane=(name:string,values:(number|null)[],min:number,max:number,color:string,levels:number[]=[],bars=false)=>{const py=mainHeight+pane++*108,ph=108,plotTop=py+22,plotBottom=py+ph-13,fy=(v:number)=>plotTop+(max-v)/(max-min)*(plotBottom-plotTop);x.fillStyle=pane%2?COLORS.pane:COLORS.surface;x.fillRect(0,py,width,ph);x.strokeStyle='#dce9e1';x.beginPath();x.moveTo(0,py+.5);x.lineTo(width,py+.5);x.stroke();x.fillStyle=COLORS.ink;x.textAlign='left';x.font='600 11px Arial';x.fillText(name,left,py+12);levels.forEach(v=>{const yy=fy(v);x.strokeStyle=COLORS.grid;x.setLineDash([4,4]);x.beginPath();x.moveTo(left,yy);x.lineTo(width-right,yy);x.stroke();x.setLineDash([]);x.fillStyle=COLORS.muted;x.font='10px Arial';x.fillText(String(v),width-right+8,yy);});const visible=values.slice(windowed.start,windowed.end);if(bars){visible.forEach((v,i)=>{if(v==null)return;const zero=fy(0),yy=fy(v);x.fillStyle=v>=0?'#51b995':'#e8798e';x.fillRect(cx(i)-Math.max(1,body*.35),Math.min(zero,yy),Math.max(2,body*.7),Math.max(1,Math.abs(zero-yy)));});}else{ x.strokeStyle=color;x.lineWidth=1.4;x.beginPath();let begun=false;visible.forEach((v,i)=>{if(v==null){begun=false;return;}const xx=cx(i),yy=fy(v);if(!begun){x.moveTo(xx,yy);begun=true;}else x.lineTo(xx,yy);});x.stroke();}const val=visible.filter(v=>v!=null).at(-1);x.fillStyle=color;x.textAlign='right';x.font='600 10px Arial';x.fillText(val==null?'—':val.toFixed(2),width-right-5,py+12);};
  if(layers.rsi)drawPane('RSI 14',series.rsi,0,100,COLORS.violet,[30,50,70]);if(layers.cci){const visible=series.cci.slice(windowed.start,windowed.end).filter((v):v is number=>v!=null),limit=Math.max(200,...visible.map(Math.abs));drawPane('CCI 20',series.cci,-limit,limit,COLORS.gold,[-100,0,100]);}if(layers.macd){const m=series.macd.map(v=>v.hist),visible=m.slice(windowed.start,windowed.end).filter((v):v is number=>v!=null),limit=Math.max(.000001,...visible.map(Math.abs));drawPane('MACD 12 · 26 · 9',m,-limit,limit,COLORS.green,[0],true);}
  if(hover&&rows[hover.index]){const xx=cx(hover.index),v=rows[hover.index],yy=cy(v.close);x.strokeStyle='#4d8c70';x.setLineDash([3,4]);x.beginPath();x.moveTo(xx,top);x.lineTo(xx,height);x.moveTo(left,yy);x.lineTo(width-right,yy);x.stroke();x.setLineDash([]);x.fillStyle='#155f47';x.beginPath();x.arc(xx,yy,3,0,Math.PI*2);x.fill();}
 },[width,height,windowed,series,layers,signal,asset,precision,hover]);
 const selected=hover&&windowed.rows[hover.index]?windowed.rows[hover.index]:windowed.rows.at(-1),fmt=(v:number)=>v.toFixed(precision);
 const point=(e:React.PointerEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-r.left)*width/r.width,y:(e.clientY-r.top)*height/r.height};};
 const move=(e:React.PointerEvent<HTMLCanvasElement>)=>{
  const p=point(e),plotW=Math.max(1,width-90),step=plotW/Math.max(1,windowed.rows.length),active=drag.current;
  if(active){
   const dx=p.x-active.x,dy=p.y-active.y;
   if(active.axis==='pending'&&Math.max(Math.abs(dx),Math.abs(dy))>=7){
    active.axis=Math.abs(dx)>Math.abs(dy)*1.15?'x':'y';
    if(active.axis==='x'&&!e.currentTarget.hasPointerCapture(active.pointerId)){
     try{e.currentTarget.setPointerCapture(active.pointerId);}catch{/* The pointer may already be released by the browser. */}
    }
    if(active.axis==='y')setHover(null);
   }
   // Vertical touch gestures belong to the page; only horizontal gestures pan candles.
   if(active.axis==='y')return;
   if(active.axis==='x'){
    const delta=Math.round(dx/Math.max(1,step));
    setOffset(Math.max(0,Math.min(maxOffset,active.offset+delta)));
   }
  }
  const i=Math.max(0,Math.min(windowed.rows.length-1,Math.floor((p.x-14)/Math.max(1,step))));
  setHover(windowed.rows.length?{index:i,x:p.x,y:p.y}:null);
 };
 const finishDrag=(target:HTMLCanvasElement)=>{
  const active=drag.current;
  drag.current=null;
  if(active&&target.hasPointerCapture(active.pointerId))target.releasePointerCapture(active.pointerId);
 };
 const zoom=(delta:number)=>setCount(v=>Math.max(18,Math.min(Math.min(160,Math.max(18,data.length||160)),v+delta)));
 return <div ref={wrap} className="pro-chart vap-canvas-engine">
  <div className="engine-readout"><div><span>{assetOf(asset).label} · {source==='demo'?'DEMO':source==='csv'?'CSV':'OTC LIVE'}</span><b dir="ltr">{selected?fmt(selected.close):'—'}</b></div><div className="vap-chart-badges"><span><ScanLine/>VAP CANDLE CORE</span><span className="engine-timeframe">1 MIN <small>UTC</small></span></div></div>
  <div className="engine-ohlc">{(['open','high','low','close'] as const).map((k,i)=><span key={k}>{['O','H','L','C'][i]} <b>{selected?fmt(selected[k]):'—'}</b></span>)}<span>TIME <b>{selected?new Date(selected.time*1000).toLocaleTimeString('en-GB',{timeZone:'UTC',hour:'2-digit',minute:'2-digit'}):'—'}</b></span></div>
  <div className="vap-canvas-wrap">
   <canvas ref={canvas} aria-label={'شارت شموع دقيقة مبرمج داخل البوت للزوج '+assetOf(asset).label} role="img"
    onPointerDown={e=>{const p=point(e),mouse=e.pointerType==='mouse';drag.current={x:p.x,y:p.y,offset,axis:mouse?'x':'pending',pointerId:e.pointerId};if(mouse)e.currentTarget.setPointerCapture(e.pointerId);}}
    onPointerMove={move}
    onPointerUp={e=>finishDrag(e.currentTarget)}
    onPointerCancel={e=>finishDrag(e.currentTarget)}
    onLostPointerCapture={()=>{if(drag.current?.axis==='x')drag.current=null;}}
    onPointerLeave={()=>{if(!drag.current)setHover(null);}}
    onWheel={e=>{e.preventDefault();zoom(e.deltaY>0?8:-8);}}/>
   {!windowed.rows.length&&<div className="engine-empty"><Activity/><b>بانتظار شموع الدقيقة</b><p>يُرسم الشارت من بيانات سيرفر الأسعار الخاص بعد اكتمال كل شمعة.</p></div>}
  </div>
  <div className="vap-chart-legend"><div>{layers.ema&&<><span><i style={{background:'#0ab691'}}/>EMA 9</span><span><i style={{background:'#c28b30'}}/>EMA 21</span><span><i style={{background:'#7967dc'}}/>EMA 50</span></>}{layers.bands&&<span><i style={{background:'#4f86a2'}}/>BOLLINGER</span>}{layers.levels&&<span><i style={{background:'#24a585'}}/>S/R</span>}</div><div className="engine-controls"><Button variant="ghost" aria-label="شموع أقدم" onClick={()=>setOffset(v=>Math.min(maxOffset,v+15))}><ChevronLeft/></Button><Button variant="ghost" aria-label="تصغير" onClick={()=>zoom(10)}><Minus/></Button><Button variant="ghost" aria-label="تكبير" onClick={()=>zoom(-10)}><Plus/></Button><Button variant="ghost" aria-label="شموع أحدث" onClick={()=>setOffset(v=>Math.max(0,v-15))}><ChevronRight/></Button><Button variant="ghost" aria-label="العودة لآخر شمعة" onClick={()=>{setOffset(0);setCount(width<560?38:64);}}><RotateCcw/></Button></div></div>
  <div className="vap-chart-foot"><span>محرك رسم داخلي · Canvas عالي الدقة</span><span className="vap-gesture-hint">↕ مرّر الصفحة · ↔ حرّك الشموع</span><span>{windowed.rows.length} شمعة معروضة · {data.length} محفوظة</span></div>
 </div>;
}
