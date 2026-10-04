import {accountCopy} from './header.mjs';
// Only private, same-origin status JSON supplies a name. Never persist identity
// in storage or bake it into public/cached HTML or analytics events.
export const navScript=`(()=>{
const links=[...document.querySelectorAll('.fleet-account-entry a')];if(!links.length)return;
const lang=document.documentElement.lang;const copy=${JSON.stringify(accountCopy)}[lang.startsWith('zh')?'zh':lang.split('-')[0]]||${JSON.stringify(accountCopy.en)};let pending=false,last=0;
function show(user,unknown=false){for(const a of links){a.textContent=user?'✓ '+user.username:unknown?copy[1]:copy[0];a.title=user?copy[2]+user.username:'';a.setAttribute('aria-label',user?a.title+', '+copy[3]:a.textContent);}}
async function refresh(force=false){if(pending||(!force&&Date.now()-last<15000))return;pending=true;last=Date.now();try{const r=await fetch('/auth/status',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error();const j=await r.json();if(!j.ok)throw Error();show(j.user);}catch{show(null,true);}finally{pending=false;}}
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.fleet-language[open]').forEach(d=>{d.open=false;d.querySelector('summary')?.focus();});});
document.addEventListener('click',e=>document.querySelectorAll('.fleet-language[open]').forEach(d=>{if(!d.contains(e.target))d.open=false;}));
refresh(true);window.addEventListener('focus',()=>refresh());window.addEventListener('pageshow',e=>{if(e.persisted)refresh(true);});
})();`;
