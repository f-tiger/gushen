// Public routing allowlist. No wildcard or caller-supplied return URLs.
export const HUB='https://baipiaoji.com';
export const VERSION='fleet-account-20261004.1';
export const HOSTS=new Map([
 ['agiscorecard.com','AGI Scorecard'],['getecoback.com','EcoBack'],['thedollscout.com','The Doll Scout'],
 ['goldrush.agiscorecard.com','GoldRush'],['play.agiscorecard.com','Gridlings'],['source.agiscorecard.com','SourceRadar'],['games.agiscorecard.com','GamesLedger'],
 ['35.agiscorecard.com','After35'],['learn.agiscorecard.com','Learn'],['fanzha.agiscorecard.com','Fanzha'],['firstjob.agiscorecard.com','FirstJob'],['codeword.agiscorecard.com','Codeword'],['powerbill.agiscorecard.com','PowerBill'],
 ['localebatch.agiscorecard.com','LocaleBatch'],['verify.agiscorecard.com','Agent Delivery Lab'],
 ['rfqdesk.agiscorecard.com','RFQ Desk'],['modelmeter.agiscorecard.com','ModelMeter'],['querysprint.agiscorecard.com','QuerySprint'],['filinglens.agiscorecard.com','FilingLens'],
 ...['web3','reconcile','evidence','route','protocol','permit','compute','incentives','proof','calls','disclosures'].map(x=>[x+'.agiscorecard.com',x]),
 ['invest.agiscorecard.com','SunWatch'],
 ['compass.agiscorecard.com','AI Investing Compass'],['gushen.agiscorecard.com','Gushen'],
 ['agents.agiscorecard.com','Agentic Finance'],['index.agiscorecard.com','Agentic Finance Index'],['x402.agiscorecard.com','x402 Watch'],['wallets.agiscorecard.com','Agent Wallets'],['pay.agiscorecard.com','Agent Settlement']
]);
export const TOKEN=/^[A-Za-z0-9_-]{43}$/;
export const SESSION_COOKIE='__Host-fleet_account';
export const FLOW_COOKIE='__Host-fleet_flow';
export const SESSION_SECONDS=30*86400;
export const now=()=>Math.floor(Date.now()/1000);
export const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
export const digest=async value=>b64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
export const cookie=(name,value,age)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
export function cookieValue(request,name){const matches=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'='));return matches.length===1?matches[0].slice(name.length+1):'';}
export const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const privateHeaders={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
export function response(body,status=200,headers={}){return new Response(body,{status,headers:{...privateHeaders,...headers}});}
export const json=(body,status=200)=>response(JSON.stringify(body),status,{'Content-Type':'application/json; charset=utf-8'});
