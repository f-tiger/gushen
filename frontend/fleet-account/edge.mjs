import {HUB,HOSTS,VERSION,TOKEN,FLOW_COOKIE,SESSION_COOKIE,SESSION_SECONDS,random,digest,cookie,cookieValue,escape,response,json} from './config.mjs';
import {navScript} from './nav.mjs';
import {integrateHeader,headerCSS,excludedPath} from './header.mjs';
const ROOT='/auth/account';
const css=headerCSS+`.fleet-account-entry{display:flex;justify-content:flex-end;gap:8px;padding:8px 16px;font:14px/1.4 system-ui,sans-serif;background:#f5f6f8;color:#172033}.fleet-account-entry a{max-width:240px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:inherit;text-decoration:underline}.fleet-account-page{box-sizing:border-box;max-width:580px;margin:8vh auto;padding:24px;font:16px/1.65 system-ui,sans-serif;color:#172033;background:#fff}.fleet-account-page h1{font-size:28px}.fleet-account-page button,.fleet-account-page .fleet-button{display:inline-block;margin:4px 4px 4px 0;padding:12px 18px;border:1px solid #172033;border-radius:8px;background:#172033;color:#fff;cursor:pointer;font:inherit;text-decoration:none}.fleet-account-page a{overflow-wrap:anywhere}.fleet-account-page button:disabled{opacity:.55}.fleet-account-page .fleet-muted{font-size:14px;color:#505b6e}.fleet-account-page [hidden]{display:none!important}`;
const app=`for(const a of document.querySelectorAll('[data-fleet-app]'))a.onclick=e=>{try{sessionStorage.setItem('workbench-member-key:agi','fleet');}catch{e.preventDefault();document.getElementById('fleet-status').textContent='Please allow browser storage and try again.';}};const note=document.getElementById('fleet-status'),logout=document.getElementById('fleet-logout');if(logout)logout.onclick=async()=>{logout.disabled=true;try{const r=await fetch('/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw Error();location.replace('/auth/account');}catch{note.textContent='暂时无法退出，请重试。 Could not sign out. Please retry.';logout.disabled=false;}};`;
async function hub(action,host,values={},token,fetcher=fetch){
 const r=await fetcher(HUB+'/api/account-fleet',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({action,host,...values}),redirect:'manual',signal:AbortSignal.timeout(12000)});
 const body=await r.json();if(!r.ok||!body.ok)throw Object.assign(Error('Account service unavailable'),{status:r.status});return body;
}
function page(host,body,status=200){return response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Account · ${escape(HOSTS.get(host))}</title><link rel="stylesheet" href="/auth/fleet.css"><script src="/auth/fleet.js" defer></script></head><body><main class="fleet-account-page"><a href="/">← ${escape(HOSTS.get(host))}</a><h1>账户 / Account</h1>${body}<p id="fleet-status" role="status"></p><p class="fleet-muted">账户服务由 BPJ 提供。登录信息不会发送给统计服务；注册不代表订阅营销邮件或购买会员。<br>Account service by BPJ. Sign-in details are excluded from analytics. Registration does not subscribe you to marketing or purchase a membership.</p><a href="${HUB}/account">管理账户 / Manage account</a> · <a href="${HUB}/privacy">隐私 / Privacy</a></main></body></html>`,status,{'Content-Type':'text/html; charset=utf-8','X-Fleet-Account-Version':VERSION});}
export async function accountRoute(request,env={},fetcher=fetch){
 const url=new URL(request.url),host=url.hostname,p=url.pathname;
 if(!HOSTS.has(host)||!p.startsWith('/auth/'))return null;
 if(url.origin!=='https://'+host)return json({error:'https_required'},403);
 if(p==='/auth/fleet.css'&&['GET','HEAD'].includes(request.method))return response(request.method==='HEAD'?null:css,200,{'Content-Type':'text/css; charset=utf-8'});
 if(p==='/auth/fleet.js'&&['GET','HEAD'].includes(request.method))return response(request.method==='HEAD'?null:app,200,{'Content-Type':'text/javascript; charset=utf-8'});
 if(p==='/auth/nav.js'&&['GET','HEAD'].includes(request.method))return response(request.method==='HEAD'?null:navScript,200,{'Content-Type':'text/javascript; charset=utf-8'});
 if(![ROOT,'/auth/google','/auth/callback','/auth/logout','/auth/status'].includes(p))return null;
 if(request.method==='HEAD'&&p===ROOT)return page(host,'');
 if(request.method!==(p==='/auth/logout'?'POST':'GET'))return json({error:'method_not_allowed'},405);
 try{
  if(p==='/auth/google'){
   const state=random(),verifier=random(),target=new URL('/account',HUB);
   target.searchParams.set('fleet',host);target.searchParams.set('state',state);target.searchParams.set('challenge',await digest(verifier));
   return response(null,303,{Location:target.href,'Set-Cookie':cookie(FLOW_COOKIE,state+'.'+verifier,900)});
  }
  if(p==='/auth/callback'){
   const flow=cookieValue(request,FLOW_COOKIE).split('.'),code=url.searchParams.get('code'),state=url.searchParams.get('state');
   if(flow.length!==2||!flow.every(v=>TOKEN.test(v))||!TOKEN.test(code||'')||state!==flow[0]||url.searchParams.getAll('state').length!==1||url.searchParams.getAll('code').length!==1)return page(host,'<p>登录链接已失效，请重新开始。 Sign-in link expired. Please start again.</p><a href="/auth/google">重新登录 / Sign in again</a>',400);
   const session=await hub('exchange',host,{code,verifier:flow[1]},undefined,fetcher);
   if(!TOKEN.test(session.token||''))throw Error('Invalid account response');
   const out=response(null,303,{Location:ROOT});out.headers.append('Set-Cookie',cookie(SESSION_COOKIE,session.token,SESSION_SECONDS));out.headers.append('Set-Cookie',cookie(FLOW_COOKIE,'',0));return out;
  }
  const token=cookieValue(request,SESSION_COOKIE);
  if(p==='/auth/logout'){
   if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'origin_rejected'},403);
   if(TOKEN.test(token)){try{await hub('logout',host,{},token,fetcher);}catch(e){if(e.status!==401)throw e;}}
   const out=json({ok:true});out.headers.append('Set-Cookie',cookie(SESSION_COOKIE,'',0));return out;
  }
  let user=null,expired=false;
  if(TOKEN.test(token)){try{user=(await hub('session',host,{},token,fetcher)).user;}catch(e){if(e.status!==401)throw e;expired=true;}}
  if(p==='/auth/status'){
   const out=json({ok:true,user:user?{username:user.username}:null});
   if(expired)out.headers.append('Set-Cookie',cookie(SESSION_COOKIE,'',0));
   return out;
  }
  const appLinks=host==='agiscorecard.com'?'<p><a data-fleet-app class="fleet-button" href="/jarvis">使用贾维斯 / Open Jarvis</a> <a data-fleet-app href="/discuss/account">加入讨论 / Join discussions</a></p>':'';
  const out=page(host,user?`<p>已登录 / Signed in as <strong>${escape(user.username)}</strong></p><p>${escape(user.email||'')}</p><p>你已使用统一账户登录本站。已有付费工作区仍使用原来的访问方式。<br>You are signed in to this site. Existing paid workspaces retain their original access method.</p>${appLinks}<a class="fleet-button" href="/">返回本站 / Continue to site</a> <button id="fleet-logout" type="button">退出本站 / Sign out</button>`:`<p>使用 Google 注册或登录，完成后返回 ${escape(HOSTS.get(host))}。<br>Register or sign in with Google, then return to ${escape(HOSTS.get(host))}.</p><a class="fleet-button" href="/auth/google">使用 Google 继续 / Continue with Google</a><p>将进入 baipiaoji.com 完成安全登录。也可使用已有 BPJ 账户。<br>Continue on baipiaoji.com to sign in securely. Existing BPJ accounts also work.</p>`);
  if(expired)out.headers.append('Set-Cookie',cookie(SESSION_COOKIE,'',0));return out;
 }catch{if(p==='/auth/status')return json({ok:false,error:'unavailable'},503);return page(host,'<p>账户服务暂时不可用，请稍后重试。 Account service is temporarily unavailable.</p><a href="/auth/account">重试 / Retry</a>',503);}
}
export function addAccountEntry(request,res){
 const url=new URL(request.url);
 if(!HOSTS.has(url.hostname)||request.method!=='GET'||res.status!==200||!res.headers.get('Content-Type')?.includes('text/html')||typeof HTMLRewriter==='undefined')return res;
 if(excludedPath(url.pathname)||/noindex/i.test(res.headers.get('X-Robots-Tag')||''))return res;
 // Preserve each site's response-specific CSP rather than weakening it or
 // injecting a script that the original policy rejects.
 const nonce=/\bscript-src(?:-elem)?\s+[^;]*'nonce-([A-Za-z0-9+/_=-]{1,256})'/.exec(res.headers.get('Content-Security-Policy')||'')?.[1];
 const script='<script defer src="/auth/nav.js"'+(nonce?' nonce="'+nonce+'"':'')+'></script>';
 return integrateHeader(request,res,script);
}
export function withFleetAccount(worker,adaptRequest){return {...worker,async fetch(request,env,ctx){const result=await accountRoute(request,env);if(result)return result;if(adaptRequest){const adapted=await adaptRequest(request,env);if(adapted instanceof Response)return adapted;request=adapted;}return addAccountEntry(request,await worker.fetch.call(worker,request,env,ctx));}};}
