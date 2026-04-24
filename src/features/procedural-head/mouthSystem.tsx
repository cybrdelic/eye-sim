import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type {
  ProceduralExpressionValues,
  ProceduralHeadIdentity,
  ProceduralHeadMaterialMode,
  ProceduralHeadQuality,
} from './types';
import { PROCEDURAL_QUALITY_CONFIG } from './types';
import {
  ProceduralDentalMaterial,
  ProceduralGumMaterial,
  ProceduralLipMaterial,
  ProceduralTongueMaterial,
} from './materials';
import { clamp, gaussian2D, lerp, smoothstep } from './random';

function setMorphInfluences(mesh: THREE.Mesh | null, expressions: ProceduralExpressionValues, strength: number) {
  if (!mesh?.morphTargetDictionary || !mesh.morphTargetInfluences) return;
  for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
    mesh.morphTargetInfluences[index] = clamp((expressions[name as keyof ProceduralExpressionValues] ?? 0) * strength);
  }
}

function createLipPoint(t: number, row: number, identity: ProceduralHeadIdentity) {
  const lipWidth = lerp(0.32, 0.48, identity.faceWidth);
  const lipHeight = lerp(0.052, 0.11, identity.lipFullness);
  const thickness = lerp(0.014, 0.045, identity.lipFullness);
  const x = Math.cos(t) * lipWidth * (1 + Math.sin(t) * 0.05);
  const y = -0.43 + Math.sin(t) * lipHeight + row * thickness;
  const z = 0.626 + Math.cos(t) * 0.018 + Math.abs(Math.sin(t)) * thickness * 0.55;
  return new THREE.Vector3(x, y, z);
}

export function createProceduralLipGeometry(identity: ProceduralHeadIdentity, quality: ProceduralHeadQuality) {
  const config = PROCEDURAL_QUALITY_CONFIG[quality];
  const segments = Math.max(48, Math.round(config.radialSegments * 0.75));
  const rows = quality === 'hero' ? 7 : quality === 'balanced' ? 5 : 4;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let row = 0; row <= rows; row += 1) {
    const rowT = row / rows;
    const rowOffset = (rowT - 0.5) * 2;
    for (let i = 0; i <= segments; i += 1) {
      const t = (i / segments) * Math.PI * 2;
      const p = createLipPoint(t, rowOffset, identity);
      positions.push(p.x, p.y, p.z);
      normals.push(0, 0, 1);
      uvs.push(i / segments, rowT);
    }
  }

  const stride = segments + 1;
  for (let row = 0; row < rows; row += 1) {
    for (let i = 0; i < segments; i += 1) {
      const a = row * stride + i;
      const b = a + stride;
      const c = b + 1;
      const d = a + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.morphTargetsRelative = true;

  const base = geometry.getAttribute('position') as THREE.BufferAttribute;
  const morphNames = ['jawOpen', 'mouthSmile_L', 'mouthSmile_R', 'mouthFunnel', 'mouthPucker', 'mouthPress_L', 'mouthPress_R'];
  geometry.morphAttributes.position = morphNames.map((name) => {
    const deltas = new Float32Array(base.count * 3);
    const point = new THREE.Vector3();
    for (let i = 0; i < base.count; i += 1) {
      point.fromBufferAttribute(base, i);
      const mouth = gaussian2D(point.x, point.y, 0, -0.43, 0.5, 0.12);
      const left = smoothstep(0.04, -0.3, point.x);
      const right = smoothstep(-0.04, 0.3, point.x);
      const delta = new THREE.Vector3();
      if (name === 'jawOpen') {
        delta.y -= mouth * smoothstep(-0.39, -0.53, point.y) * 0.16;
        delta.z -= mouth * 0.035;
      } else if (name === 'mouthSmile_L') {
        delta.x -= mouth * left * 0.08;
        delta.y += mouth * left * 0.09;
      } else if (name === 'mouthSmile_R') {
        delta.x += mouth * right * 0.08;
        delta.y += mouth * right * 0.09;
      } else if (name === 'mouthFunnel') {
        delta.z += mouth * 0.085;
        delta.x -= point.x * mouth * 0.13;
      } else if (name === 'mouthPucker') {
        delta.z += mouth * 0.12;
        delta.x -= point.x * mouth * 0.2;
      } else if (name === 'mouthPress_L') {
        delta.y -= mouth * left * 0.026;
        delta.z -= mouth * left * 0.02;
      } else if (name === 'mouthPress_R') {
        delta.y -= mouth * right * 0.026;
        delta.z -= mouth * right * 0.02;
      }
      deltas[i * 3] = delta.x;
      deltas[i * 3 + 1] = delta.y;
      deltas[i * 3 + 2] = delta.z;
    }
    const attr = new THREE.BufferAttribute(deltas, 3);
    attr.name = name;
    return attr;
  });

  return geometry;
}

function Tooth({
  index,
  total,
  upper,
  mode,
}: {
  index: number;
  total: number;
  upper: boolean;
  mode: ProceduralHeadMaterialMode;
}) {
  const centered = index - (total - 1) / 2;
  const x = centered * 0.048;
  const scale = 1 - Math.min(Math.abs(centered) * 0.06, 0.22);
  const y = upper ? -0.405 : -0.515;
  const z = 0.665 - Math.abs(centered) * 0.003;
  return (
    <mesh position={[x, y, z]} rotation={[upper ? 0.08 : -0.08, 0, centered * -0.015]} scale={[scale, scale, scale]}>
      <capsuleGeometry args={[0.019, 0.052, 4, 9]} />
      <ProceduralDentalMaterial mode={mode} />
    </mesh>
  );
}
export function ProceduralMouthSystem({
  expressions,
  identity,
  mode,
  quality,
  strength,
}: {
  expressions: ProceduralExpressionValues;
  identity: ProceduralHeadIdentity;
  mode: ProceduralHeadMaterialMode;
  quality: ProceduralHeadQuality;
  strength: number;
}) {
  const lipsRef = useRef<THREE.Mesh>(null);
  const lowerMouthRef = useRef<THREE.Group>(null);
  const lipGeometry = useMemo(() => createProceduralLipGeometry(identity, quality), [identity, quality]);
  const jawOpen = clamp((expressions.jawOpen ?? 0) * strength);

  useEffect(() => () => lipGeometry.dispose(), [lipGeometry]);

  useEffect(() => {
    setMorphInfluences(lipsRef.current, expressions, strength);
    if (lowerMouthRef.current) {
      lowerMouthRef.current.position.y = -jawOpen * 0.105;
      lowerMouthRef.current.position.z = -jawOpen * 0.026;
      lowerMouthRef.current.rotation.x = jawOpen * -0.08;
    }
  }, [expressions, jawOpen, strength]);

  return (
    <group>
      <mesh ref={lipsRef} geometry={lipGeometry}>
        <ProceduralLipMaterial mode={mode} />
      </mesh>

      <mesh position={[0, -0.385, 0.645]} scale={[1, 1, 1]}>
        <boxGeometry args={[0.46, 0.048, 0.062]} />
        <ProceduralGumMaterial mode={mode} />
      </mesh>
      {Array.from({ length: 8 }, (_, index) => (
        <Tooth key={`upper-${index}`} index={index} total={8} upper mode={mode} />
      ))}

      <group ref={lowerMouthRef}>
        <mesh position={[0, -0.535, 0.645]}>
          <boxGeometry args={[0.42, 0.048, 0.058]} />
          <ProceduralGumMaterial mode={mode} />
        </mesh>
        {Array.from({ length: 8 }, (_, index) => (
          <Tooth key={`lower-${index}`} index={index} total={8} upper={false} mode={mode} />
        ))}
        <mesh position={[0, -0.57, 0.61]} scale={[1.15, 0.22, 0.5]} rotation={[-0.12, 0, 0]}>
          <sphereGeometry args={[0.16, 32, 14]} />
          <ProceduralTongueMaterial mode={mode} />
        </mesh>
      </group>
    </group>
  );
}
