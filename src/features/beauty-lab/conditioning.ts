import * as THREE from 'three';
import { deinterleaveGeometry } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {
  ConditioningDetailTextures,
  ConditioningMeshRoles,
  ConditioningTexturePack,
  ExpressionControlValues,
  FacecapConditioningData,
} from './types';

function decodeBase64Bytes(base64: string) {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  const nodeBuffer = (globalThis as { Buffer?: { from(value: string, encoding: string): Uint8Array } }).Buffer;
  if (!nodeBuffer) {
    throw new Error('No base64 decoder available for conditioning textures');
  }

  return Uint8Array.from(nodeBuffer.from(base64, 'base64'));
}

function createConditioningTexture(base64: string, size: number) {
  const data = decodeBase64Bytes(base64);
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

export function createConditioningTexturePack(detailTextures?: ConditioningDetailTextures | null): ConditioningTexturePack {
  if (!detailTextures) return null;

  return {
    baseMap: createConditioningTexture(detailTextures.baseMap, detailTextures.size),
    dermalMap: createConditioningTexture(detailTextures.dermalMap, detailTextures.size),
    microMap: createConditioningTexture(detailTextures.microMap, detailTextures.size),
  };
}

export function resolveConditioningMeshRoles(conditioningData: FacecapConditioningData): ConditioningMeshRoles {
  return conditioningData.meshRoles ?? {
    headSkin: [conditioningData.headMeshName],
    eyes: [],
    teeth: [],
    mouthInterior: [],
    lashesOrBrows: [],
  };
}

function clampUnit(value: number) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

const MORPH_TARGETS = [
  'browInnerUp', 'browOuterUp_L', 'browOuterUp_R', 'browDown_L', 'browDown_R',
  'eyeSquint_L', 'eyeSquint_R', 'eyeBlink_L', 'eyeBlink_R',
  'cheekSquint_L', 'cheekSquint_R',
  'mouthSmile_L', 'mouthSmile_R', 'mouthDimple_L', 'mouthDimple_R', 'mouthStretch_L', 'mouthStretch_R',
  'noseSneer_L', 'noseSneer_R',
  'mouthPress_L', 'mouthPress_R', 'mouthClose', 'mouthRollUpper', 'mouthRollLower', 'mouthShrugUpper', 'mouthShrugLower',
] as const;

export function applyExpressionMorphsToMesh(mesh: THREE.Mesh, expression: ExpressionControlValues) {
  const influences = mesh.morphTargetInfluences;
  const dictionary = mesh.morphTargetDictionary;
  if (!influences || !dictionary) return;

  const next = new Map<string, number>();
  const add = (name: string, value: number) => {
    next.set(name, clampUnit((next.get(name) ?? 0) + value));
  };

  add('browInnerUp', expression.browRaise * 0.92);
  add('browOuterUp_L', expression.browRaise * 0.72);
  add('browOuterUp_R', expression.browRaise * 0.72);

  add('browDown_L', expression.browCompress * 0.88);
  add('browDown_R', expression.browCompress * 0.88);

  add('eyeSquint_L', expression.squint * 0.82);
  add('eyeSquint_R', expression.squint * 0.82);
  add('eyeBlink_L', expression.squint * 0.18);
  add('eyeBlink_R', expression.squint * 0.18);
  add('cheekSquint_L', expression.squint * 0.34);
  add('cheekSquint_R', expression.squint * 0.34);

  add('mouthSmile_L', expression.smile * 0.94);
  add('mouthSmile_R', expression.smile * 0.94);
  add('mouthDimple_L', expression.smile * 0.44);
  add('mouthDimple_R', expression.smile * 0.44);
  add('mouthStretch_L', expression.smile * 0.22);
  add('mouthStretch_R', expression.smile * 0.22);
  add('cheekSquint_L', expression.smile * 0.18);
  add('cheekSquint_R', expression.smile * 0.18);

  add('noseSneer_L', expression.noseSneer * 0.94);
  add('noseSneer_R', expression.noseSneer * 0.94);

  add('mouthPress_L', expression.mouthCompress * 0.9);
  add('mouthPress_R', expression.mouthCompress * 0.9);
  add('mouthClose', expression.mouthCompress * 0.34);
  add('mouthRollUpper', expression.mouthCompress * 0.28);
  add('mouthRollLower', expression.mouthCompress * 0.28);
  add('mouthShrugUpper', expression.mouthCompress * 0.14);
  add('mouthShrugLower', expression.mouthCompress * 0.1);

  for (const morphName of MORPH_TARGETS) {
    const index = dictionary[morphName];
    if (index === undefined) continue;
    influences[index] = next.get(morphName) ?? 0;
  }
}

function toFloat32Attribute(attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
  const itemSize = attr.itemSize;
  const values = new Float32Array(attr.count * itemSize);
  for (let i = 0; i < attr.count; i += 1) {
    const offset = i * itemSize;
    values[offset] = attr.getX(i);
    if (itemSize > 1) values[offset + 1] = attr.getY(i);
    if (itemSize > 2) values[offset + 2] = attr.getZ(i);
    if (itemSize > 3) values[offset + 3] = attr.getW(i);
  }
  return new THREE.BufferAttribute(values, itemSize, false);
}

function expandGeometryAttributesToFloat32(geometry: THREE.BufferGeometry) {
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    geometry.setAttribute(name, toFloat32Attribute(attribute));
  }
  for (const [key, attrs] of Object.entries(geometry.morphAttributes)) {
    geometry.morphAttributes[key] = attrs.map((attribute) => toFloat32Attribute(attribute));
  }
}

function makePositionKey(x: number, y: number, z: number, tolerance: number) {
  const scale = 1 / tolerance;
  return `${Math.round(x * scale)},${Math.round(y * scale)},${Math.round(z * scale)}`;
}

function smoothNormalsAcrossSeams(geometry: THREE.BufferGeometry, tolerance = 1e-4) {
  geometry.computeVertexNormals();
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  if (!position || !normal) return;
  const accumulators = new Map<string, { normal: THREE.Vector3; count: number }>();
  const average = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    const key = makePositionKey(position.getX(i), position.getY(i), position.getZ(i), tolerance);
    const bucket = accumulators.get(key) ?? { normal: new THREE.Vector3(), count: 0 };
    bucket.normal.x += normal.getX(i);
    bucket.normal.y += normal.getY(i);
    bucket.normal.z += normal.getZ(i);
    bucket.count += 1;
    accumulators.set(key, bucket);
  }
  for (let i = 0; i < position.count; i += 1) {
    const key = makePositionKey(position.getX(i), position.getY(i), position.getZ(i), tolerance);
    const bucket = accumulators.get(key);
    if (!bucket) continue;
    average.copy(bucket.normal).multiplyScalar(1 / Math.max(bucket.count, 1)).normalize();
    normal.setXYZ(i, average.x, average.y, average.z);
  }
  normal.needsUpdate = true;
}

export function isConditionedHeadMesh(mesh: THREE.Mesh, meshRoles: ConditioningMeshRoles) {
  return meshRoles.headSkin.includes(mesh.name);
}

export function isConditioningExcludedMesh(mesh: THREE.Mesh, meshRoles: ConditioningMeshRoles) {
  return [
    ...meshRoles.eyes,
    ...meshRoles.teeth,
    ...meshRoles.mouthInterior,
    ...meshRoles.lashesOrBrows,
  ].includes(mesh.name);
}

function hasBakedConditioning(geometry: THREE.BufferGeometry, mesh: THREE.Mesh, conditioningData: FacecapConditioningData, meshRoles: ConditioningMeshRoles) {
  const position = geometry.getAttribute('position');
  return !!position && isConditionedHeadMesh(mesh, meshRoles) && position.count === conditioningData.positionCount;
}

function applyAllConditioningAttributes(geometry: THREE.BufferGeometry, conditioningData: FacecapConditioningData) {
  const atlases = conditioningData.atlases;
  geometry.setAttribute('conditionAtlas01', new THREE.BufferAttribute(Float32Array.from(atlases.atlas01), 4, false));
  geometry.setAttribute('conditionAtlas02', new THREE.BufferAttribute(Float32Array.from(atlases.atlas02), 4, false));
  geometry.setAttribute('conditionAtlas03', new THREE.BufferAttribute(Float32Array.from(atlases.atlas03), 4, false));
  geometry.setAttribute('conditionAtlas04', new THREE.BufferAttribute(Float32Array.from(atlases.atlas04), 4, false));
  geometry.setAttribute('conditionAtlas05', new THREE.BufferAttribute(Float32Array.from(atlases.atlas05), 4, false));
  geometry.setAttribute('conditionAtlas06', new THREE.BufferAttribute(Float32Array.from(atlases.atlas06), 4, false));
}

export function createStabilizedSkinGeometry(
  mesh: THREE.Mesh,
  conditioningData: FacecapConditioningData,
  meshRoles: ConditioningMeshRoles,
) {
  const staticGeometry = mesh.geometry.clone();
  const baked = hasBakedConditioning(staticGeometry, mesh, conditioningData, meshRoles);
  staticGeometry.deleteAttribute('tangent');
  deinterleaveGeometry(staticGeometry);
  expandGeometryAttributesToFloat32(staticGeometry);
  smoothNormalsAcrossSeams(staticGeometry, 1e-4);
  if (baked) {
    applyAllConditioningAttributes(staticGeometry, conditioningData);
  }
  staticGeometry.normalizeNormals();
  staticGeometry.computeBoundingBox();
  staticGeometry.computeBoundingSphere();
  return staticGeometry;
}
