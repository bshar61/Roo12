import {ApiError,publicHttps} from './security';
import {DEFAULT_SERVER_URL} from './defaults';
type Storage={DB:D1Database};
export async function get_saved_server_url(e:Storage){await e.DB.prepare('INSERT OR IGNORE INTO server_config(id,url,checked_at) VALUES(?,?,0)').bind('prices',DEFAULT_SERVER_URL).run();const row=await e.DB.prepare('SELECT url FROM server_config WHERE id=?').bind('prices').first<{url:string}>();if(!row)throw new ApiError(503,'service_unavailable');return row.url;}
export async function save_server_url(e:Storage,value:string){
 let url:string;try{url=publicHttps(value.trim());}catch{throw new ApiError(400,'new_server_failed');}
 // Validate the candidate without secrets and before any mutation.
 let health:any;try{const r=await fetch(url+'/health',{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('status');const text=await r.text();if(text.length>100000)throw Error('size');health=JSON.parse(text);if(health?.server!=='ok')throw Error('health');}catch{throw new ApiError(400,'new_server_failed');}
 const current=await get_saved_server_url(e),statements:D1PreparedStatement[]=[];
 if(url!==current){statements.push(e.DB.prepare("DELETE FROM signal_locks WHERE owner IN (SELECT owner FROM trades WHERE source='live' AND result IN ('PENDING','ACTIVE'))"));statements.push(e.DB.prepare("UPDATE trades SET result='UNVERIFIED',data=json_set(data,'$.result','UNVERIFIED','$.reason',?) WHERE source='live' AND result IN ('PENDING','ACTIVE')").bind('تم تغيير سيرفر الأسعار أثناء متابعة الإشارة'));}
 statements.push(e.DB.prepare('UPDATE server_config SET url=?,checked_at=? WHERE id=?').bind(url,Math.floor(Date.now()/1000),'prices'));
 await e.DB.batch(statements);return {url,health:{server:health.server,authorized:health.authorized===true,quotex:health.quotex??null,ssid_loaded:health.ssid_loaded===true,price_updates:health.price_updates??null,live_pairs:health.live_pairs??null,total_pairs:health.total_pairs??null}};
}
