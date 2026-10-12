import assert from 'node:assert/strict';
import {HUB,HOSTS,VERSION} from './config.mjs';
import {HEADER_VERSION} from './header.mjs';
const hosts=process.argv.slice(2);
if(!hosts.length)throw Error('At least one canonical host is required');
async function get(url){return fetch(url,{headers:{'User-Agent':'FleetRegistrationProbe/1.0 (read-only account surface check; no sign-in)'},redirect:'manual',signal:AbortSignal.timeout(20000)});}
async function check(host){
 if(host==='baipiaoji.com'){
  const r=await get(HUB+'/api/account-fleet'),j=await r.json();assert.equal(r.status,200);assert.equal(j.version,VERSION);assert.equal(j.available,true);
  for(const path of ['/account','/en/account']){const p=await get(HUB+path+'?__ci=1');assert.equal(p.status,200);assert((await p.text()).includes('/account-fleet.js'));}
  const script=await get(HUB+'/account-fleet.js');assert.equal(script.status,200);assert.match(await script.text(),/confirmed:true/);return;
 }
 assert(HOSTS.has(host));const base='https://'+host;
 const status=await get(base+'/auth/status');assert.equal(status.status,200);assert.deepEqual(await status.json(),{ok:true,user:null});assert.match(status.headers.get('Cache-Control'),/no-store/);
 const nav=await get(base+'/auth/nav.js');assert.equal(nav.status,200);assert((await nav.text()).includes('/auth/status'));
 const page=await get(base+'/auth/account');assert.equal(page.status,200);assert.equal(page.headers.get('X-Fleet-Account-Version'),VERSION);assert.match(page.headers.get('Cache-Control'),/no-store/);assert.match(page.headers.get('X-Robots-Tag'),/noindex/);const html=await page.text();assert(html.includes('data-fleet-start'),'Public registration choice missing');assert(!html.includes('googletagmanager'));
 if(['compass.agiscorecard.com','gushen.agiscorecard.com'].includes(host))return; // Native React entries are covered by local browser checks.
 const home=await fetch(base+'/?__ci=1',{headers:{'User-Agent':'FleetRegistrationProbe/1.0 (read-only account surface check; no sign-in)'},signal:AbortSignal.timeout(20000)});assert.equal(home.status,200);const publicHTML=await home.text();assert(/href="\/auth\/account(?:\?|")/.test(publicHTML),'Public entry missing on '+host);assert(publicHTML.includes('src="/auth/nav.js"'),'Account state script missing on '+host);assert.equal(home.headers.get('X-Fleet-Header-Version'),HEADER_VERSION);assert.equal((publicHTML.match(/data-fleet-header=/g)||[]).length,1,'One integrated header required on '+host);assert(!publicHTML.includes('<nav class="fleet-account-entry"'),'Detached account bar on '+host);
}
for(const host of hosts){let error;for(let attempt=0;attempt<6;attempt++){try{await check(host);error=null;break;}catch(e){error=e;if(attempt<5)await new Promise(r=>setTimeout(r,5000));}}if(error)throw error;console.log('PASS '+host+': public entry and private account surface checked with GET only; no OAuth flow, registration, authorization or business event performed.');}
