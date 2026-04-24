/*
  Node-side diagnostic for eye fitting.

  Usage:
    pnpm inspect:facecap

  What it does:
    - Downloads facecap.glb
    - Parses the GLB container directly (no Three.js loader)
    - Finds eye nodes (eyeLeft/right or grp_eyeLeft/right)
    - Lists mesh primitives under each eye, computing similar candidate metrics used at runtime

  Why not GLTFLoader?
    The model uses KTX2/BasisU textures. GLTFLoader requires a KTX2 loader and a browser-ish
    image pipeline, which is unnecessary for geometry-only inspection and can fail in Node.
*/

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const FACECAP_MODEL_FILE = path.resolve(process.cwd(), 'public/models/facecap.glb');

type MeshCandidate = {
  name: string;
  uuid: string;
  radius: number;
  worldRadius: number;
  sphericity: number;
  vertexCount: number;
  score: number;
  center: [number, number, number];
  worldScale: [number, number, number];
};

type Vec3 = [number, number, number];
type Mat4 = number[]; // length 16, column-major

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function mat4Identity(): Mat4 {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

function mat4Mul(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function mat4FromTRS(t?: Vec3, r?: [number, number, number, number], s?: Vec3): Mat4 {
  const tx = t?.[0] ?? 0;
  const ty = t?.[1] ?? 0;
  const tz = t?.[2] ?? 0;

  const qx = r?.[0] ?? 0;
  const qy = r?.[1] ?? 0;
  const qz = r?.[2] ?? 0;
  const qw = r?.[3] ?? 1;

  const sx = s?.[0] ?? 1;
  const sy = s?.[1] ?? 1;
  const sz = s?.[2] ?? 1;

  const x2 = qx + qx;
  const y2 = qy + qy;
  const z2 = qz + qz;

  const xx = qx * x2;
  const xy = qx * y2;
  const xz = qx * z2;
  const yy = qy * y2;
  const yz = qy * z2;
  const zz = qz * z2;
  const wx = qw * x2;
  const wy = qw * y2;
  const wz = qw * z2;

  // Column-major 4x4
  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,

    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,

    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,

    tx,
    ty,
    tz,
    1,
  ];
}

function mat4GetWorldScale(m: Mat4): Vec3 {
  // Column vectors 0..2 represent transformed basis.
  const sx = Math.hypot(m[0], m[1], m[2]);
  const sy = Math.hypot(m[4], m[5], m[6]);
  const sz = Math.hypot(m[8], m[9], m[10]);
  return [sx, sy, sz];
}

type GLTFJson = {
  scene?: number;
  scenes?: Array<{ nodes?: number[] }>;
  nodes?: Array<{
    name?: string;
    children?: number[];
    mesh?: number;
    matrix?: number[];
    translation?: Vec3;
    rotation?: [number, number, number, number];
    scale?: Vec3;
  }>;
  meshes?: Array<{ name?: string; primitives: Array<{ attributes: Record<string, number> }> }>;
  accessors?: Array<{ min?: number[]; max?: number[]; count?: number }>;
};

function parseGLB(glb: ArrayBuffer): { json: GLTFJson; bin: Uint8Array | null } {
  const dv = new DataView(glb);
  const magic = dv.getUint32(0, true);
  if (magic !== 0x46546c67) throw new Error('Invalid GLB: bad magic');
  const version = dv.getUint32(4, true);
  if (version !== 2) throw new Error(`Invalid GLB: version ${version}`);
  const length = dv.getUint32(8, true);
  if (length !== glb.byteLength) {
    // Not fatal, but suspicious.
  }

  let offset = 12;
  let json: GLTFJson | null = null;
  let bin: Uint8Array | null = null;
  const td = new TextDecoder('utf-8');

  while (offset + 8 <= glb.byteLength) {
    const chunkLength = dv.getUint32(offset, true);
    const chunkType = dv.getUint32(offset + 4, true);
    offset += 8;
    const chunkData = new Uint8Array(glb, offset, chunkLength);
    offset += chunkLength;

    // JSON
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(td.decode(chunkData)) as GLTFJson;
    }

    // BIN
    if (chunkType === 0x004e4942) {
      bin = new Uint8Array(chunkData);
    }
  }

  if (!json) throw new Error('Invalid GLB: missing JSON chunk');
  return { json, bin };
}

function computeSphericityFromBox(size: Vec3) {
  const mean = (size[0] + size[1] + size[2]) / 3;
  if (mean <= 0) return 0;
  const dx = size[0] - mean;
  const dy = size[1] - mean;
  const dz = size[2] - mean;
  const std = Math.sqrt((dx * dx + dy * dy + dz * dz) / 3);
  return clamp01(1 - std / mean);
}

type BaseCandidate = {
  name: string;
  uuid: string;
  radius: number;
  worldRadius: number;
  sphericity: number;
  nameScore: number;
  vertexCount: number;
  center: Vec3;
  worldScale: Vec3;
};

function makeBaseCandidate(params: {
  name: string;
  uuid: string;
  boxMin: Vec3;
  boxMax: Vec3;
  worldScale: Vec3;
  vertexCount: number;
}): BaseCandidate {
  const dx = params.boxMax[0] - params.boxMin[0];
  const dy = params.boxMax[1] - params.boxMin[1];
  const dz = params.boxMax[2] - params.boxMin[2];

  const size: Vec3 = [dx, dy, dz];
  const sphericity = computeSphericityFromBox(size);

  // Approx bounding sphere radius from bounding box diagonal.
  const r = 0.5 * Math.hypot(dx, dy, dz);
  const worldRadius = r * Math.max(params.worldScale[0], params.worldScale[1], params.worldScale[2]);

  const lname = params.name.toLowerCase();
  let nameScore = 0;
  if (lname.includes('eye') || lname.includes('eyeball') || lname.includes('cornea')) nameScore += 1.5;
  if (lname.includes('lid') || lname.includes('lash') || lname.includes('brow') || lname.includes('socket')) nameScore -= 2.0;

  const center: Vec3 = [
    (params.boxMin[0] + params.boxMax[0]) * 0.5,
    (params.boxMin[1] + params.boxMax[1]) * 0.5,
    (params.boxMin[2] + params.boxMax[2]) * 0.5,
  ];

  return {
    name: params.name,
    uuid: params.uuid,
    radius: r,
    worldRadius,
    sphericity,
    nameScore,
    vertexCount: params.vertexCount,
    center,
    worldScale: params.worldScale,
  };
}

function listEyeMeshes(json: GLTFJson, nodeWorld: Mat4[], rootNodeIndex: number) {
  const nodes = json.nodes ?? [];
  const meshes = json.meshes ?? [];
  const accessors = json.accessors ?? [];

  const base: BaseCandidate[] = [];
  const stack: number[] = [rootNodeIndex];

  while (stack.length) {
    const nodeIndex = stack.pop()!;
    const node = nodes[nodeIndex];
    if (!node) continue;
    if (node.children) stack.push(...node.children);

    if (node.mesh == null) continue;
    const meshIndex = node.mesh;
    const meshDef = meshes[meshIndex];
    if (!meshDef) continue;

    const nodeName = node.name ?? `node_${nodeIndex}`;
    const meshName = meshDef.name ?? `mesh_${meshIndex}`;
    const worldScale = mat4GetWorldScale(nodeWorld[nodeIndex] ?? mat4Identity());

    for (let primIndex = 0; primIndex < meshDef.primitives.length; primIndex++) {
      const prim = meshDef.primitives[primIndex];
      const posAccessorIndex = prim.attributes?.POSITION;
      if (posAccessorIndex == null) continue;

      const acc = accessors[posAccessorIndex];
      if (!acc?.min || !acc?.max || acc.min.length < 3 || acc.max.length < 3) {
        throw new Error(
          `Accessor ${posAccessorIndex} missing min/max; this inspector currently relies on accessor bounds (mesh may be compressed).`,
        );
      }

      const boxMin: Vec3 = [acc.min[0], acc.min[1], acc.min[2]];
      const boxMax: Vec3 = [acc.max[0], acc.max[1], acc.max[2]];

      const name = `${nodeName}/${meshName}/prim${primIndex}`;
      const uuid = `node${nodeIndex}:mesh${meshIndex}:prim${primIndex}:pos${posAccessorIndex}`;
      const vertexCount = (acc.count ?? 0) | 0;
      base.push(makeBaseCandidate({ name, uuid, boxMin, boxMax, worldScale, vertexCount }));
    }
  }

  const logR = base.map((m) => Math.log(Math.max(m.radius, 1e-12))).sort((a, b) => a - b);
  const medianLogR = logR.length
    ? (logR.length % 2 === 1
      ? logR[(logR.length - 1) / 2]
      : (logR[logR.length / 2 - 1] + logR[logR.length / 2]) / 2)
    : 0;
  const absDev = logR.map((v) => Math.abs(v - medianLogR)).sort((a, b) => a - b);
  const mad = absDev.length
    ? (absDev.length % 2 === 1
      ? absDev[(absDev.length - 1) / 2]
      : (absDev[absDev.length / 2 - 1] + absDev[absDev.length / 2]) / 2)
    : 0;
  const denom = Math.max(mad * 3, 1e-6);
  const maxVerts = Math.max(1, ...base.map((m) => m.vertexCount));

  const out: MeshCandidate[] = base.map((m) => {
    const radiusZ = Math.abs(Math.log(Math.max(m.radius, 1e-12)) - medianLogR) / denom;
    const radiusInlier = 1 - clamp01(radiusZ);
    const vertScore = Math.sqrt(m.vertexCount / maxVerts);
    const score =
      m.sphericity * 3.0 +
      m.nameScore +
      radiusInlier * 0.9 +
      vertScore * 0.2 +
      Math.min(m.worldRadius, 0.5) * 0.25;

    return {
      name: m.name,
      uuid: m.uuid,
      radius: m.radius,
      worldRadius: m.worldRadius,
      sphericity: m.sphericity,
      vertexCount: m.vertexCount,
      score,
      center: m.center,
      worldScale: m.worldScale,
    };
  });

  out.sort((a, b) => b.score - a.score);
  return out;
}

function findBestEyeRoot(params: {
  json: GLTFJson;
  nodeWorld: Mat4[];
  side: 'left' | 'right';
}) {
  const nodes = params.json.nodes ?? [];

  const matches: number[] = [];
  const sideRe = params.side === 'left' ? /left|l_/i : /right|r_/i;
  const eyeRe = /eye/i;

  for (let i = 0; i < nodes.length; i++) {
    const name = nodes[i]?.name ?? '';
    if (!name) continue;
    if (eyeRe.test(name) && sideRe.test(name)) matches.push(i);
  }

  // Always include the known names if present.
  const exact = params.side === 'left'
    ? ['grp_eyeLeft', 'eyeLeft']
    : ['grp_eyeRight', 'eyeRight'];
  for (const n of exact) {
    const idx = nodes.findIndex((x) => (x?.name ?? '') === n);
    if (idx >= 0 && !matches.includes(idx)) matches.push(idx);
  }

  if (matches.length === 0) return null;

  let best: { index: number; candidates: MeshCandidate[] } | null = null;
  for (const idx of matches) {
    let candidates: MeshCandidate[];
    try {
      candidates = listEyeMeshes(params.json, params.nodeWorld, idx);
    } catch {
      continue;
    }

    if (!best) {
      best = { index: idx, candidates };
      continue;
    }

    if (candidates.length > best.candidates.length) {
      best = { index: idx, candidates };
      continue;
    }

    if (candidates.length === best.candidates.length) {
      const a = candidates[0]?.score ?? -Infinity;
      const b = best.candidates[0]?.score ?? -Infinity;
      if (a > b) best = { index: idx, candidates };
    }
  }

  return best;
}

async function main() {
  const glb = await readFile(FACECAP_MODEL_FILE);
  const arrayBuffer = glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength) as ArrayBuffer;

  const { json } = parseGLB(arrayBuffer);
  const nodes = json.nodes ?? [];

  // Build world matrices for all nodes reachable from the default scene.
  const nodeWorld: Mat4[] = new Array(nodes.length);
  const sceneIndex = json.scene ?? 0;
  const sceneRoots = json.scenes?.[sceneIndex]?.nodes ?? [];

  const visit = (nodeIndex: number, parentWorld: Mat4) => {
    const n = nodes[nodeIndex];
    if (!n) return;

    const local = Array.isArray(n.matrix) && n.matrix.length === 16
      ? (n.matrix as Mat4)
      : mat4FromTRS(n.translation, n.rotation, n.scale);

    const world = mat4Mul(parentWorld, local);
    nodeWorld[nodeIndex] = world;

    if (n.children) {
      for (const c of n.children) visit(c, world);
    }
  };

  const identity = mat4Identity();
  for (const root of sceneRoots) visit(root, identity);

  const bestLeftRoot = findBestEyeRoot({ json, nodeWorld, side: 'left' });
  const bestRightRoot = findBestEyeRoot({ json, nodeWorld, side: 'right' });

  if (!bestLeftRoot || !bestRightRoot) {
    const sample = nodes
      .map((n, i) => ({ i, name: n?.name ?? '' }))
      .filter((x) => /eye/i.test(x.name))
      .slice(0, 50);
    console.error('Could not discover eye roots. Node names containing "eye":', sample);
    process.exitCode = 1;
    return;
  }

  const leftEyeIndex = bestLeftRoot.index;
  const rightEyeIndex = bestRightRoot.index;

  console.log('Using eye roots:', {
    left: { index: leftEyeIndex, name: nodes[leftEyeIndex]?.name ?? null, candidateCount: bestLeftRoot.candidates.length },
    right: { index: rightEyeIndex, name: nodes[rightEyeIndex]?.name ?? null, candidateCount: bestRightRoot.candidates.length },
  });

  const left = bestLeftRoot.candidates;
  const right = bestRightRoot.candidates;

  console.log('--- Left eye candidates (sorted by score) ---');
  console.table(left.map((m) => ({
    name: m.name,
    radius: Number(m.radius.toFixed(5)),
    worldRadius: Number(m.worldRadius.toFixed(5)),
    sphericity: Number(m.sphericity.toFixed(3)),
    vertexCount: m.vertexCount,
    score: Number(m.score.toFixed(3)),
    uuid: m.uuid,
  })));

  console.log('--- Right eye candidates (sorted by score) ---');
  console.table(right.map((m) => ({
    name: m.name,
    radius: Number(m.radius.toFixed(5)),
    worldRadius: Number(m.worldRadius.toFixed(5)),
    sphericity: Number(m.sphericity.toFixed(3)),
    vertexCount: m.vertexCount,
    score: Number(m.score.toFixed(3)),
    uuid: m.uuid,
  })));

  const bestLeft = left[0];
  const bestRight = right[0];

  console.log('Best picks:', {
    left: bestLeft ? { name: bestLeft.name, uuid: bestLeft.uuid, score: bestLeft.score } : null,
    right: bestRight ? { name: bestRight.name, uuid: bestRight.uuid, score: bestRight.score } : null,
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
