import { loadConditioning } from './load-conditioning';

const facecapConditioning = loadConditioning();
const a02 = facecapConditioning.atlases.atlas02;
const count = facecapConditioning.positionCount;

let lipVerts = 0, chinVerts = 0, overlap = 0;
const overlaps: string[] = [];
for (let i = 0; i < count; i++) {
  const o = i * 4;
  const lips = a02[o];
  const chin = a02[o + 1];
  if (lips > 0.1) lipVerts++;
  if (chin > 0.1) chinVerts++;
  if (lips > 0.1 && chin > 0.1) {
    overlap++;
    if (overlaps.length < 20) overlaps.push(`v${i} lips=${lips.toFixed(3)} chin=${chin.toFixed(3)}`);
  }
}
console.log('Lip verts (>0.1):', lipVerts);
console.log('Chin verts (>0.1):', chinVerts);
console.log('Overlap (both >0.1):', overlap);
overlaps.forEach(s => console.log('  ', s));

// Distribution
const buckets = [0,0,0,0,0,0,0,0,0,0];
for (let i = 0; i < count; i++) {
  const lips = a02[i * 4];
  const b = Math.min(Math.floor(lips * 10), 9);
  if (lips > 0) buckets[b]++;
}
console.log('Lip distribution [0-0.1, 0.1-0.2, ..., 0.9-1.0]:', buckets.join(', '));

// Show top 20 lip values with their position to understand spatial extent
const anchors = facecapConditioning.anchors;
const entries: { i: number; lips: number; chin: number; y: number }[] = [];
for (let i = 0; i < count; i++) {
  const lips = a02[i * 4];
  if (lips > 0.05) {
    entries.push({ i, lips, chin: a02[i * 4 + 1], y: 0 });
  }
}
entries.sort((a, b) => b.lips - a.lips);
console.log('\nTop 30 lip vertices:');
entries.slice(0, 30).forEach(e => console.log(`  v${e.i} lips=${e.lips.toFixed(3)} chin=${e.chin.toFixed(3)}`));

// Check: how many "lip" vertices have chin > 0?
const lipWithChin = entries.filter(e => e.chin > 0);
console.log(`\nOf ${entries.length} lip verts (>0.05): ${lipWithChin.length} also have chin > 0`);
