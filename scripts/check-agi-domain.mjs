import { readFileSync } from 'node:fs';
import { completedDateCutoff } from './completed-session.mjs';
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
  const bundle=src ? await read(src) : '';
  if(!['walk-forward-close-v2','gushen-research-workspace-v1','风险透视','研究日志'].every(marker=>bundle.includes(marker)))throw new Error('research workbench bundle missing');
  if(!html.includes('投资研究工作台'))throw new Error('workbench metadata missing');
  const data=JSON.parse(await read('/data/prices.json'));
  if(data.generated!==expected)throw new Error('price snapshot differs');
  const cutoff=completedDateCutoff(new Date(data.generated));
  if(data.asOf>cutoff || data.dates.some(d=>d>cutoff))throw new Error('unfinished daily price bar published');
  for(const path of ['/robots.txt','/sitemap.xml','/llms.txt'])if(!(await read(path)).includes(root))throw new Error(`${path}: AGI domain missing`);
  console.log('AGI workbench verified: HTTPS, canonical, research bundle, matching completed-session prices, robots, sitemap and llms.txt');
  process.exit(0);
 } catch(e) {failure=e;console.log(`AGI domain propagation pending (${attempt}/12): ${e.message}`);if(attempt<12)await new Promise(r=>setTimeout(r,15000));}
}
throw failure;
