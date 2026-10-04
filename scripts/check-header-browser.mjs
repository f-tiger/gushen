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
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const width of [320,390,680,960,1280])for(const lang of ['en','zh']){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());if(u.origin!==origin)return route.abort();
   if(u.pathname==='/auth/status')return route.fulfill({contentType:'application/json',body:'{"ok":true,"user":null}'});
   if(!['GET','HEAD'].includes(route.request().method()))return route.abort();return route.continue();
  });
  await page.goto(origin+'/'+lang+'/');const header=page.locator('[data-fleet-header]'),home=header.locator('a[href="/'+lang+'/"]');await home.waitFor();
  assert.equal(await header.count(),1);const account=header.locator('[data-fleet-account]');await account.waitFor();
  await page.locator('.sidebar nav button').nth(1).click();assert.equal(await page.locator('.sidebar nav button').nth(1).getAttribute('aria-current'),'page');
  await page.evaluate(()=>window.__headerNoReload='kept');await home.click();
  assert.equal(await page.locator('.sidebar nav button').first().getAttribute('aria-current'),'page');assert.equal(await page.evaluate(()=>window.__headerNoReload),'kept');
  const hb=await header.boundingBox(),ab=await account.boundingBox();assert(ab.x>=0&&ab.x+ab.width<=width+1&&ab.y>=hb.y-1&&ab.y+ab.height<=hb.y+hb.height+1,JSON.stringify({lang,width,hb,ab}));
  assert.equal(await page.locator('html').getAttribute('lang'),lang==='en'?'en':'zh-CN');await context.close();
 }
 console.log('PASS header: EN/ZH, five viewports, visible home/account, controls inside header, return without workspace reload.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
