import { loadConditioning } from './load-conditioning';

const fc = loadConditioning();
const a01 = fc.atlases.atlas01;
const count = fc.positionCount;

const entries: {i:number, cheeks:number}[] = [];
for (let i = 0; i < count; i++) {
  const o = i * 4;
  entries.push({i, cheeks: a01[o]});
}
entries.sort((a,b) => b.cheeks - a.cheeks);
console.log('Top 30 cheek vertices:');
entries.slice(0, 30).forEach(e => console.log(`  v${e.i} cheek=${e.cheeks.toFixed(4)}`));

// Distribution
const buckets = [0,0,0,0,0,0,0,0,0,0];
let totalCheek = 0;
for (const e of entries) {
  if (e.cheeks > 0) {
    totalCheek++;
    buckets[Math.min(Math.floor(e.cheeks * 10), 9)]++;
  }
}
console.log('\nCheek verts with weight > 0:', totalCheek, 'of', count);
console.log('Distribution [0.0-0.1, 0.1-0.2, ..., 0.9-1.0]:', buckets.join(', '));

// Cross-check: overlap between cheeks and lips, chin
const a02 = fc.atlases.atlas02;
console.log('\nHigh-cheek verts that also have lip/chin weight:');
for (const e of entries.slice(0, 50)) {
  const o = e.i * 4;
  const lips = a02[o];
  const chin = a02[o+1];
  if (lips > 0.05 || chin > 0.05) {
    console.log(`  v${e.i} cheek=${e.cheeks.toFixed(3)} lips=${lips.toFixed(3)} chin=${chin.toFixed(3)}`);
  }
}
