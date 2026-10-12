import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=fileURLToPath(new URL('../frontend/dist/',import.meta.url));
const {chromium}=createRequire((process.env.HEADER_BROWSER_MODULES||'/tmp/gushen-browser/node_modules')+'/package.json')('playwright');
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),base=path.resolve(root,'.'+pathname);
 const file=[base,path.join(base,'index.html')].find(p=>p.startsWith(root)&&fs.existsSync(p)&&fs.statSync(p).isFile());
 if(!file){res.writeHead(404);return res.end('Not found');}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.PILOT_CHROMIUM||undefined,args:['--no-sandbox']});
 for(const width of [320,390,680,960,1280])for(const lang of ['en','zh']){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());if(u.origin!==origin)return route.abort();
   if(u.pathname==='/auth/status')return route.fulfill({contentType:'application/json',body:'{"ok":true,"user":null}'});
   if(u.pathname==='/auth/account')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Local account fixture</title><p>No sign-in is performed.</p>'});
   if(!['GET','HEAD'].includes(route.request().method()))return route.abort();return route.continue();
  });
  await page.goto(origin+'/'+lang+'/?portfolio=local-only#private-draft');const header=page.locator('[data-fleet-header]'),home=header.locator('a[href="/'+lang+'/"]');await home.waitFor();
  assert.equal(await header.count(),1);const account=header.locator('[data-fleet-account]');await account.waitFor();
  const entry=new URL(await account.getAttribute('href'),origin);
  assert.equal(entry.pathname,'/auth/account');assert.equal(entry.searchParams.get('next'),'/'+lang+'/');assert.equal(entry.searchParams.get('lang'),lang);
  assert.deepEqual([...entry.searchParams.keys()].sort(),['lang','next']);assert(!entry.href.includes('portfolio'));assert(!entry.href.includes('private-draft'));
  assert.equal(await account.getAttribute('target'),'_blank');assert.match(await account.getAttribute('rel'),/noopener/);assert.match(await account.getAttribute('rel'),/noreferrer/);
  if(width===390){
   await page.evaluate(()=>{window.__unsavedResearch='local-only';const input=document.createElement('textarea');input.id='unsaved-fixture';input.value='unsaved research';document.body.append(input);});
   const before=page.url(),opened=context.waitForEvent('page');await account.click();const tab=await opened;await tab.waitForLoadState();
   assert.equal(tab.url(),entry.href);assert.equal(await tab.evaluate(()=>window.opener),null);assert.equal(page.url(),before);
   assert.equal(await page.locator('#unsaved-fixture').inputValue(),'unsaved research');assert.equal(await page.evaluate(()=>window.__unsavedResearch),'local-only');await tab.close();
  }
  await page.locator('.sidebar nav button').nth(1).click();assert.equal(await page.locator('.sidebar nav button').nth(1).getAttribute('aria-current'),'page');
  await page.evaluate(()=>window.__headerNoReload='kept');await home.click();
  assert.equal(await page.locator('.sidebar nav button').first().getAttribute('aria-current'),'page');assert.equal(await page.evaluate(()=>window.__headerNoReload),'kept');
  const hb=await header.boundingBox(),ab=await account.boundingBox();assert(ab.x>=0&&ab.x+ab.width<=width+1&&ab.y>=hb.y-1&&ab.y+ab.height<=hb.y+hb.height+1,JSON.stringify({lang,width,hb,ab}));
  assert.equal(await page.locator('html').getAttribute('lang'),lang==='en'?'en':'zh-CN');await context.close();
 }
 console.log('PASS header: EN/ZH, five viewports, public-path-only account context, isolated new tab preserves the current draft, controls inside header, return without workspace reload.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
