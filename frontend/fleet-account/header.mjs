import {escape,HOSTS} from './config.mjs';
export const HEADER_VERSION='fleet-header-20261004.1';
const names={en:'English',de:'Deutsch',fr:'Français',it:'Italiano',es:'Español',nl:'Nederlands',zh:'中文','en-AU':'English (Australia)'};
export const locale=lang=>lang==='en-AU'?lang:lang?.startsWith('zh')?'zh':(lang||'en').split('-')[0];
export const accountCopy={en:['Join / Sign in','Account','Signed in: ','Open account'],de:['Anmelden','Konto','Angemeldet: ','Konto öffnen'],fr:['Connexion','Compte','Connecté : ','Ouvrir le compte'],it:['Accedi','Account','Accesso: ','Apri account'],es:['Acceder','Cuenta','Sesión: ','Abrir cuenta'],nl:['Inloggen','Account','Ingelogd: ','Account openen'],zh:['注册 / 登录','账户','已登录：','打开账户']};
const words={en:['Language','Other versions of this page','No other language version is available for this page.','Browse other language content (not a translation of this page)'],de:['Sprache','Andere Versionen dieser Seite','Für diese Seite ist keine andere Sprachversion verfügbar.','Weitere Sprachinhalte (keine Übersetzung dieser Seite)'],fr:['Langue','Autres versions de cette page','Cette page n’a pas d’autre version linguistique.','Autres contenus linguistiques (pas une traduction de cette page)'],it:['Lingua','Altre versioni di questa pagina','Questa pagina non ha altre versioni linguistiche.','Altri contenuti linguistici (non una traduzione di questa pagina)'],es:['Idioma','Otras versiones de esta página','Esta página no tiene otra versión de idioma.','Otros contenidos por idioma (no una traducción de esta página)'],nl:['Taal','Andere versies van deze pagina','Deze pagina heeft geen andere taalversie.','Andere taalinhoud (geen vertaling van deze pagina)'],zh:['语言','本页的其他版本','本页暂无其他语言版本。','浏览其他语言内容（不是本页译文）']};
export function headerTargets(host){
 if(host==='agiscorecard.com')return ['#agi-nav .agi-header-inner'];
 if(host==='getecoback.com')return ['.eb-nav .eb-nav-in','body > nav.nav','body > nav:not(.eb-language-nav):not(.fleet-account-entry)'];
 if(host==='thedollscout.com')return ['.collect-header .header-inner','.site-header > .wrap'];
 if(host==='invest.agiscorecard.com')return ['.sunwatch-site-header .sunwatch-header-inner','body > nav[aria-label="披露监控"]','body > nav[aria-label="Research monitor"]'];
 return ['header.top > .wrap','header.site-header','body > header > .wrap','body > header','body > .wrap > header','body > .container > header'];
}
export function excludedPath(path){return /(?:^|\/)(?:auth|api|analytics-assets|\.well-known|embed|widgets|members|account)(?:\/|\.|$)/.test(path)||/\/discuss\/(?:account|moderate)/.test(path);}
export function safeLanguageURL(value,url){try{const u=new URL(value,url);if(u.origin!==url.origin||u.username||u.password||u.search||u.hash||excludedPath(u.pathname))return null;return u.pathname;}catch{return null;}}
function languages(meta,url){
 const l=locale(meta.lang),t=words[l]||words.en,pairs=new Map();
 for(const a of meta.alternates){const path=safeLanguageURL(a.href,url),lang=locale(a.lang);if(path&&names[lang]&&path!==url.pathname&&lang!==l)pairs.set(lang,path);}
 // AGI's existing header mapping also covers dynamic pages with verified pairs.
 for(const a of meta.languageLinks){const path=safeLanguageURL(a.href,url),lang=locale(a.lang);if(a.kind==='translation'&&path&&names[lang]&&lang!==l)pairs.set(lang,path);}
 const entries=meta.entries.filter(a=>!pairs.has(locale(a.lang))&&locale(a.lang)!==l&&safeLanguageURL(a.href,url));
 const links=(items,kind)=>items.map(([lang,path])=>`<a href="${escape(path)}" lang="${lang}" hreflang="${lang}" data-language-target="${kind}">${names[lang]}</a>`).join('');
 const paired=pairs.size?`<p>${t[1]}</p>${links([...pairs],'page')}`:`<p>${t[2]}</p>`;
 const extra=entries.length?`<p>${t[3]}</p>${links(entries.map(a=>[locale(a.lang),safeLanguageURL(a.href,url)]),'entry')}`:'';
 return `<details class="fleet-language"><summary aria-label="${t[0]} / Language">${names[l]||escape(meta.lang)} <span aria-hidden="true">⌄</span></summary><div class="fleet-language-panel">${paired}${extra}</div></details>`;
}
export function headerTools(meta,url){const copy=accountCopy[locale(meta.lang)]||accountCopy.en;return `<div class="fleet-header-tools">${meta.nativeLanguage?'':languages(meta,url)}<span class="fleet-account-entry"><a href="/auth/account" rel="nofollow">${copy[0]}</a></span></div>`;}
export const headerCSS=`
[data-fleet-header]{position:relative;min-width:0;height:auto!important;overflow:visible!important}
header[data-fleet-header],header:has([data-fleet-header]){height:auto!important;min-height:56px}
[data-fleet-header] .fleet-header-tools{position:relative;display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-inline-start:auto;flex:0 1 auto;min-width:0;font:14px/1.4 system-ui,sans-serif;color:inherit}
[data-fleet-header] .fleet-account-entry{display:flex;padding:0;margin:0;background:none;color:inherit;font:inherit;min-width:0}
[data-fleet-header] .fleet-account-entry a{display:block;max-width:180px;min-height:44px;box-sizing:border-box;padding:12px 10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:inherit!important;background:transparent;border:1px solid currentColor;border-radius:6px;font:inherit;text-decoration:none}
[data-fleet-header] .fleet-language{position:static;flex:none;margin:0;padding:0;border:0;background:none;color:inherit}
[data-fleet-header] .fleet-language>summary{display:flex;align-items:center;gap:6px;min-height:44px;box-sizing:border-box;padding:10px 8px;cursor:pointer;list-style:none;font:inherit;color:inherit;background:none;border:0}
[data-fleet-header] .fleet-language>summary::-webkit-details-marker{display:none}
[data-fleet-header] .fleet-language-panel{position:absolute;right:0;top:100%;z-index:1500;box-sizing:border-box;width:320px;max-width:calc(100vw - 32px);padding:16px;background:#fff;color:#172033;border:1px solid #ccd3dc;border-radius:8px;box-shadow:0 8px 24px #10284026;text-align:left;max-height:65vh;overflow:auto}
[data-fleet-header] .fleet-language-panel p{font:14px/1.5 system-ui,sans-serif;color:#344358;margin:4px 0 10px;white-space:normal}
[data-fleet-header] .fleet-language-panel a{display:inline-flex;align-items:center;min-height:44px;padding:7px 10px;margin:0 5px 6px 0;box-sizing:border-box;color:#174b75!important;background:#f3f7fa;border:1px solid #c8d4df;border-radius:5px;text-decoration:underline;font:14px/1.4 system-ui,sans-serif;white-space:normal}
[data-fleet-header] .fleet-header-tools a:focus-visible,[data-fleet-header] .fleet-language summary:focus-visible{outline:3px solid #6396d5;outline-offset:3px}
.fleet-site-header{display:flex;align-items:center;flex-wrap:wrap;gap:12px;padding:12px 20px;background:#fff;color:#172033;border-bottom:1px solid #d5dde5;font:15px/1.5 system-ui,sans-serif}
.fleet-site-header>a{font-weight:700;color:inherit}
.sunwatch-site-header{background:#122237;color:#fff;font:14px/1.5 system-ui,sans-serif;padding:0}
.sunwatch-header-inner{display:flex;align-items:center;flex-wrap:wrap;gap:12px 20px;max-width:1200px;margin:auto;padding:12px 16px}
.sunwatch-site-header a{color:#d6e8ff;text-decoration:none}.sunwatch-site-header .sunwatch-brand{font-size:20px;font-weight:750;color:#fff}.sunwatch-site-header nav{display:flex;flex-wrap:wrap;gap:16px}

.eb-nav [data-fleet-header]{color:#fff;flex-wrap:wrap}
.eb-nav [data-fleet-header] .fleet-header-tools{order:2}
header [data-fleet-header],header[data-fleet-header]{flex-wrap:wrap}
#agi-nav .agi-header-inner[data-fleet-header]{flex-wrap:wrap;gap:12px}
@media(max-width:850px){
 #agi-nav .agi-header-inner[data-fleet-header]{grid-template-columns:1fr auto auto;gap:0 8px}
 #agi-nav [data-fleet-header] .fleet-header-tools{grid-column:1/-1;grid-row:3;justify-content:flex-end;margin:0;padding:4px 0 8px}
 #agi-nav [data-fleet-header] .agi-primary-nav{min-width:0}
 [data-fleet-header] .fleet-account-entry a{max-width:160px}
}
@media(max-width:560px){
 [data-fleet-header] .fleet-header-tools{flex-basis:100%;margin:4px 0 0;justify-content:flex-end;gap:8px}

 [data-fleet-header] .fleet-account-entry a{max-width:150px}
}
@media(max-width:560px){
 #agi-nav .agi-header-inner[data-fleet-header]{grid-template-columns:minmax(0,1fr) auto auto auto;gap:0 6px}
 #agi-nav [data-fleet-header] .fleet-header-tools{grid-column:2;grid-row:1;padding:0;flex-basis:auto;margin:0}
 #agi-nav [data-fleet-header] .fleet-account-entry a{max-width:105px;padding:11px 7px;font-size:12px}
 #agi-nav [data-fleet-header] .agi-language{grid-column:3;grid-row:1}
 #agi-nav [data-fleet-header] .agi-menu{grid-column:4;grid-row:1}
 #agi-nav [data-fleet-header] .agi-menu>summary>span:last-child{display:none}
 #agi-nav [data-fleet-header] .agi-brand{font-size:14px;gap:5px;min-width:0;white-space:normal}
 .eb-nav .eb-nav-in[data-fleet-header]{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px}
 .eb-nav [data-fleet-header]>.eb-logo{grid-column:1;grid-row:1}
 .eb-nav [data-fleet-header]>.fleet-header-tools{grid-column:2;grid-row:1;margin:0;flex-basis:auto;gap:4px;font-size:12px}
 .eb-nav [data-fleet-header] .fleet-account-entry a{max-width:120px;padding:12px 8px}
 .eb-nav [data-fleet-header]>.eb-links{grid-column:1/-1;grid-row:2;min-width:0;padding-right:44px}
 .eb-nav [data-fleet-header]>#eb-se,.eb-nav [data-fleet-header]>.eb-search{grid-column:2;grid-row:2;justify-self:end;background:#0a4d7a;z-index:2}
}
@media print{.fleet-header-tools{display:none!important}}
`;
// Two HTMLRewriter passes use the same public HTML for every visitor. No session
// reads, guessed translation slugs or personal data enter the cached document.
export async function integrateHeader(request,res,script){
 const url=new URL(request.url),text=await res.text(),meta={lang:'en',alternates:[],languageLinks:[],entries:[],nativeLanguage:false,noindex:false};
 const targets=headerTargets(url.hostname),found=new Set();let scan=new HTMLRewriter();
 scan=scan.on('html',{element(e){meta.lang=e.getAttribute('lang')||'en';}}).on('meta[name="robots"]',{element(e){if(/noindex/i.test(e.getAttribute('content')||''))meta.noindex=true;}}).on('link[rel="alternate"][hreflang]',{element(e){meta.alternates.push({lang:e.getAttribute('hreflang'),href:e.getAttribute('href')});}});
 for(const target of targets)scan.on(target,{element(){found.add(target);}});
 scan.on('.agi-language,.language-nav,.bpj-languages',{element(){meta.nativeLanguage=true;}});
 scan.on('[data-language-target="entry"]',{element(e){meta.entries.push({lang:e.getAttribute('lang'),href:e.getAttribute('href')});}});
 await scan.transform(new Response(text)).text();
 const headers=new Headers(res.headers);headers.delete('Content-Length');headers.delete('ETag');
 if(meta.noindex)return new Response(text,{status:res.status,headers});
 const chosen=targets.find(t=>found.has(t)),tools=headerTools(meta,url);let inserted=false;
 let rewrite=new HTMLRewriter().on('head',{element(e){e.append('<link rel="stylesheet" href="/auth/fleet.css">'+script,{html:true});}}).on('.fleet-account-entry,.eb-language-nav',{element(e){e.remove();}});
 if(url.hostname==='goldrush.agiscorecard.com')rewrite.on('header span.logo',{element(e){e.tagName='a';e.setAttribute('href','/');}});
 if(url.hostname==='getecoback.com')rewrite.on('.language-switch,.winter-languages,.hero .lang-switch',{element(e){e.remove();}});
 if(url.hostname==='thedollscout.com'&&!meta.nativeLanguage)rewrite.on('.site-header .nav a[lang]',{element(e){e.remove();}});
 if(chosen)rewrite.on(chosen,{element(e){if(inserted)return;inserted=true;e.setAttribute('data-fleet-header',HEADER_VERSION);e.append(tools,{html:true});}});
 else rewrite.on('body',{element(e){e.prepend(`<header class="fleet-site-header" data-fleet-header="${HEADER_VERSION}"><a href="/">${escape(HOSTS.get(url.hostname))}</a>${tools}</header>`,{html:true});}});
 headers.set('X-Fleet-Header-Version',HEADER_VERSION);
 return rewrite.transform(new Response(text,{status:res.status,headers}));
}
