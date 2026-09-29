import { readFileSync } from 'node:fs';
const root = 'https://gushen.agiscorecard.com';
const expected = JSON.parse(readFileSync('frontend/public/data/prices.json', 'utf8')).generated;
async function read(path) {
 const r=await fetch(root+path,{signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw new Error(`${path}: HTTP ${r.status}`);
 return r.text();
}
let failure;
for(let attempt=1;attempt<=12;attempt++) {
 try {
  const html=await read('/');
  if(!html.includes(`rel="canonical" href="${root}/"`))throw new Error('new canonical not live');
  const src=html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
  if(!src || !(await read(src)).includes('walk-forward-close-v2'))throw new Error('application bundle missing');
  if(JSON.parse(await read('/data/prices.json')).generated!==expected)throw new Error('price snapshot differs');
  for(const path of ['/robots.txt','/sitemap.xml','/llms.txt'])if(!(await read(path)).includes(root))throw new Error(`${path}: AGI domain missing`);
  console.log('AGI subsite verified: HTTPS, canonical, app, matching prices, robots, sitemap and llms.txt');
  process.exit(0);
 } catch(e) {failure=e;console.log(`AGI domain propagation pending (${attempt}/12): ${e.message}`);if(attempt<12)await new Promise(r=>setTimeout(r,15000));}
}
throw failure;
