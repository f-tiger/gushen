import { pathToFileURL } from 'node:url';
export const DOMAIN = 'gushen.agiscorecard.com';
const TARGET = 'gushen-4g2.pages.dev';
// Restrict changes to this product's domain. Never replace existing unrelated DNS.
export async function ensureDomain(api) {
  const zones = (await api('/zones?name=agiscorecard.com')).filter(z => z.name === 'agiscorecard.com');
  if (zones.length !== 1 || !zones[0].account?.id) throw new Error('Expected one accessible agiscorecard.com zone with an account');
  const zone = zones[0], base = `/accounts/${zone.account.id}/pages/projects/gushen`;
  const project = await api(base);
  if (project.subdomain !== TARGET) throw new Error('Pages project does not match the existing Gushen origin');
  const dnsPath = `/zones/${zone.id}/dns_records`;
  const records = await api(`${dnsPath}?name=${DOMAIN}`);
  if (records.some(r => r.type !== 'CNAME' || r.content.replace(/\.$/, '') !== TARGET)) throw new Error('Conflicting DNS exists; refusing to overwrite it');
  const domains = await api(`${base}/domains`);
  if (!domains.some(d => d.name === DOMAIN)) await api(`${base}/domains`, { method: 'POST', body: { name: DOMAIN } });
  if (!records.length) await api(dnsPath, { method: 'POST', body: { type: 'CNAME', name: DOMAIN, content: TARGET, proxied: true, ttl: 1 } });
  return { domain: DOMAIN, origin: TARGET };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is required');
  const api = async (path, { method = 'GET', body } = {}) => {
    const response = await fetch('https://api.cloudflare.com/client/v4' + path, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000),
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(`Cloudflare ${method} failed: HTTP ${response.status}; codes ${(data.errors || []).map(e => e.code).join(',')}`);
    return data.result;
  };
  console.log(await ensureDomain(api));
}
