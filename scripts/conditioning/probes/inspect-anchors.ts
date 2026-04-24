/**
 * Quick diagnostic: print face-space anchor positions + current cheek ellipsoid parameters
 * to calibrate the fix.
 */
import { loadConditioning } from './load-conditioning';

const raw = loadConditioning();
const frame = raw.frame;
const anchors = raw.anchors;

function toPoint3(value: [number, number, number]) {
  return { x: value[0], y: value[1], z: value[2] };
}

console.log('=== Face-Space Anchors ===');
for (const [name, val] of Object.entries(anchors)) {
  const v = toPoint3(val as [number, number, number]);
  console.log(`  ${name}: x=${v.x.toFixed(4)}, y=${v.y.toFixed(4)}, z=${v.z.toFixed(4)}`);
}

// Reproduce the current cheekCenter calculation
const noseBase = toPoint3(anchors.noseBase);
const mouthCenter = toPoint3(anchors.mouthCenter);
const leftEye = toPoint3(anchors.leftEyeCenter);
const rightEye = toPoint3(anchors.rightEyeCenter);
const chin = toPoint3(anchors.chin);

const cheekCenterY_current = noseBase.y * 0.45 + mouthCenter.y * 0.55;
const cheekCenterZ_current = noseBase.z * 0.6 + mouthCenter.z * 0.4;

console.log('\n=== Current Cheek Ellipsoid ===');
console.log(`  cheekCenterY = ${cheekCenterY_current.toFixed(4)} (noseBase.y*0.45 + mouth.y*0.55)`);
console.log(`  cheekCenterZ = ${cheekCenterZ_current.toFixed(4)}`);
console.log(`  leftX center = ${(leftEye.x * 0.58).toFixed(4)} (leftEye.x*0.58)`);
console.log(`  rightX center = ${(rightEye.x * 0.58).toFixed(4)}`);
console.log(`  radii: x=0.24, y=0.26, z=0.3, blur=0.14`);

// Proposed fix: raise cheekCenterY to be between eyes and nose base
const cheekCenterY_fixed = noseBase.y * 0.7 + leftEye.y * 0.3;
const cheekCenterZ_fixed = noseBase.z * 0.55 + mouthCenter.z * 0.45;

console.log('\n=== Proposed Cheek Ellipsoid ===');
console.log(`  cheekCenterY = ${cheekCenterY_fixed.toFixed(4)} (noseBase.y*0.7 + leftEye.y*0.3)`);
console.log(`  cheekCenterZ = ${cheekCenterZ_fixed.toFixed(4)}`);
console.log(`  leftX center = ${(leftEye.x * 0.72).toFixed(4)} (leftEye.x*0.72)`);
console.log(`  rightX center = ${(rightEye.x * 0.72).toFixed(4)}`);
console.log(`  radii: x=0.20, y=0.20, z=0.26, blur=0.10`);

// Also print key Y positions for reference
console.log('\n=== Key Y Positions ===');
console.log(`  leftEye.y = ${leftEye.y.toFixed(4)}`);
console.log(`  noseBase.y = ${noseBase.y.toFixed(4)}`);
console.log(`  mouthCenter.y = ${mouthCenter.y.toFixed(4)}`);
console.log(`  chin.y = ${chin.y.toFixed(4)}`);
console.log(`  lipY = ${mouthCenter.y.toFixed(4)}`);
console.log(`  chinY = ${(chin.y * 0.74 + mouthCenter.y * 0.26).toFixed(4)}`);
