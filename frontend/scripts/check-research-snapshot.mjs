// Exercise the actual deployment snapshot, not the synthetic unit-test fixture.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const prices = JSON.parse(readFileSync(new URL('../public/data/prices.json', import.meta.url), 'utf8'));
const built = await build({
 entryPoints: [new URL('../src/engine/research.ts', import.meta.url).pathname],
 bundle: true, write: false, format: 'esm', platform: 'node',
 define: { 'import.meta.env.BASE_URL': '"/"' },
});
const { runResearch, DEFAULT_CONFIG, PRESETS } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
for (const preset of PRESETS) {
 for (const historyDays of [365, 1095]) {
  const result = runResearch(prices, { ...DEFAULT_CONFIG, name: preset.name, holdings: preset.holdings, historyDays });
  assert.equal(result.strategies.length, 3);
  for (const strategy of result.strategies) {
   const m = strategy.metrics;
   assert.equal(m.from, result.dates.from);
   assert.equal(m.to, result.dates.to);
   assert.equal(m.curve.length, result.dates.sessions + 1);
   assert.ok(m.curve.every(p => Number.isFinite(p.nav) && p.nav > 0 && Number.isFinite(p.drawdown)));
   assert.ok([m.cagr, m.total_return, m.annual_volatility, m.max_drawdown, m.total_cost].every(Number.isFinite));
   assert.ok(m.rebalances.every(r => r.signalAsOf < r.executionDate));
   assert.ok(Math.abs(Object.values(m.final_weights).reduce((a,b)=>a+b,0)-1)<1e-8);
  }
  console.log(`research snapshot OK: ${preset.name}, ${historyDays} days, ${result.dates.from}..${result.dates.to}`);
 }
}
