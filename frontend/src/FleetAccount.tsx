import {useEffect,useState} from 'react';
export default function FleetAccount({locale}:{locale:string}){
 const [state,setState]=useState<{name:string|null;unknown:boolean}>({name:null,unknown:false});
 useEffect(()=>{let active=true,pending=false,last=0;async function refresh(force=false){if(pending||(!force&&Date.now()-last<15000))return;pending=true;last=Date.now();try{const r=await fetch('/auth/status',{credentials:'same-origin',cache:'no-store'});const j=await r.json();if(!r.ok||!j.ok)throw Error();if(active)setState({name:typeof j.user?.username==='string'?j.user.username:null,unknown:false});}catch{if(active)setState({name:null,unknown:true});}finally{pending=false;}}const focus=()=>void refresh(),pageshow=(e:PageTransitionEvent)=>{if(e.persisted)void refresh(true)};void refresh(true);window.addEventListener('focus',focus);window.addEventListener('pageshow',pageshow);return()=>{active=false;window.removeEventListener('focus',focus);window.removeEventListener('pageshow',pageshow)};},[]);
 const zh=locale==='zh',label=state.name?'✓ '+state.name:state.unknown?(zh?'账户':'Account'):(zh?'注册 / 登录':'Join / Sign in');
 return <a href="/auth/account" rel="nofollow" data-fleet-account className="fleet-account-link" title={label} aria-label={label}>{label}</a>;
}
