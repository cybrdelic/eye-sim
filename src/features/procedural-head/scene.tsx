import { OrbitControls, Stats } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import CubemapEnvironment from '../../components/CubemapEnvironment';
import type {
  ProceduralExpressionValues,
  ProceduralHeadIdentity,
  ProceduralHeadMaterialMode,
  ProceduralHeadQuality,
  ProceduralHeadStats,
} from './types';
import { PROCEDURAL_QUALITY_CONFIG } from './types';
import { createProceduralHeadGeometry } from './geometry';
import { createProceduralSkinTexturePack } from './maps';
import { ProceduralBeautyMaterial, ProceduralEyeMaterials } from './materials';
import { ProceduralMouthSystem } from './mouthSystem';

function setMorphInfluences(mesh: THREE.Mesh | null, expressions: ProceduralExpressionValues, strength: number) {
  if (!mesh?.morphTargetDictionary || !mesh.morphTargetInfluences) return;
  for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
    mesh.morphTargetInfluences[index] = Math.min(1, Math.max(0, (expressions[name as keyof ProceduralExpressionValues] ?? 0) * strength));
  }
}

function SceneGrade() {
  const { gl, scene } = useThree();
  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.AgXToneMapping;
    gl.toneMappingExposure = 1.08;
    scene.background = new THREE.Color('#151716');
    scene.environmentIntensity = 1.1;
  }, [gl, scene]);
  return null;
}

function StudioLights() {
  return (
    <>
      <spotLight position={[3.2, 4.1, 4.8]} angle={0.36} penumbra={0.72} intensity={7.2} color="#fff4e7" />
      <spotLight position={[-2.8, 2.3, 3.2]} angle={0.5} penumbra={0.82} intensity={2.7} color="#bfd8ff" />
      <pointLight position={[0, -1.8, 2.2]} intensity={1.2} color="#ffc7a8" />
      <directionalLight position={[0.4, 2.8, -3]} intensity={1.8} color="#ffe2cc" />
      <ambientLight intensity={0.18} />
      <hemisphereLight args={['#edf3ff', '#302721', 0.35]} />
    </>
  );
}
function Eye({
  mode,
  position,
  scale,
}: {
  mode: ProceduralHeadMaterialMode;
  position: [number, number, number];
  scale: number;
}) {
  const materials = ProceduralEyeMaterials({ mode });
  return (
    <group position={position} scale={scale}>
      <mesh scale={[1.06, 0.72, 0.9]}>
        <sphereGeometry args={[0.11, 32, 16]} />
        {materials.sclera}
      </mesh>
      <mesh position={[0, 0, 0.092]} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.043, 36]} />
        {materials.iris}
      </mesh>
      <mesh position={[0, 0, 0.094]}>
        <circleGeometry args={[0.018, 28]} />
        {materials.pupil}
      </mesh>
      <mesh scale={[1.08, 0.74, 0.92]}>
        <sphereGeometry args={[0.113, 32, 16]} />
        {materials.cornea}
      </mesh>
    </group>
  );
}

function ProceduralHeadRig({
  expressions,
  identity,
  materialMode,
  onStats,
  quality,
  strength,
}: {
  expressions: ProceduralExpressionValues;
  identity: ProceduralHeadIdentity;
  materialMode: ProceduralHeadMaterialMode;
  onStats?: (stats: ProceduralHeadStats) => void;
  quality: ProceduralHeadQuality;
  strength: number;
}) {
  const headRef = useRef<THREE.Mesh>(null);
  const bundle = useMemo(() => createProceduralHeadGeometry(identity, quality), [identity, quality]);
  const textures = useMemo(() => createProceduralSkinTexturePack(identity, quality), [identity, quality]);

  useEffect(() => () => {
    bundle.geometry.dispose();
  }, [bundle]);

  useEffect(() => () => {
    textures.dispose();
  }, [textures]);

  useEffect(() => {
    headRef.current?.updateMorphTargets();
    setMorphInfluences(headRef.current, expressions, strength);
  }, [bundle, expressions, strength]);

  useEffect(() => {
    onStats?.({
      vertices: bundle.geometry.getAttribute('position').count,
      triangles: (bundle.geometry.index?.count ?? 0) / 3,
      morphTargets: bundle.geometry.morphAttributes.position?.length ?? 0,
      mapResolution: textures.resolution,
    });
  }, [bundle, onStats, textures.resolution]);

  const eyeScale = 0.88 + identity.eyeScale * 0.28;
  const eyeY = 0.245;
  const eyeZ = 0.545;

  return (
    <group position={[0, -0.04, -0.4]} rotation={[0.02, 0, 0]} scale={1.45}>
      <mesh ref={headRef} geometry={bundle.geometry}>
        <ProceduralBeautyMaterial mode={materialMode} quality={quality} textures={textures} />
      </mesh>
      <Eye mode={materialMode} position={[bundle.anchors.leftEye.x, eyeY, eyeZ]} scale={eyeScale} />
      <Eye mode={materialMode} position={[bundle.anchors.rightEye.x, eyeY, eyeZ]} scale={eyeScale} />
      <ProceduralMouthSystem
        expressions={expressions}
        identity={identity}
        mode={materialMode}
        quality={quality}
        strength={strength}
      />
      <mesh position={[0, -1.18, -0.06]} scale={[0.76, 0.82, 0.58]}>
        <sphereGeometry args={[0.42, 48, 20]} />
        <meshPhysicalMaterial color="#6f5549" roughness={0.62} metalness={0} envMapIntensity={0.28} wireframe={materialMode === 'topology'} />
      </mesh>
    </group>
  );
}

export function ProceduralHeadCanvas({
  expressions,
  identity,
  materialMode,
  onStats,
  quality,
  showStats,
  strength,
}: {
  expressions: ProceduralExpressionValues;
  identity: ProceduralHeadIdentity;
  materialMode: ProceduralHeadMaterialMode;
  onStats?: (stats: ProceduralHeadStats) => void;
  quality: ProceduralHeadQuality;
  showStats: boolean;
  strength: number;
}) {
  const config = PROCEDURAL_QUALITY_CONFIG[quality];

  return (
    <Canvas
      frameloop="demand"
      camera={{ position: [0, 0.02, 4.3], fov: 31 }}
      dpr={config.dpr}
      gl={{ antialias: quality !== 'fast', powerPreference: 'high-performance' }}
    >
      {showStats && <Stats />}
      <SceneGrade />
      <StudioLights />
      <CubemapEnvironment variant="studio" background={false} />
      <ProceduralHeadRig
        expressions={expressions}
        identity={identity}
        materialMode={materialMode}
        onStats={onStats}
        quality={quality}
        strength={strength}
      />
      <OrbitControls makeDefault enablePan={false} minDistance={2.8} maxDistance={7.2} target={[0, -0.02, -0.45]} />
    </Canvas>
  );
}
