import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureDomain, DOMAIN } from './attach-agi-domain.mjs';
function fixture({ records = [], domains = [], target = 'gushen-4g2.pages.dev' } = {}) {
  const writes = [];
  return { writes, api: async (path, options) => {
    if (options) { writes.push({ path, ...options }); return {}; }
    if (path.startsWith('/zones?')) return [{ id: 'zone', name: 'agiscorecard.com', account: { id: 'account' } }];
    if (path.includes('/dns_records')) return records;
    if (path.endsWith('/domains')) return domains;
    return { subdomain: target };
  } };
}
test('registers only the AGI domain and its exact Pages CNAME', async () => {
 const f=fixture();await ensureDomain(f.api);
 assert.deepEqual(f.writes.map(w=>w.body),[{name:DOMAIN},{type:'CNAME',name:DOMAIN,content:'gushen-4g2.pages.dev',proxied:true,ttl:1}]);
});
test('existing matching configuration requires no writes', async () => {
 const f=fixture({records:[{type:'CNAME',content:'gushen-4g2.pages.dev'}],domains:[{name:DOMAIN}]});await ensureDomain(f.api);assert.equal(f.writes.length,0);
});
test('conflicting DNS is rejected before any remote mutation', async () => {
 const f=fixture({records:[{type:'A',content:'192.0.2.1'}]});await assert.rejects(ensureDomain(f.api),/Conflicting DNS/);assert.equal(f.writes.length,0);
});
test('a different Pages project origin is rejected before any remote mutation', async () => {
 const f=fixture({target:'other.pages.dev'});await assert.rejects(ensureDomain(f.api),/does not match/);assert.equal(f.writes.length,0);
});
