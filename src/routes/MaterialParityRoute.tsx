import { AdaptiveDpr, OrbitControls, Stats, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useControls } from 'leva';
import { Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { KTX2Loader } from 'three-stdlib';
import * as THREE_WEBGPU from 'three/webgpu';
import AppNav from '../components/AppNav';
import CanvasErrorBoundary from '../components/CanvasErrorBoundary';
import CubemapEnvironment from '../components/CubemapEnvironment';

const FACECAP_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/facecap.glb';

function SceneGrade({ exposure }: { exposure: number }) {
  const { gl, scene } = useThree();

  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMappingExposure = exposure;
    scene.backgroundIntensity = 1;
    scene.environmentIntensity = 1.05;
  }, [exposure, gl, scene]);

  return null;
}

function SourceBust({ position }: { position: [number, number, number] }) {
  const gl = useThree((state) => state.gl);
  const { scene: sourceScene } = useGLTF(FACECAP_URL, true, true, (loader) => {
    const ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/basis/');
    ktx2Loader.detectSupport(gl);
    loader.setKTX2Loader(ktx2Loader);
  });

  const scene = useMemo(() => {
    const clone = cloneSkeleton(sourceScene);
    clone.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;

      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((material) => material.clone());
      } else if (mesh.material) {
        mesh.material = mesh.material.clone();
      }
    });

    return clone;
  }, [sourceScene]);

  useFrame(({ clock }) => {
    scene.rotation.y = Math.sin(clock.elapsedTime * 0.32) * 0.25;
  });

  return <primitive object={scene} position={position} scale={2.35} />;
}

function SharedLights() {
  return (
    <>
      <ambientLight intensity={0.26} />
      <hemisphereLight args={['#fff1dc', '#283140', 0.9]} />
      <spotLight position={[3.5, 3, 5]} angle={0.22} penumbra={0.35} intensity={10.5} color="#fff4df" castShadow />
      <directionalLight position={[-2.5, 1.5, 4.5]} intensity={1.9} color="#d8ecff" castShadow />
      <pointLight position={[-4, -1.5, 3]} intensity={2.6} color="#dbeafe" />
      <CubemapEnvironment variant="studio" />
    </>
  );
}

function WebGLViewport({ exposure, showStats }: { exposure: number; showStats: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0.05, 7.4], fov: 40 }}
      dpr={[1, 1.5]}
      shadows
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }}
    >
      {showStats && <Stats />}
      <AdaptiveDpr />
      <SceneGrade exposure={exposure} />
      <SharedLights />
      <Suspense fallback={null}>
        <SourceBust position={[0, -0.5, 0]} />
      </Suspense>
      <OrbitControls enablePan={false} minDistance={5.8} maxDistance={9.2} target={[0, 0, 0]} />
    </Canvas>
  );
}

function WebGPUViewport({ exposure, showStats }: { exposure: number; showStats: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0.05, 7.4], fov: 40 }}
      dpr={[1, 1.5]}
      shadows
      gl={async (props) => {
        const renderer = new THREE_WEBGPU.WebGPURenderer({
          canvas: props.canvas as HTMLCanvasElement,
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
        } as ConstructorParameters<typeof THREE_WEBGPU.WebGPURenderer>[0]);
        await renderer.init();
        return renderer;
      }}
    >
      {showStats && <Stats />}
      <AdaptiveDpr />
      <SceneGrade exposure={exposure} />
      <SharedLights />
      <Suspense fallback={null}>
        <SourceBust position={[0, -0.5, 0]} />
      </Suspense>
      <OrbitControls enablePan={false} minDistance={5.8} maxDistance={9.2} target={[0, 0, 0]} />
    </Canvas>
  );
}

export default function MaterialParityRoute() {
  const supportsWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
  const { exposure, showStats } = useControls('Parity Lab', {
    exposure: { value: 1.2, min: 0.5, max: 3, step: 0.01 },
    showStats: false,
  });

  return (
    <div className="relative h-screen w-full overflow-hidden bg-stone-950 text-stone-100">
      <AppNav className="absolute left-4 top-4 z-30" />

      <div className="pointer-events-none absolute left-4 top-20 z-20 max-w-lg rounded-3xl border border-white/10 bg-black/40 p-4 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.3em] text-stone-400">Root Cause Lab</p>
        <h1 className="mt-2 text-2xl font-semibold text-stone-100">Raw Material Parity</h1>
        <p className="mt-2 text-sm leading-6 text-stone-300">
          Left is untouched source material under WebGL. Right is untouched source material under WebGPU. No beauty logic is applied here. If the right side still shows banding, seam, or faceting, the fault is below the beauty layer.
        </p>
      </div>

      <div className="pointer-events-none absolute left-[24%] top-4 z-20 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-xs tracking-[0.18em] text-stone-200 uppercase backdrop-blur">
        WebGL Source
      </div>
      <div className="pointer-events-none absolute right-[22%] top-4 z-20 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-xs tracking-[0.18em] text-stone-200 uppercase backdrop-blur">
        WebGPU Source
      </div>

      <div className="grid h-full w-full grid-cols-2">
        <CanvasErrorBoundary>
          <div className="border-r border-white/10">
            <WebGLViewport exposure={exposure} showStats={showStats} />
          </div>
        </CanvasErrorBoundary>

        <CanvasErrorBoundary>
          {supportsWebGPU ? (
            <WebGPUViewport exposure={exposure} showStats={showStats} />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-md rounded-3xl border border-amber-300/20 bg-amber-100/10 p-6 text-amber-50 backdrop-blur">
                <h2 className="text-xl font-semibold">WebGPU is not available in this browser.</h2>
                <p className="mt-3 text-sm leading-6 text-amber-50/85">
                  Open this route in a Chromium-based browser with WebGPU enabled to compare the untouched source materials directly.
                </p>
              </div>
            </div>
          )}
        </CanvasErrorBoundary>
      </div>
    </div>
  );
}
