"use client";
import {useState,type FormEvent} from 'react';
import {Activity,ArrowUpLeft,Bot,Cpu,Eye,EyeOff,Layers3,LockKeyhole,Mountain,Radio,ScanLine,ShieldCheck,Sparkles,Target,Zap} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {ASSETS} from '@/lib/market';

export default function LicenseGate({value,onChange,onSubmit,busy,restoring,error}:{value:string;onChange:(v:string)=>void;onSubmit:(e:FormEvent)=>void;busy:boolean;restoring:boolean;error:string}){
 const [visible,setVisible]=useState(false);
 const focusEntry=()=>{document.getElementById('license-key')?.focus();document.getElementById('access-card')?.scrollIntoView({behavior:'smooth',block:'center'});};
 const loading=busy||restoring;
 return <main className="aurora-gate">
  <div className="aurora-light aurora-light-one"/><div className="aurora-light aurora-light-two"/>
  <header className="aurora-nav">
   <div className="aurora-brand" dir="ltr"><span><Mountain/></span><div><b>QUOTEX</b><small>V26 · AURORA</small></div></div>
   <div className="aurora-owner" dir="ltr">ENGINEERED BY <b>BSHAR SALMAT SY</b></div>
   <Button className="aurora-nav-cta" onClick={focusEntry}>دخول الأعضاء <ArrowUpLeft/></Button>
  </header>
  <section className="aurora-hero">
   <div className="aurora-copy" dir="ltr">
    <span className="aurora-kicker"><Sparkles/> THE ALL-IN-ONE QUOTEX TRADING PLATFORM</span>
    <h1>Trade Smarter.<br/><em>Win Consistently.</em></h1>
    <p>Quotex signals, an AI signal generator and transparent tracking — everything a serious Quotex trader needs, in one platform.</p>
    <div className="aurora-chips"><span><Bot/>AI Signal Engine</span><span><ShieldCheck/>Verified Traders Only</span><span><Radio/>Real-time Signals</span></div>
    <div className="aurora-metrics"><div><b>10</b><small>OTC PAIRS</small></div><div><b>5×</b><small>CONFLUENCE</small></div><div><b>1m</b><small>CANDLE CORE</small></div></div>
   </div>
   <section className={'aurora-vault '+(loading?'is-scanning':'')} id="access-card">
    <div className="aurora-scene">
     <img src="/alpine-mint-orb.png" alt="ماسح زمردي وسط خلفية جبلية ثلجية"/>
     <div className="aurora-scene-shade"/><div className="aurora-grid"/>
     <div className="aurora-radar"><i/><i/><i/><span><ScanLine/></span></div>
     <div className="aurora-scan-line"/>
     <div className="aurora-scene-top" dir="ltr"><span><Activity/> SECURE NODE</span><b>V26 / 2026</b></div>
     <div className="aurora-scene-title" dir="ltr"><small>PRIVATE INTELLIGENCE TERMINAL</small><b>VAP <em>PRO</em></b><span>OTC · SIGNALS · AI</span></div>
    </div>
    <div className="aurora-access">
     <div className="aurora-access-head"><span><ShieldCheck/></span><div><small>VERIFIED ACCESS</small><b>افتح منصة التحليل</b></div><i>{loading?'SCAN':'READY'}</i></div>
     <p>أدخل رمز الترخيص للوصول إلى الشارت والإشارات وغرف الإدارة.</p>
     <form onSubmit={onSubmit}>
      <label htmlFor="license-key">رمز الوصول الخاص</label>
      <div className="aurora-code"><LockKeyhole/><Input id="license-key" type={visible?'text':'password'} value={value} onChange={e=>onChange(e.target.value)} autoComplete="off" placeholder="أدخل رمز الترخيص" maxLength={32} required/><button type="button" onClick={()=>setVisible(!visible)} aria-label={visible?'إخفاء الرمز':'إظهار الرمز'}>{visible?<EyeOff/>:<Eye/>}</button></div>
      <Button className="aurora-submit" disabled={loading} type="submit">{busy?'جارٍ فحص الترخيص…':restoring?'استعادة الجلسة…':'تفعيل النظام والدخول'}<ArrowUpLeft/></Button>
      <p className="site-error" role="alert" aria-live="polite">{error}</p>
     </form>
     <div className="aurora-assurance"><span><LockKeyhole/>دخول محمي</span><span><Target/>نتائج موثقة</span><span><Cpu/>محرك داخلي</span></div>
    </div>
   </section>
  </section>
  <section className="aurora-platform" dir="ltr">
   <div className="aurora-section-head"><div><span>ONE PLATFORM · EVERY SIGNAL</span><h2>Quotex Signals,<br/><em>in your pocket.</em></h2></div><Button onClick={focusEntry}>Join Free <Zap/></Button></div>
   <p className="aurora-description">Quotex signals, profit leaderboards, daily cash giveaways, an AI signal generator, 1-on-1 mentorship and private messaging — everything a serious Quotex trader needs, in one platform.</p>
   <div className="aurora-feature-grid">
    <article><span>01 / SIGNALS</span><Radio/><h3>Quotex Signals</h3><p>AI-curated, multi-session high-accuracy signals published by our confluence engine — every published signal is tracked transparently so you see the real win rate over time.</p><b>REAL-TIME SIGNALS</b></article>
    <article><span>02 / INTELLIGENCE</span><Bot/><h3>Signal Generator</h3><p>Generate your own high-accuracy signals with the 5-factor confluence engine — RSI, EMA, CCI, trend bias and candle logic — on live Quotex market data.</p><b>AI SIGNAL ENGINE</b></article>
    <article><span>03 / TRANSPARENCY</span><Target/><h3>Every Signal. Tracked.</h3><p>Morning & evening sessions, multi-factor scored, published live — then auto-tracked so the accuracy you see is the accuracy you get.</p><b>WIN · LOSS · DRAW</b></article>
   </div>
   <div className="aurora-roadmap"><span>NEXT MODULES</span><b>Real Cash Prizes <small>COMING SOON</small></b><b>1-on-1 Mentorship <small>COMING SOON</small></b><b>Private Messaging <small>COMING SOON</small></b></div>
  </section>
  <section className="aurora-pairs"><div><Layers3/><b>10 OTC PAIRS</b><span>اختيار زوج أو مسح تلقائي</span></div><div>{ASSETS.map(a=><span key={a.symbol}><i>{a.flag}</i><b dir="ltr">{a.label}</b><small>OTC</small></span>)}</div></section>
  <p className="aurora-disclosure">عبارات المنتج تصف خصائص المنصة. توافق المؤشرات ليس احتمال فوز أو ضمان أرباح. الجوائز والإرشاد والرسائل ميزات مخطط لها وغير مفعلة حاليًا.</p>
  <footer className="aurora-footer"><span>BSHAR SALMAT SY · QUOTEX V26 AURORA</span><span>VAP CANDLE CORE · CUSTOM ENGINE</span><span>© 2026 LegendJournal · All rights reserved</span></footer>
 </main>;
}
