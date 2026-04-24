import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Matrix4, Texture, Vector3 } from 'three';
import type { Mesh, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const FACECAP_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/facecap.glb';
const OUTPUT_DIR = path.resolve(process.cwd(), 'data/conditioning');
const MANIFEST_FILE = path.join(OUTPUT_DIR, 'facecap.conditioning.json');
const PAYLOAD_FILE = path.join(OUTPUT_DIR, 'facecapConditioning.json');
const DETAIL_TEXTURE_SIZE = 256;

type FacePoint = { x: number; y: number; z: number };

type CanonicalFrame = {
  origin: Vector3;
  right: Vector3;
  up: Vector3;
  forward: Vector3;
  scaleX: number;
  scaleYTop: number;
  scaleYBottom: number;
  scaleZFront: number;
  scaleZBack: number;
};

type CanonicalAnchors = {
  leftEyeCenter: Vector3;
  rightEyeCenter: Vector3;
  eyeMidpoint: Vector3;
  noseTip: Vector3;
  noseBase: Vector3;
  mouthCenter: Vector3;
  chin: Vector3;
  foreheadCenter: Vector3;
  faceOrigin: Vector3;
};

type RegionBake = {
  atlas01: number[];
  atlas02: number[];
  atlas03: number[];
  atlas04: number[];
  atlas05: number[];
  atlas06: number[];
};

type ConditioningDetailTextures = {
  size: number;
  baseMap: string;
  dermalMap: string;
  microMap: string;
};

type MeshRoles = {
  headSkin: string[];
  eyes: string[];
  teeth: string[];
  mouthInterior: string[];
  lashesOrBrows: string[];
};

const textureStubLoader = {
  load(_url: string, onLoad: (texture: Texture) => void) {
    onLoad(new Texture());
  },
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  if (edge0 === edge1) {
    return value < edge0 ? 0 : 1;
  }

  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function band(value: number, center: number, radius: number, blur: number) {
  return 1 - smoothstep(radius, radius + blur, Math.abs(value - center));
}

function ellipsoidMask(point: FacePoint, center: FacePoint, radius: FacePoint, blur: number) {
  return band(point.x, center.x, radius.x, blur) * band(point.y, center.y, radius.y, blur) * band(point.z, center.z, radius.z, blur);
}

function roundNumber(value: number) {
  return Number(value.toFixed(6));
}

function serializeVector(vector: Vector3) {
  return [roundNumber(vector.x), roundNumber(vector.y), roundNumber(vector.z)] as const;
}

function encodeTexture(data: Uint8Array) {
  return Buffer.from(data).toString('base64');
}

function readAtlasValue(atlas: number[], vertexIndex: number, channel: number) {
  return atlas[vertexIndex * 4 + channel] ?? 0;
}

function barycentricWeights(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
) {
  const denom = ((by - cy) * (ax - cx)) + ((cx - bx) * (ay - cy));
  if (Math.abs(denom) < 1e-8) return null;

  const w0 = (((by - cy) * (px - cx)) + ((cx - bx) * (py - cy))) / denom;
  const w1 = (((cy - ay) * (px - cx)) + ((ax - cx) * (py - cy))) / denom;
  const w2 = 1 - w0 - w1;
  if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) return null;

  return [w0, w1, w2] as const;
}

function dilateTexture(texture: Uint8Array, filled: Uint8Array, size: number, passes = 8) {
  let current = texture;
  let currentFilled = filled;

  for (let pass = 0; pass < passes; pass += 1) {
    const next = current.slice();
    const nextFilled = currentFilled.slice();
    let changed = false;

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const pixelIndex = y * size + x;
        if (currentFilled[pixelIndex]) continue;

        const accum = [0, 0, 0, 0];
        let weight = 0;

        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            if (ox === 0 && oy === 0) continue;
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
            const neighborIndex = ny * size + nx;
            if (!currentFilled[neighborIndex]) continue;
            const base = neighborIndex * 4;
            accum[0] += current[base + 0];
            accum[1] += current[base + 1];
            accum[2] += current[base + 2];
            accum[3] += current[base + 3];
            weight += 1;
          }
        }

        if (weight === 0) continue;

        const base = pixelIndex * 4;
        next[base + 0] = Math.round(accum[0] / weight);
        next[base + 1] = Math.round(accum[1] / weight);
        next[base + 2] = Math.round(accum[2] / weight);
        next[base + 3] = Math.round(accum[3] / weight);
        nextFilled[pixelIndex] = 1;
        changed = true;
      }
    }

    current = next;
    currentFilled = nextFilled;
    if (!changed) break;
  }

  return current;
}

function rasterizeTexture(geometry: Mesh['geometry'], vertexData: Float32Array, size: number) {
  const uvAttr = geometry.getAttribute('uv');
  if (!uvAttr) {
    throw new Error('Head geometry is missing UVs; cannot bake detail textures');
  }

  const index = geometry.getIndex();
  const sums = new Float32Array(size * size * 4);
  const weights = new Float32Array(size * size);
  const triangleCount = index ? index.count / 3 : uvAttr.count / 3;

  for (let tri = 0; tri < triangleCount; tri += 1) {
    const ia = index ? index.getX(tri * 3 + 0) : tri * 3 + 0;
    const ib = index ? index.getX(tri * 3 + 1) : tri * 3 + 1;
    const ic = index ? index.getX(tri * 3 + 2) : tri * 3 + 2;

    const ax = uvAttr.getX(ia);
    const ay = 1 - uvAttr.getY(ia);
    const bx = uvAttr.getX(ib);
    const by = 1 - uvAttr.getY(ib);
    const cx = uvAttr.getX(ic);
    const cy = 1 - uvAttr.getY(ic);

    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx) * (size - 1)) - 1);
    const maxX = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx) * (size - 1)) + 1);
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy) * (size - 1)) - 1);
    const maxY = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy) * (size - 1)) + 1);

    for (let y = minY; y <= maxY; y += 1) {
      const py = (y + 0.5) / size;
      for (let x = minX; x <= maxX; x += 1) {
        const px = (x + 0.5) / size;
        const bary = barycentricWeights(px, py, ax, ay, bx, by, cx, cy);
        if (!bary) continue;

        const [w0, w1, w2] = bary;
        const pixelIndex = y * size + x;
        const sumBase = pixelIndex * 4;
        const aBase = ia * 4;
        const bBase = ib * 4;
        const cBase = ic * 4;

        sums[sumBase + 0] += (vertexData[aBase + 0] * w0) + (vertexData[bBase + 0] * w1) + (vertexData[cBase + 0] * w2);
        sums[sumBase + 1] += (vertexData[aBase + 1] * w0) + (vertexData[bBase + 1] * w1) + (vertexData[cBase + 1] * w2);
        sums[sumBase + 2] += (vertexData[aBase + 2] * w0) + (vertexData[bBase + 2] * w1) + (vertexData[cBase + 2] * w2);
        sums[sumBase + 3] += (vertexData[aBase + 3] * w0) + (vertexData[bBase + 3] * w1) + (vertexData[cBase + 3] * w2);
        weights[pixelIndex] += 1;
      }
    }
  }

  const packed = new Uint8Array(size * size * 4);
  const filled = new Uint8Array(size * size);

  for (let i = 0; i < size * size; i += 1) {
    const weight = weights[i];
    if (weight <= 0) continue;
    const base = i * 4;
    packed[base + 0] = Math.round(clamp01(sums[base + 0] / weight) * 255);
    packed[base + 1] = Math.round(clamp01(sums[base + 1] / weight) * 255);
    packed[base + 2] = Math.round(clamp01(sums[base + 2] / weight) * 255);
    packed[base + 3] = Math.round(clamp01(sums[base + 3] / weight) * 255);
    filled[i] = 1;
  }

  return dilateTexture(packed, filled, size);
}

function bakeConditioningDetailTextures(headMesh: Mesh, regions: RegionBake): ConditioningDetailTextures {
  const positionAttr = headMesh.geometry.getAttribute('position');
  if (!positionAttr) {
    throw new Error('Head mesh is missing positions');
  }

  const count = positionAttr.count;
  const baseVertex = new Float32Array(count * 4);
  const dermalVertex = new Float32Array(count * 4);
  const microVertex = new Float32Array(count * 4);

  for (let vertexIndex = 0; vertexIndex < count; vertexIndex += 1) {
    const cheeks = readAtlasValue(regions.atlas01, vertexIndex, 0);
    const nose = readAtlasValue(regions.atlas01, vertexIndex, 1);
    const forehead = readAtlasValue(regions.atlas01, vertexIndex, 2);
    const underEyes = readAtlasValue(regions.atlas01, vertexIndex, 3);
    const lips = readAtlasValue(regions.atlas02, vertexIndex, 0);
    const chin = readAtlasValue(regions.atlas02, vertexIndex, 1);
    const neck = readAtlasValue(regions.atlas02, vertexIndex, 2);
    const philtrum = readAtlasValue(regions.atlas03, vertexIndex, 0);
    const ear = readAtlasValue(regions.atlas03, vertexIndex, 1);
    const scalp = readAtlasValue(regions.atlas03, vertexIndex, 2);
    const coverage = readAtlasValue(regions.atlas03, vertexIndex, 3);
    const curvature = readAtlasValue(regions.atlas04, vertexIndex, 0);
    const thickness = readAtlasValue(regions.atlas04, vertexIndex, 1);
    const ao = readAtlasValue(regions.atlas04, vertexIndex, 2);
    const cavity = readAtlasValue(regions.atlas04, vertexIndex, 3);
    const fhWrinkleL = readAtlasValue(regions.atlas05, vertexIndex, 0);
    const fhWrinkleR = readAtlasValue(regions.atlas05, vertexIndex, 1);
    const glabella = readAtlasValue(regions.atlas05, vertexIndex, 2);
    const crowFeetL = readAtlasValue(regions.atlas05, vertexIndex, 3);
    const crowFeetR = readAtlasValue(regions.atlas06, vertexIndex, 0);
    const nasoL = readAtlasValue(regions.atlas06, vertexIndex, 1);
    const nasoR = readAtlasValue(regions.atlas06, vertexIndex, 2);
    const noseWrinkle = readAtlasValue(regions.atlas06, vertexIndex, 3);

    const lipsSurface = smoothstep(0.4, 0.6, lips);
    const thinSkin = clamp01(1 - thickness);
    const skinCoverage = clamp01(coverage * (1 - Math.max(neck, ear, scalp)));
    const sebumZone = clamp01((nose * 1.15) + (forehead * 0.82) + (chin * 0.16));
    const vascularZone = clamp01((thinSkin * 0.62) + (underEyes * 0.18) + (lipsSurface * 0.32) + (cheeks * 0.12));
    const wrinkleUnion = clamp01(Math.max(fhWrinkleL, fhWrinkleR, glabella, crowFeetL, crowFeetR, nasoL, nasoR, noseWrinkle));
    const poreMask = clamp01((sebumZone * 0.95) + (cheeks * 0.35) + (chin * 0.18) - (underEyes * 0.75));

    let r = 0.66;
    let g = 0.49;
    let b = 0.42;
    r += cheeks * 0.1;
    g += cheeks * 0.024;
    b += cheeks * 0.012;
    r += nose * 0.056;
    g += nose * 0.016;
    r += forehead * 0.02;
    g += forehead * 0.016;
    b += forehead * 0.014;
    r -= underEyes * 0.028;
    g -= underEyes * 0.01;
    b += underEyes * 0.006;
    r += lipsSurface * 0.12;
    g -= lipsSurface * 0.04;
    b -= lipsSurface * 0.032;
    r += chin * 0.01;
    g += chin * 0.006;
    const philtrumLift = philtrum * 0.05;
    r += philtrumLift * 0.55;
    g += philtrumLift * 0.18;

    const base = vertexIndex * 4;
    baseVertex[base + 0] = clamp01(r);
    baseVertex[base + 1] = clamp01(g);
    baseVertex[base + 2] = clamp01(b);
    baseVertex[base + 3] = skinCoverage;

    dermalVertex[base + 0] = clamp01(curvature);
    dermalVertex[base + 1] = clamp01(thickness);
    dermalVertex[base + 2] = clamp01(ao);
    dermalVertex[base + 3] = clamp01(cavity);

    microVertex[base + 0] = sebumZone;
    microVertex[base + 1] = vascularZone;
    microVertex[base + 2] = wrinkleUnion;
    microVertex[base + 3] = poreMask;
  }

  return {
    size: DETAIL_TEXTURE_SIZE,
    baseMap: encodeTexture(rasterizeTexture(headMesh.geometry, baseVertex, DETAIL_TEXTURE_SIZE)),
    dermalMap: encodeTexture(rasterizeTexture(headMesh.geometry, dermalVertex, DETAIL_TEXTURE_SIZE)),
    microMap: encodeTexture(rasterizeTexture(headMesh.geometry, microVertex, DETAIL_TEXTURE_SIZE)),
  };
}

function removeAxisComponent(vector: Vector3, axis: Vector3) {
  return vector.addScaledVector(axis, -vector.dot(axis));
}

function getMeshCenterInHeadSpace(headMesh: Mesh, mesh: Mesh) {
  const geometry = mesh.geometry;
  if (!geometry.boundingSphere) {
    geometry.computeBoundingSphere();
  }

  const sphere = geometry.boundingSphere;
  if (!sphere) {
    return null;
  }

  const center = sphere.center.clone();
  mesh.localToWorld(center);
  headMesh.worldToLocal(center);
  return center;
}

function getHeadLocalWorldUp(headMesh: Mesh) {
  const inverseWorld = new Matrix4().copy(headMesh.matrixWorld).invert();
  return new Vector3(0, 1, 0).transformDirection(inverseWorld).normalize();
}

function findMesh(root: Object3D, predicate: (mesh: Mesh) => boolean) {
  let result: Mesh | null = null;

  root.traverse((child) => {
    if (result || !(child as Mesh).isMesh) {
      return;
    }

    const mesh = child as Mesh;
    if (predicate(mesh)) {
      result = mesh;
    }
  });

  return result;
}

async function loadFacecapScene() {
  Reflect.set(globalThis, 'self', globalThis);

  const response = await fetch(FACECAP_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch facecap asset: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.setKTX2Loader(textureStubLoader as unknown as KTX2Loader);
  const gltf = await loader.parseAsync(arrayBuffer, FACECAP_URL);

  const headMesh = findMesh(gltf.scene, (mesh) => mesh.name === 'mesh_2' || mesh.parent?.name === 'head');
  const leftEyeMesh = findMesh(gltf.scene, (mesh) => mesh.parent?.name === 'eyeLeft');
  const rightEyeMesh = findMesh(gltf.scene, (mesh) => mesh.parent?.name === 'eyeRight');
  const teethMesh = findMesh(gltf.scene, (mesh) => mesh.parent?.name === 'teeth');

  if (!headMesh || !leftEyeMesh || !rightEyeMesh) {
    throw new Error('Failed to discover head and eye meshes for facecap conditioning');
  }

  gltf.scene.updateMatrixWorld(true);
  headMesh.updateMatrixWorld(true);

  return { headMesh, leftEyeMesh, rightEyeMesh, teethMesh };
}

function deriveCanonicalData(headMesh: Mesh, leftEyeMesh: Mesh, rightEyeMesh: Mesh, teethMesh: Mesh | null) {
  const geometry = headMesh.geometry;
  if (!geometry.boundingBox) {
    geometry.computeBoundingBox();
  }

  const bbox = geometry.boundingBox;
  const position = geometry.getAttribute('position');
  if (!bbox || !position) {
    throw new Error('Head geometry is missing position data');
  }

  const leftEyeCenter = getMeshCenterInHeadSpace(headMesh, leftEyeMesh);
  const rightEyeCenter = getMeshCenterInHeadSpace(headMesh, rightEyeMesh);
  const teethCenter = teethMesh ? getMeshCenterInHeadSpace(headMesh, teethMesh) : null;

  if (!leftEyeCenter || !rightEyeCenter) {
    throw new Error('Could not compute eye centers in head space');
  }

  const eyeMidpoint = leftEyeCenter.clone().add(rightEyeCenter).multiplyScalar(0.5);
  const headCenter = bbox.getCenter(new Vector3());
  const headSize = bbox.getSize(new Vector3());
  const eyeSpan = leftEyeCenter.distanceTo(rightEyeCenter);
  const right = rightEyeCenter.clone().sub(leftEyeCenter).normalize();
  const up = getHeadLocalWorldUp(headMesh);
  removeAxisComponent(up, right).normalize();

  const forwardHint = removeAxisComponent(removeAxisComponent(eyeMidpoint.clone().sub(headCenter), right), up);
  const forward = new Vector3().crossVectors(right, up).normalize();
  if (forwardHint.lengthSq() > 1e-8 && forward.dot(forwardHint) < 0) {
    forward.negate();
  }

  const vertex = new Vector3();
  let noseTip = eyeMidpoint.clone().addScaledVector(forward, eyeSpan * 0.2);
  let noseBase = eyeMidpoint.clone().addScaledVector(up, -headSize.y * 0.16).addScaledVector(forward, eyeSpan * 0.12);
  let mouthCenter = teethCenter
    ? teethCenter.clone().addScaledVector(forward, eyeSpan * 0.1).addScaledVector(up, headSize.y * 0.03)
    : eyeMidpoint.clone().addScaledVector(up, -headSize.y * 0.28).addScaledVector(forward, eyeSpan * 0.14);
  let chin = eyeMidpoint.clone().addScaledVector(up, -headSize.y * 0.44).addScaledVector(forward, eyeSpan * 0.03);
  let foreheadCenter = eyeMidpoint.clone().addScaledVector(up, headSize.y * 0.34).addScaledVector(forward, eyeSpan * 0.02);
  let noseTipScore = -Infinity;
  let noseBaseScore = -Infinity;
  let mouthScore = -Infinity;
  let chinScore = -Infinity;
  let foreheadScore = -Infinity;

  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index);
    const relative = vertex.clone().sub(eyeMidpoint);
    const lateral = Math.abs(relative.dot(right)) / Math.max(eyeSpan * 0.7, 1e-5);
    const vertical = relative.dot(up) / Math.max(headSize.y, 1e-5);
    const frontal = relative.dot(forward) / Math.max(headSize.z, 1e-5);

    const nextNoseTipScore = frontal * 1.35 - lateral * 0.42 - Math.abs(vertical + 0.02) * 0.28;
    if (frontal > 0.03 && lateral < 0.4 && nextNoseTipScore > noseTipScore) {
      noseTipScore = nextNoseTipScore;
      noseTip.copy(vertex);
    }

    const nextNoseBaseScore = frontal * 1.15 - lateral * 0.36 - Math.abs(vertical + 0.16) * 1.8;
    if (frontal > 0.02 && lateral < 0.32 && nextNoseBaseScore > noseBaseScore) {
      noseBaseScore = nextNoseBaseScore;
      noseBase.copy(vertex);
    }

    const nextMouthScore = frontal * 1.2 - lateral * 0.58 - Math.abs(vertical + 0.31) * 1.7;
    if (frontal > 0.04 && lateral < 0.42 && nextMouthScore > mouthScore) {
      mouthScore = nextMouthScore;
      mouthCenter.copy(vertex);
    }

    const nextChinScore = -vertical + frontal * 0.2 - lateral * 0.42;
    if (frontal > -0.02 && lateral < 0.56 && nextChinScore > chinScore) {
      chinScore = nextChinScore;
      chin.copy(vertex);
    }

    const nextForeheadScore = vertical + frontal * 0.1 - lateral * 0.24;
    if (frontal > -0.03 && lateral < 0.68 && nextForeheadScore > foreheadScore) {
      foreheadScore = nextForeheadScore;
      foreheadCenter.copy(vertex);
    }
  }

  const refinedForward = removeAxisComponent(removeAxisComponent(noseTip.clone().sub(eyeMidpoint), right), up);
  if (refinedForward.lengthSq() > 1e-8) {
    forward.copy(refinedForward.normalize());
  }

  const faceOrigin = noseBase.clone().lerp(mouthCenter, 0.18);
  const scaleX = Math.max(1e-4, eyeSpan * 0.72);
  const scaleYTop = Math.max(1e-4, foreheadCenter.clone().sub(faceOrigin).dot(up));
  const scaleYBottom = Math.max(1e-4, -chin.clone().sub(faceOrigin).dot(up) * 0.8);
  const scaleZFront = Math.max(1e-4, noseTip.clone().sub(faceOrigin).dot(forward), mouthCenter.clone().sub(faceOrigin).dot(forward), foreheadCenter.clone().sub(faceOrigin).dot(forward));
  const scaleZBack = Math.max(1e-4, -headCenter.clone().sub(faceOrigin).dot(forward) + headSize.z * 0.18);

  return {
    anchors: {
      leftEyeCenter,
      rightEyeCenter,
      eyeMidpoint,
      noseTip,
      noseBase,
      mouthCenter,
      chin,
      foreheadCenter,
      faceOrigin,
    } satisfies CanonicalAnchors,
    frame: {
      origin: faceOrigin,
      right,
      up,
      forward,
      scaleX,
      scaleYTop,
      scaleYBottom,
      scaleZFront,
      scaleZBack,
    } satisfies CanonicalFrame,
  };
}

function toFaceSpacePoint(position: Vector3, frame: CanonicalFrame): FacePoint {
  const offset = position.clone().sub(frame.origin);
  const rawX = offset.dot(frame.right);
  const rawY = offset.dot(frame.up);
  const rawZ = offset.dot(frame.forward);

  return {
    x: rawX / Math.max(frame.scaleX, 1e-5),
    y: rawY >= 0 ? rawY / Math.max(frame.scaleYTop, 1e-5) : rawY / Math.max(frame.scaleYBottom, 1e-5),
    z: rawZ >= 0 ? rawZ / Math.max(frame.scaleZFront, 1e-5) : rawZ / Math.max(frame.scaleZBack, 1e-5),
  };
}

function bakeRegions(headMesh: Mesh, frame: CanonicalFrame, anchors: CanonicalAnchors) {
  const geometry = headMesh.geometry;
  const position = geometry.getAttribute('position');
  if (!position) {
    throw new Error('Head mesh has no position attribute');
  }

  // Compute vertex normals for curvature estimation
  geometry.computeVertexNormals();
  const normal = geometry.getAttribute('normal');
  if (!normal) {
    throw new Error('Head mesh has no normal attribute after computeVertexNormals');
  }

  const anchorFace = {
    leftEye: toFaceSpacePoint(anchors.leftEyeCenter, frame),
    rightEye: toFaceSpacePoint(anchors.rightEyeCenter, frame),
    noseTip: toFaceSpacePoint(anchors.noseTip, frame),
    noseBase: toFaceSpacePoint(anchors.noseBase, frame),
    mouthCenter: toFaceSpacePoint(anchors.mouthCenter, frame),
    chin: toFaceSpacePoint(anchors.chin, frame),
    forehead: toFaceSpacePoint(anchors.foreheadCenter, frame),
  };

  const cheekCenterY = anchorFace.noseBase.y * 0.8 + anchorFace.mouthCenter.y * 0.2;
  const cheekCenterZ = anchorFace.noseBase.z * 0.55 + anchorFace.mouthCenter.z * 0.45;
  const underEyeY = anchorFace.leftEye.y * 0.78 + anchorFace.noseBase.y * 0.22;
  const underEyeZ = anchorFace.leftEye.z * 0.4 + anchorFace.noseBase.z * 0.6;
  const foreheadY = anchorFace.forehead.y * 0.9 + anchorFace.leftEye.y * 0.1;
  const foreheadZ = anchorFace.forehead.z * 0.8 + anchorFace.noseBase.z * 0.2;
  const lipY = anchorFace.mouthCenter.y;
  const lipZ = anchorFace.mouthCenter.z * 0.85 + anchorFace.noseBase.z * 0.15;
  const philtrumY = anchorFace.noseBase.y * 0.38 + anchorFace.mouthCenter.y * 0.62;
  const philtrumZ = anchorFace.noseBase.z * 0.72 + anchorFace.mouthCenter.z * 0.28;
  const chinY = anchorFace.chin.y * 0.74 + anchorFace.mouthCenter.y * 0.26;
  const faceCenterZ = (anchorFace.forehead.z + anchorFace.noseBase.z + anchorFace.mouthCenter.z) / 3;

  // ── Build adjacency for curvature / AO ─────────────────────────────
  const index = geometry.getIndex();
  const adjacency = new Map<number, Set<number>>();
  for (let i = 0; i < position.count; i++) adjacency.set(i, new Set());

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
      adjacency.get(a)!.add(b); adjacency.get(a)!.add(c);
      adjacency.get(b)!.add(a); adjacency.get(b)!.add(c);
      adjacency.get(c)!.add(a); adjacency.get(c)!.add(b);
    }
  }

  // ── Per-vertex curvature (discrete Laplacian) ──────────────────────
  const rawCurvature = new Float32Array(position.count);
  const vA = new Vector3(), vB = new Vector3(), nA = new Vector3(), nB = new Vector3();
  for (let i = 0; i < position.count; i++) {
    vA.fromBufferAttribute(position, i);
    nA.fromBufferAttribute(normal, i);
    const neighbors = adjacency.get(i);
    if (!neighbors || neighbors.size === 0) continue;
    let curvSum = 0;
    for (const j of neighbors) {
      vB.fromBufferAttribute(position, j);
      nB.fromBufferAttribute(normal, j);
      const edge = vB.clone().sub(vA);
      const edgeLen = edge.length();
      if (edgeLen < 1e-8) continue;
      const normalDiff = nB.clone().sub(nA);
      curvSum += normalDiff.dot(edge) / (edgeLen * edgeLen);
    }
    rawCurvature[i] = curvSum / neighbors.size;
  }

  // Normalize curvature to 0..1
  let curvMin = Infinity, curvMax = -Infinity;
  for (let i = 0; i < rawCurvature.length; i++) {
    curvMin = Math.min(curvMin, rawCurvature[i]);
    curvMax = Math.max(curvMax, rawCurvature[i]);
  }
  const curvRange = Math.max(curvMax - curvMin, 1e-8);

  // ── Vertex AO (hemisphere occlusion from neighbor positions) ────────
  // Measures how much the upper hemisphere is blocked by geometry.
  // Only neighbors ABOVE the tangent plane contribute occlusion;
  // flat surfaces get AO=1.0 (fully open), concavities get AO<1.
  const rawAO = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    vA.fromBufferAttribute(position, i);
    nA.fromBufferAttribute(normal, i);
    const neighbors = adjacency.get(i);
    if (!neighbors || neighbors.size === 0) { rawAO[i] = 1; continue; }
    let occlusionSum = 0;
    let aboveCount = 0;
    for (const j of neighbors) {
      vB.fromBufferAttribute(position, j);
      const toNeighbor = vB.clone().sub(vA).normalize();
      const ndot = nA.dot(toNeighbor);
      // Only count neighbors above tangent plane (ndot > 0).
      // Higher elevation = less occlusion; neighbor at normal direction = fully open.
      if (ndot > 0) {
        // Occlusion contribution: neighbor near the horizon (ndot≈0) blocks more
        // than one directly above (ndot≈1)
        occlusionSum += 1 - ndot;
        aboveCount++;
      }
    }
    // If no neighbors above tangent plane → fully open (convex ridge)
    if (aboveCount === 0) {
      rawAO[i] = 1;
    } else {
      // Average occlusion from above-tangent neighbors, mapped to 0..1
      // Typical concavity has avg occlusion ~0.5; normalize so flat ≈ 1.0
      const avgOccl = occlusionSum / aboveCount;
      rawAO[i] = clamp01(1 - avgOccl * 0.6);
    }
  }

  // Smooth AO over 2 passes
  for (let pass = 0; pass < 2; pass++) {
    const smoothed = new Float32Array(rawAO);
    for (let i = 0; i < position.count; i++) {
      const neighbors = adjacency.get(i);
      if (!neighbors || neighbors.size === 0) continue;
      let sum = rawAO[i];
      for (const j of neighbors) sum += rawAO[j];
      smoothed[i] = sum / (neighbors.size + 1);
    }
    rawAO.set(smoothed);
  }

  // Normalize AO to full 0..1 range — 1-ring AO on smooth meshes is
  // inherently compressed; expanding the range preserves relative contrast
  // while giving the shader useful data to work with.
  let aoMinVal = Infinity, aoMaxVal = -Infinity;
  for (let i = 0; i < position.count; i++) {
    aoMinVal = Math.min(aoMinVal, rawAO[i]);
    aoMaxVal = Math.max(aoMaxVal, rawAO[i]);
  }
  const aoRange = Math.max(aoMaxVal - aoMinVal, 1e-8);
  for (let i = 0; i < position.count; i++) {
    // Normalize then apply sqrt bias: pushes most vertices toward 1.0 (bright)
    // while preserving contrast in deep concavities (eye sockets, creases)
    const normalized = (rawAO[i] - aoMinVal) / aoRange;
    rawAO[i] = Math.sqrt(normalized);
  }

  // ── Per-vertex cavity (high-freq concavity from Laplacian position) ─
  const rawCavity = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    vA.fromBufferAttribute(position, i);
    nA.fromBufferAttribute(normal, i);
    const neighbors = adjacency.get(i);
    if (!neighbors || neighbors.size === 0) continue;
    const centroid = new Vector3();
    for (const j of neighbors) {
      vB.fromBufferAttribute(position, j);
      centroid.add(vB);
    }
    centroid.multiplyScalar(1 / neighbors.size);
    const laplacian = centroid.sub(vA);
    rawCavity[i] = laplacian.dot(nA); // positive = concave
  }

  // Smooth cavity over 2 passes to reduce mesh tessellation noise
  for (let pass = 0; pass < 2; pass++) {
    const smoothed = new Float32Array(rawCavity);
    for (let i = 0; i < position.count; i++) {
      const neighbors = adjacency.get(i);
      if (!neighbors || neighbors.size === 0) continue;
      let sum = rawCavity[i];
      for (const j of neighbors) sum += rawCavity[j];
      smoothed[i] = sum / (neighbors.size + 1);
    }
    rawCavity.set(smoothed);
  }

  let cavMin = Infinity, cavMax = -Infinity;
  for (let i = 0; i < rawCavity.length; i++) {
    cavMin = Math.min(cavMin, rawCavity[i]);
    cavMax = Math.max(cavMax, rawCavity[i]);
  }
  const cavRange = Math.max(cavMax - cavMin, 1e-8);

  // Normalize cavity to 0..1, then sqrt bias toward 0 (no cavity = no darkening)
  // Only deep concavities (eye sockets, nasolabial folds) should have significant values
  for (let i = 0; i < position.count; i++) {
    const normalized = clamp01((rawCavity[i] - cavMin) / cavRange);
    rawCavity[i] = normalized * normalized; // square bias: pushes most values toward 0
  }

  // ── Bake all atlases ───────────────────────────────────────────────
  const atlas01: number[] = [];
  const atlas02: number[] = [];
  const atlas03: number[] = [];
  const atlas04: number[] = [];
  const atlas05: number[] = [];
  const atlas06: number[] = [];
  const vertex = new Vector3();

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i);
    const point = toFaceSpacePoint(vertex, frame);

    // ── atlas01–03: same anatomical region masks as before ───────
    const frontFace = smoothstep(-0.58, 0.22, point.z);
    const scalpExclusion = smoothstep(anchorFace.forehead.y * 0.9, anchorFace.forehead.y + 0.24, point.y) * band(point.z, faceCenterZ, 0.82, 0.2);
    const neckExclusion = smoothstep(-anchorFace.mouthCenter.y * 0.85, -anchorFace.chin.y * 0.78, -point.y) * band(point.x, 0, 0.58, 0.22);
    const earExclusion = (
      ellipsoidMask(point, { x: -0.9, y: 0.02, z: -0.02 }, { x: 0.16, y: 0.26, z: 0.22 }, 0.14)
      + ellipsoidMask(point, { x: 0.9, y: 0.02, z: -0.02 }, { x: 0.16, y: 0.26, z: 0.22 }, 0.14)
    ) * (1 - smoothstep(0.04, 0.28, point.z));
    const facialHull = band(point.x, 0, 0.98, 0.16) * band(point.y, -0.08, 1.08, 0.18) * band(point.z, faceCenterZ, 0.86, 0.18);
    const skinCoverage = clamp01(Math.max(frontFace, facialHull) * (1 - Math.max(neckExclusion, earExclusion, scalpExclusion)));

    const cheeks = clamp01((
      ellipsoidMask(point, { x: anchorFace.leftEye.x * 0.75, y: cheekCenterY, z: cheekCenterZ }, { x: 0.20, y: 0.18, z: 0.26 }, 0.10)
      + ellipsoidMask(point, { x: anchorFace.rightEye.x * 0.75, y: cheekCenterY, z: cheekCenterZ }, { x: 0.20, y: 0.18, z: 0.26 }, 0.10)
    ) * skinCoverage);
    const nose = clamp01(ellipsoidMask(point, { x: 0, y: anchorFace.noseBase.y * 0.55 + anchorFace.noseTip.y * 0.45, z: anchorFace.noseBase.z * 0.35 + anchorFace.noseTip.z * 0.65 }, { x: 0.14, y: 0.26, z: 0.34 }, 0.12) * skinCoverage);
    const forehead = clamp01(ellipsoidMask(point, { x: 0, y: foreheadY, z: foreheadZ }, { x: 0.4, y: 0.24, z: 0.32 }, 0.16) * skinCoverage);
    const underEyes = clamp01((
      ellipsoidMask(point, { x: anchorFace.leftEye.x * 0.84, y: underEyeY, z: underEyeZ }, { x: 0.18, y: 0.12, z: 0.18 }, 0.1)
      + ellipsoidMask(point, { x: anchorFace.rightEye.x * 0.84, y: underEyeY, z: underEyeZ }, { x: 0.18, y: 0.12, z: 0.18 }, 0.1)
    ) * skinCoverage);
    const lips = clamp01(ellipsoidMask(point, { x: 0, y: lipY, z: lipZ }, { x: 0.28, y: 0.15, z: 0.22 }, 0.1) * skinCoverage);
    const chinMask = clamp01(ellipsoidMask(point, { x: 0, y: chinY, z: anchorFace.chin.z * 0.55 + anchorFace.mouthCenter.z * 0.45 }, { x: 0.32, y: 0.2, z: 0.24 }, 0.14) * skinCoverage);
    const philtrum = clamp01(ellipsoidMask(point, { x: 0, y: philtrumY, z: philtrumZ }, { x: 0.1, y: 0.16, z: 0.2 }, 0.08) * skinCoverage);
    const wrinkleRegions = clamp01(Math.max(forehead * 0.92, underEyes * 0.88, philtrum * 0.4));

    atlas01.push(roundNumber(cheeks), roundNumber(nose), roundNumber(forehead), roundNumber(underEyes));
    atlas02.push(roundNumber(lips), roundNumber(chinMask), roundNumber(neckExclusion), roundNumber(wrinkleRegions));
    atlas03.push(roundNumber(philtrum), roundNumber(earExclusion), roundNumber(scalpExclusion), roundNumber(skinCoverage));

    // ── atlas04: curvature, thickness, AO, cavity ────────────────
    const curvature = clamp01((rawCurvature[i] - curvMin) / curvRange);
    // Thickness: thin around eyes/lips/nose bridge, thicker on cheeks/forehead
    const thickness = clamp01(
      0.5
      + cheeks * 0.35
      + forehead * 0.22
      + chinMask * 0.18
      - underEyes * 0.42
      - lips * 0.28
      - nose * 0.12
      - philtrum * 0.15
    );
    const ao = clamp01(rawAO[i]);
    const cavity = clamp01(rawCavity[i]); // already normalized + squared in pre-processing

    atlas04.push(roundNumber(curvature), roundNumber(thickness), roundNumber(ao), roundNumber(cavity));

    // ── atlas05: per-region wrinkle masks ────────────────────────
    // foreheadWrinkle: horizontal lines across forehead
    const foreheadWrinkleL = clamp01(
      ellipsoidMask(point, { x: -0.2, y: anchorFace.forehead.y * 0.85, z: foreheadZ }, { x: 0.22, y: 0.18, z: 0.24 }, 0.12) * skinCoverage
    );
    const foreheadWrinkleR = clamp01(
      ellipsoidMask(point, { x: 0.2, y: anchorFace.forehead.y * 0.85, z: foreheadZ }, { x: 0.22, y: 0.18, z: 0.24 }, 0.12) * skinCoverage
    );
    // glabella: vertical furrows between brows
    const glabellaMask = clamp01(
      ellipsoidMask(point, { x: 0, y: anchorFace.forehead.y * 0.58, z: foreheadZ * 0.9 + anchorFace.noseBase.z * 0.1 }, { x: 0.12, y: 0.14, z: 0.18 }, 0.1) * skinCoverage
    );
    // crow's feet: outer eye corners
    const crowFeetL = clamp01(
      ellipsoidMask(point, { x: anchorFace.leftEye.x * 1.28, y: anchorFace.leftEye.y * 0.92, z: anchorFace.leftEye.z * 0.7 }, { x: 0.14, y: 0.18, z: 0.22 }, 0.12) * skinCoverage
    );
    const crowFeetR = clamp01(
      ellipsoidMask(point, { x: anchorFace.rightEye.x * 1.28, y: anchorFace.rightEye.y * 0.92, z: anchorFace.rightEye.z * 0.7 }, { x: 0.14, y: 0.18, z: 0.22 }, 0.12) * skinCoverage
    );

    atlas05.push(roundNumber(foreheadWrinkleL), roundNumber(foreheadWrinkleR), roundNumber(glabellaMask), roundNumber(crowFeetL));

    // ── atlas06: nasolabial, nose wrinkle, sebum, cheek flush ────
    const nasolabialL = clamp01(
      ellipsoidMask(point, { x: anchorFace.leftEye.x * 0.52, y: anchorFace.noseBase.y * 0.35 + anchorFace.mouthCenter.y * 0.65, z: anchorFace.noseBase.z * 0.5 + anchorFace.mouthCenter.z * 0.5 }, { x: 0.12, y: 0.28, z: 0.22 }, 0.1) * skinCoverage
    );
    const nasolabialR = clamp01(
      ellipsoidMask(point, { x: anchorFace.rightEye.x * 0.52, y: anchorFace.noseBase.y * 0.35 + anchorFace.mouthCenter.y * 0.65, z: anchorFace.noseBase.z * 0.5 + anchorFace.mouthCenter.z * 0.5 }, { x: 0.12, y: 0.28, z: 0.22 }, 0.1) * skinCoverage
    );
    const noseWrinkle = clamp01(
      ellipsoidMask(point, { x: 0, y: anchorFace.noseBase.y * 0.7 + anchorFace.noseTip.y * 0.3, z: anchorFace.noseBase.z * 0.5 + anchorFace.noseTip.z * 0.5 }, { x: 0.14, y: 0.18, z: 0.28 }, 0.1) * skinCoverage
    );
    // Sebum: T-zone (forehead center + nose ridge + chin)
    const sebumZone = clamp01(
      ellipsoidMask(point, { x: 0, y: anchorFace.forehead.y * 0.7 + anchorFace.noseBase.y * 0.3, z: foreheadZ * 0.6 + anchorFace.noseBase.z * 0.4 }, { x: 0.16, y: 0.52, z: 0.32 }, 0.14) * skinCoverage
      + nose * 0.4
      + chinMask * 0.15
    );

    atlas06.push(roundNumber(nasolabialL), roundNumber(nasolabialR), roundNumber(noseWrinkle), roundNumber(clamp01(sebumZone)));
  }

  // Append crowFeetR to atlas05 as 5th value? No — we have 4 channels.
  // crowFeetR is already in atlas05[3]... wait, we put crowFeetL in [3].
  // Let me restructure: atlas05 = [foreheadWrinkleL, foreheadWrinkleR, glabella, crowFeetL]
  // atlas06 = [nasolabialL, nasolabialR, noseWrinkle, sebumZone]
  // crowFeetR lives alongside crowFeetL since both are symmetric wrinkle masks.
  // We need a 7th atlas or pack crowFeetR differently. Let's replace atlas05[1] with combined forehead.
  // Actually, let's keep it clean: pack crowFeetR into atlas06 and bump sebum to atlas03's wrinkleRegions slot.
  // 
  // Simpler: repack atlas05 = [foreheadWrinkle(combined), glabella, crowFeetL, crowFeetR]
  //          atlas06 = [nasolabialL, nasolabialR, noseWrinkle, sebumZone]

  // Rewrite atlas05 with combined forehead
  const atlas05Repacked: number[] = [];
  for (let i = 0; i < position.count; i++) {
    const base = i * 4;
    const fhL = atlas05[base];
    const fhR = atlas05[base + 1];
    const glabella = atlas05[base + 2];
    const cfL = atlas05[base + 3];
    // Re-derive crowFeetR
    vertex.fromBufferAttribute(position, i);
    const point = toFaceSpacePoint(vertex, frame);
    const frontFace = smoothstep(-0.58, 0.22, point.z);
    const scalpExclusion = smoothstep(anchorFace.forehead.y * 0.9, anchorFace.forehead.y + 0.24, point.y) * band(point.z, faceCenterZ, 0.82, 0.2);
    const neckExclusion = smoothstep(-anchorFace.mouthCenter.y * 0.85, -anchorFace.chin.y * 0.78, -point.y) * band(point.x, 0, 0.58, 0.22);
    const earExclusion = (
      ellipsoidMask(point, { x: -0.9, y: 0.02, z: -0.02 }, { x: 0.16, y: 0.26, z: 0.22 }, 0.14)
      + ellipsoidMask(point, { x: 0.9, y: 0.02, z: -0.02 }, { x: 0.16, y: 0.26, z: 0.22 }, 0.14)
    ) * (1 - smoothstep(0.04, 0.28, point.z));
    const facialHull = band(point.x, 0, 0.98, 0.16) * band(point.y, -0.08, 1.08, 0.18) * band(point.z, faceCenterZ, 0.86, 0.18);
    const skinCov = clamp01(Math.max(frontFace, facialHull) * (1 - Math.max(neckExclusion, earExclusion, scalpExclusion)));
    const cfR = clamp01(
      ellipsoidMask(point, { x: anchorFace.rightEye.x * 1.28, y: anchorFace.rightEye.y * 0.92, z: anchorFace.rightEye.z * 0.7 }, { x: 0.14, y: 0.18, z: 0.22 }, 0.12) * skinCov
    );
    // Pack: [foreheadL, foreheadR, glabella, crowFeetL]
    // We keep L/R separate for forehead for expression-driven asymmetry
    atlas05Repacked.push(fhL, fhR, glabella, cfL);
    // We'll store crowFeetR in a new atlas07 or repack... 
    // Actually simplest: put crowFeetR into atlas06 and shift sebum.
    // atlas06 = [crowFeetR, nasolabialL, nasolabialR, noseWrinkle]
    // sebumZone goes back into atlas03 or we create atlas07.
    // Better: combine crowFeet L+R into one mask (since they're bilaterally symmetric with the expression driver)
    // Then atlas05 = [foreheadL, foreheadR, glabella, crowFeetCombined]
    // The expression driver can still be asymmetric (crowLeft vs crowRight uniform).
    // For the mask, we keep them separate and just use 7 atlas channels.
    // Let's just add atlas07. It's only 4 more floats per vertex.
  }

  // Actually, let's simplify. Repack into exactly 6 atlases with clean channel assignments:
  // atlas05 = [foreheadWrinkleL, foreheadWrinkleR, glabella, crowFeetL]
  // atlas06 = [crowFeetR, nasolabialL, nasolabialR, noseWrinkle]
  // sebumZone → put it in atlas04 by replacing... no, atlas04 is full.
  // We derive sebumZone in the shader from nose + forehead masks (already in atlas01).
  // That's fine — sebum = f(nose, forehead, chin) which are already baked.

  // Final repack atlas06 with crowFeetR in [0]
  const atlas06Repacked: number[] = [];
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const point = toFaceSpacePoint(vertex, frame);
    const frontFace = smoothstep(-0.58, 0.22, point.z);
    const scalpExclusion = smoothstep(anchorFace.forehead.y * 0.9, anchorFace.forehead.y + 0.24, point.y) * band(point.z, faceCenterZ, 0.82, 0.2);
    const neckExclusion = smoothstep(-anchorFace.mouthCenter.y * 0.85, -anchorFace.chin.y * 0.78, -point.y) * band(point.x, 0, 0.58, 0.22);
    const earExclusion = (
      ellipsoidMask(point, { x: -0.9, y: 0.02, z: -0.02 }, { x: 0.16, y: 0.26, z: 0.22 }, 0.14)
      + ellipsoidMask(point, { x: 0.9, y: 0.02, z: -0.02 }, { x: 0.16, y: 0.26, z: 0.22 }, 0.14)
    ) * (1 - smoothstep(0.04, 0.28, point.z));
    const facialHull = band(point.x, 0, 0.98, 0.16) * band(point.y, -0.08, 1.08, 0.18) * band(point.z, faceCenterZ, 0.86, 0.18);
    const skinCov = clamp01(Math.max(frontFace, facialHull) * (1 - Math.max(neckExclusion, earExclusion, scalpExclusion)));
    const cfR = roundNumber(clamp01(
      ellipsoidMask(point, { x: anchorFace.rightEye.x * 1.28, y: anchorFace.rightEye.y * 0.92, z: anchorFace.rightEye.z * 0.7 }, { x: 0.14, y: 0.18, z: 0.22 }, 0.12) * skinCov
    ));

    const base6 = i * 4;
    const nasoL = atlas06[base6];
    const nasoR = atlas06[base6 + 1];
    const noseW = atlas06[base6 + 2];
    // atlas06 repacked: [crowFeetR, nasolabialL, nasolabialR, noseWrinkle]
    atlas06Repacked.push(cfR, nasoL, nasoR, noseW);
  }

  return { atlas01, atlas02, atlas03, atlas04, atlas05: atlas05Repacked, atlas06: atlas06Repacked } satisfies RegionBake;
}

function buildConditioningPayload(params: {
  headMeshName: string;
  positionCount: number;
  anchors: CanonicalAnchors;
  frame: CanonicalFrame;
  regions: RegionBake;
  meshRoles: MeshRoles;
  detailTextures: ConditioningDetailTextures;
}) {
  const payload = {
    headMeshName: params.headMeshName,
    positionCount: params.positionCount,
    meshRoles: params.meshRoles,
    anchors: Object.fromEntries(Object.entries(params.anchors).map(([key, vector]) => [key, serializeVector(vector)])),
    frame: {
      origin: serializeVector(params.frame.origin),
      right: serializeVector(params.frame.right),
      up: serializeVector(params.frame.up),
      forward: serializeVector(params.frame.forward),
      scaleX: roundNumber(params.frame.scaleX),
      scaleYTop: roundNumber(params.frame.scaleYTop),
      scaleYBottom: roundNumber(params.frame.scaleYBottom),
      scaleZFront: roundNumber(params.frame.scaleZFront),
      scaleZBack: roundNumber(params.frame.scaleZBack),
    },
    atlases: params.regions,
    detailTextures: params.detailTextures,
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}

async function main() {
  const { headMesh, leftEyeMesh, rightEyeMesh, teethMesh } = await loadFacecapScene();
  const { anchors, frame } = deriveCanonicalData(headMesh, leftEyeMesh, rightEyeMesh, teethMesh);
  const regions = bakeRegions(headMesh, frame, anchors);
  const detailTextures = bakeConditioningDetailTextures(headMesh, regions);
  const meshRoles: MeshRoles = {
    headSkin: [headMesh.name],
    eyes: [leftEyeMesh.name, rightEyeMesh.name],
    teeth: teethMesh ? [teethMesh.name] : [],
    mouthInterior: [],
    lashesOrBrows: [],
  };
  const position = headMesh.geometry.getAttribute('position');
  if (!position) {
    throw new Error('Head mesh position attribute missing after load');
  }

  const payloadJson = buildConditioningPayload({
    headMeshName: headMesh.name,
    positionCount: position.count,
    anchors,
    frame,
    regions,
    meshRoles,
    detailTextures,
  });
  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceAsset: FACECAP_URL,
    payloadFile: path.relative(process.cwd(), PAYLOAD_FILE),
    headMeshName: headMesh.name,
    positionCount: position.count,
    meshRoles,
    anchors: Object.fromEntries(Object.entries(anchors).map(([key, value]) => [key, serializeVector(value)])),
    frame: {
      origin: serializeVector(frame.origin),
      right: serializeVector(frame.right),
      up: serializeVector(frame.up),
      forward: serializeVector(frame.forward),
      scaleX: roundNumber(frame.scaleX),
      scaleYTop: roundNumber(frame.scaleYTop),
      scaleYBottom: roundNumber(frame.scaleYBottom),
      scaleZFront: roundNumber(frame.scaleZFront),
      scaleZBack: roundNumber(frame.scaleZBack),
    },
    maskChannels: {
      atlas01: ['cheeks', 'nose', 'forehead', 'underEyes'],
      atlas02: ['lips', 'chin', 'neckExclusion', 'wrinkleRegions'],
      atlas03: ['philtrum', 'earExclusion', 'scalpExclusion', 'skinCoverage'],
      atlas04: ['curvature', 'thickness', 'ambientOcclusion', 'cavity'],
      atlas05: ['foreheadWrinkleL', 'foreheadWrinkleR', 'glabella', 'crowFeetL'],
      atlas06: ['crowFeetR', 'nasolabialL', 'nasolabialR', 'noseWrinkle'],
    },
    detailTextureSize: detailTextures.size,
    detailTextureChannels: {
      baseMap: ['albedoR', 'albedoG', 'albedoB', 'coverage'],
      dermalMap: ['curvature', 'thickness', 'ambientOcclusion', 'cavity'],
      microMap: ['sebum', 'vascular', 'wrinkleUnion', 'poreMask'],
    },
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  await writeFile(PAYLOAD_FILE, payloadJson);

  console.log(`Wrote conditioning manifest to ${MANIFEST_FILE}`);
  console.log(`Wrote conditioning payload to ${PAYLOAD_FILE}`);
}

main().catch((error) => {
  console.error('[condition-facecap-asset] failed', error);
  process.exitCode = 1;
});
