import * as THREE from 'three';
import type {
  ProceduralExpressionName,
  ProceduralExpressionValues,
  ProceduralHeadIdentity,
  ProceduralHeadQuality,
} from './types';
import { PROCEDURAL_EXPRESSION_NAMES, PROCEDURAL_QUALITY_CONFIG } from './types';
import { clamp, gaussian2D, lerp, smoothstep } from './random';

export type ProceduralHeadAnchors = {
  leftEye: THREE.Vector3;
  rightEye: THREE.Vector3;
  mouth: THREE.Vector3;
  noseTip: THREE.Vector3;
  chin: THREE.Vector3;
};

export type ProceduralHeadGeometryBundle = {
  geometry: THREE.BufferGeometry;
  anchors: ProceduralHeadAnchors;
  basePositions: Float32Array;
  expressionDeltas: Record<ProceduralExpressionName, Float32Array>;
};

type VertexMeta = {
  theta: number;
  yNorm: number;
};

function sideMask(x: number, side: 'L' | 'R') {
  return side === 'L' ? smoothstep(0.04, -0.32, x) : smoothstep(-0.04, 0.32, x);
}

function frontMask(theta: number) {
  return smoothstep(0.05, 0.86, Math.cos(theta));
}

function createHeadPoint(theta: number, yNorm: number, identity: ProceduralHeadIdentity) {
  const faceWidth = lerp(0.82, 1.12, identity.faceWidth);
  const skullHeight = lerp(0.92, 1.18, identity.skullHeight);
  const jawWidth = lerp(0.55, 1.0, identity.jawWidth);
  const cheekbone = lerp(0.88, 1.2, identity.cheekbone);
  const browRidge = lerp(0.02, 0.09, identity.browRidge);
  const noseProjection = lerp(0.08, 0.26, identity.noseProjection);
  const noseWidth = lerp(0.7, 1.25, identity.noseWidth);

  const verticalRadius = Math.sqrt(Math.max(0.018, 1 - Math.pow(yNorm * 0.92, 2)));
  const jawT = smoothstep(-0.38, -0.92, yNorm);
  const crownT = smoothstep(0.38, 0.94, yNorm);
  const templeT = smoothstep(0.05, 0.42, yNorm) * (1 - crownT * 0.35);
  const cheekT = gaussian2D(0, yNorm, 0, -0.08, 1, 0.24);

  let width = lerp(0.26, 0.74, verticalRadius) * faceWidth;
  width *= lerp(1, jawWidth, jawT);
  width *= lerp(1, 0.78, crownT);
  width *= lerp(1, cheekbone, cheekT * 0.38);
  width *= lerp(1, 0.88, templeT * 0.22);

  let depth = lerp(0.28, 0.58, verticalRadius) * lerp(0.92, 1.08, identity.faceWidth);
  depth *= lerp(1, 0.72, jawT * 0.45);
  depth *= lerp(1, 1.12, crownT * 0.25);

  let y = yNorm * 1.08 * skullHeight;
  let x = Math.sin(theta) * width;
  let z = Math.cos(theta) * depth;

  const front = frontMask(theta);
  const centerFront = Math.exp(-Math.pow(theta / 0.42, 2));
  const noseBridge = centerFront * gaussian2D(0, yNorm, 0, 0.18, 1, 0.32);
  const noseTip = centerFront * gaussian2D(0, yNorm, 0, -0.02, 1, 0.16);
  const nostril = centerFront * gaussian2D(0, yNorm, 0, -0.16, 1, 0.08);
  const mouthInset = centerFront * gaussian2D(0, yNorm, 0, -0.43, 1, 0.12);
  const chin = centerFront * gaussian2D(0, yNorm, 0, -0.72, 1, 0.18);
  const brow = front * gaussian2D(0, yNorm, 0, 0.33, 1, 0.08);

  z += noseBridge * noseProjection * 0.48;
  z += noseTip * noseProjection;
  z += nostril * noseProjection * 0.28;
  z -= mouthInset * lerp(0.025, 0.07, identity.lipFullness);
  z += chin * 0.05;
  z += brow * browRidge;

  const eyeX = lerp(0.22, 0.34, identity.eyeSpacing);
  const eyeY = 0.23;
  const eyeWidth = lerp(0.12, 0.18, identity.eyeScale);
  const leftSocket = gaussian2D(x, yNorm, -eyeX, eyeY, eyeWidth, 0.12) * front;
  const rightSocket = gaussian2D(x, yNorm, eyeX, eyeY, eyeWidth, 0.12) * front;
  const socket = leftSocket + rightSocket;
  z -= socket * lerp(0.07, 0.15, identity.browRidge);
  y += socket * -0.018;

  const noseNarrow = centerFront * gaussian2D(0, yNorm, 0, 0, 1, 0.28);
  x *= 1 - noseNarrow * lerp(0.08, 0.24, noseWidth);

  return new THREE.Vector3(x, y, z);
}

function createExpressionDelta(name: ProceduralExpressionName, point: THREE.Vector3, meta: VertexMeta) {
  const delta = new THREE.Vector3();
  const front = frontMask(meta.theta);
  const mouthCore = gaussian2D(point.x, meta.yNorm, 0, -0.43, 0.38, 0.17) * front;
  const lowerFace = smoothstep(-0.2, -0.86, meta.yNorm) * front;
  const browCore = gaussian2D(point.x, meta.yNorm, 0, 0.34, 0.55, 0.11) * front;
  const cheekL = gaussian2D(point.x, meta.yNorm, -0.28, -0.12, 0.22, 0.18) * front;
  const cheekR = gaussian2D(point.x, meta.yNorm, 0.28, -0.12, 0.22, 0.18) * front;
  const eyeL = gaussian2D(point.x, meta.yNorm, -0.28, 0.23, 0.18, 0.12) * front;
  const eyeR = gaussian2D(point.x, meta.yNorm, 0.28, 0.23, 0.18, 0.12) * front;
  const noseL = gaussian2D(point.x, meta.yNorm, -0.11, -0.04, 0.12, 0.2) * front;
  const noseR = gaussian2D(point.x, meta.yNorm, 0.11, -0.04, 0.12, 0.2) * front;
  const lipBand = gaussian2D(point.x, meta.yNorm, 0, -0.42, 0.34, 0.07) * front;
  const sideL = sideMask(point.x, 'L');
  const sideR = sideMask(point.x, 'R');

  switch (name) {
    case 'browInnerUp':
      delta.y += browCore * 0.065 * (1 - Math.min(Math.abs(point.x) / 0.35, 1) * 0.35);
      delta.z += browCore * 0.015;
      break;
    case 'browOuterUp_L':
      delta.y += browCore * sideL * 0.055;
      delta.z += browCore * sideL * 0.01;
      break;
    case 'browOuterUp_R':
      delta.y += browCore * sideR * 0.055;
      delta.z += browCore * sideR * 0.01;
      break;
    case 'eyeBlink_L':
      delta.y -= eyeL * 0.032;
      delta.z -= eyeL * 0.018;
      break;
    case 'eyeBlink_R':
      delta.y -= eyeR * 0.032;
      delta.z -= eyeR * 0.018;
      break;
    case 'eyeSquint_L':
      delta.y -= eyeL * 0.016;
      delta.z += eyeL * 0.01;
      break;
    case 'eyeSquint_R':
      delta.y -= eyeR * 0.016;
      delta.z += eyeR * 0.01;
      break;
    case 'cheekSquint_L':
      delta.y += cheekL * 0.055;
      delta.z += cheekL * 0.035;
      break;
    case 'cheekSquint_R':
      delta.y += cheekR * 0.055;
      delta.z += cheekR * 0.035;
      break;
    case 'jawOpen':
      delta.y -= lowerFace * 0.13;
      delta.z -= lowerFace * 0.045;
      break;
    case 'mouthSmile_L':
      delta.x -= mouthCore * sideL * 0.075;
      delta.y += mouthCore * sideL * 0.08;
      delta.z += mouthCore * sideL * 0.018;
      break;
    case 'mouthSmile_R':
      delta.x += mouthCore * sideR * 0.075;
      delta.y += mouthCore * sideR * 0.08;
      delta.z += mouthCore * sideR * 0.018;
      break;
    case 'mouthFunnel':
      delta.z += lipBand * 0.06;
      delta.x *= 0.5;
      break;
    case 'mouthPucker':
      delta.z += lipBand * 0.09;
      delta.x -= point.x * lipBand * 0.16;
      break;
    case 'mouthPress_L':
      delta.y -= lipBand * sideL * 0.02;
      delta.z -= lipBand * sideL * 0.025;
      break;
    case 'mouthPress_R':
      delta.y -= lipBand * sideR * 0.02;
      delta.z -= lipBand * sideR * 0.025;
      break;
    case 'noseSneer_L':
      delta.y += noseL * 0.045;
      delta.z += noseL * 0.022;
      break;
    case 'noseSneer_R':
      delta.y += noseR * 0.045;
      delta.z += noseR * 0.022;
      break;
    default:
      break;
  }

  return delta;
}

export function applyProceduralHeadExpressions(
  geometry: THREE.BufferGeometry,
  basePositions: Float32Array,
  expressionDeltas: Record<ProceduralExpressionName, Float32Array>,
  expressions: ProceduralExpressionValues,
  strength: number,
) {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const target = position.array as Float32Array;
  target.set(basePositions);

  for (const name of PROCEDURAL_EXPRESSION_NAMES) {
    const influence = clamp((expressions[name] ?? 0) * strength);
    if (influence <= 0) continue;

    const delta = expressionDeltas[name];
    for (let i = 0; i < target.length; i += 1) {
      target[i] += delta[i] * influence;
    }
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (normal) normal.needsUpdate = true;
  geometry.computeBoundingSphere();
}

export function createProceduralHeadGeometry(
  identity: ProceduralHeadIdentity,
  quality: ProceduralHeadQuality,
): ProceduralHeadGeometryBundle {
  const config = PROCEDURAL_QUALITY_CONFIG[quality];
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const meta: VertexMeta[] = [];
  const radialSegments = config.radialSegments;
  const verticalSegments = config.verticalSegments;

  for (let iy = 0; iy <= verticalSegments; iy += 1) {
    const v = iy / verticalSegments;
    const yNorm = 1 - v * 2;
    for (let ix = 0; ix <= radialSegments; ix += 1) {
      const u = ix / radialSegments;
      const theta = u * Math.PI * 2;
      const point = createHeadPoint(theta, yNorm, identity);
      positions.push(point.x, point.y, point.z);
      normals.push(0, 0, 1);
      uvs.push(u, v);
      meta.push({ theta, yNorm });
    }
  }

  const stride = radialSegments + 1;
  for (let iy = 0; iy < verticalSegments; iy += 1) {
    for (let ix = 0; ix < radialSegments; ix += 1) {
      const a = iy * stride + ix;
      const b = a + stride;
      const c = b + 1;
      const d = a + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const basePositions = Float32Array.from(positions);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(basePositions.slice(), 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const base = geometry.getAttribute('position') as THREE.BufferAttribute;
  const expressionDeltas = {} as Record<ProceduralExpressionName, Float32Array>;
  for (const name of PROCEDURAL_EXPRESSION_NAMES) {
    const deltas = new Float32Array(base.count * 3);
    const point = new THREE.Vector3();
    for (let i = 0; i < base.count; i += 1) {
      point.fromBufferAttribute(base, i);
      const delta = createExpressionDelta(name, point, meta[i]);
      deltas[i * 3] = delta.x;
      deltas[i * 3 + 1] = delta.y;
      deltas[i * 3 + 2] = delta.z;
    }
    expressionDeltas[name] = deltas;
  }

  const eyeSpacing = lerp(0.22, 0.34, identity.eyeSpacing);
  const anchors = {
    leftEye: new THREE.Vector3(-eyeSpacing, 0.25, 0.54),
    rightEye: new THREE.Vector3(eyeSpacing, 0.25, 0.54),
    mouth: new THREE.Vector3(0, -0.46, 0.6),
    noseTip: new THREE.Vector3(0, -0.02, 0.72 + clamp(identity.noseProjection) * 0.08),
    chin: new THREE.Vector3(0, -0.84, 0.42),
  };

  return { geometry, anchors, basePositions, expressionDeltas };
}
