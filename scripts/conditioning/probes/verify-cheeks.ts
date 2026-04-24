import { loadConditioning } from './load-conditioning';

const facecapConditioning = loadConditioning();
const d = facecapConditioning;
const atlas01 = d.atlases.atlas01;
const atlas02 = d.atlases.atlas02;
const n = d.positionCount;
let cheekCount = 0, maxCheek = 0, overlap = 0;
const cheekDist: Record<string, number> = {};
for (let i = 0; i < n; i++) {
  const c = atlas01[i * 4];
  const l = atlas02[i * 4];
  if (c > 0) cheekCount++;
  if (c > maxCheek) maxCheek = c;
  if (c > 0.1 && l > 0.1) overlap++;
  const bucket = (Math.floor(c * 10) / 10).toFixed(1);
  cheekDist[bucket] = (cheekDist[bucket] || 0) + 1;
}
console.log(`Total verts: ${n}`);
console.log(`Verts with cheek>0: ${cheekCount} (was 802 before fix)`);
console.log(`Max cheek: ${maxCheek}`);
console.log(`Cheek>0.1 AND lips>0.1 overlap: ${overlap}`);
console.log('\nCheek distribution:');
for (const [k, v] of Object.entries(cheekDist).sort((a, b) => +a[0] - +b[0])) {
  console.log(`  ${k}: ${v}`);
}
