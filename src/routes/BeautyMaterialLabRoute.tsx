import { AdaptiveDpr, OrbitControls, Stats } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Leva, useControls } from 'leva';
import React, { Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import * as THREE_WEBGPU from 'three/webgpu';
import AppNav from '../components/AppNav';
import CanvasErrorBoundary from '../components/CanvasErrorBoundary';
import CubemapEnvironment from '../components/CubemapEnvironment';
import { createConditioningTexturePack } from '../features/beauty-lab/conditioning';
import { loadFacecapConditioning } from '../features/beauty-lab/loadConditioning';
import { createBeautyLabMaterialFactory, SEGMENT_COLORS } from '../features/beauty-lab/materials';
import { BeautyBust, SceneGrade, StudioLightRig } from '../features/beauty-lab/scene';
import { DEBUG_SEGMENTS, type BeautyMaterialMode, type DebugSegment, type FacecapConditioningData } from '../features/beauty-lab/types';
import { createSkinUniforms } from '../features/beauty-lab/uniforms';
import { probeWebGPUSession, type WebGPUSessionProbeResult } from '../utils/webgpuSession';

function RouteShell({
  children,
  mode,
  setMode,
  debugSegment,
  setDebugSegment,
}: {
  children: React.ReactNode;
  mode: BeautyMaterialMode;
  setMode: React.Dispatch<React.SetStateAction<BeautyMaterialMode>>;
  debugSegment: DebugSegment;
  setDebugSegment: React.Dispatch<React.SetStateAction<DebugSegment>>;
}) {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#1a1a1e] text-stone-100">
      <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between px-4 py-3">
        <AppNav />
        <div className="flex items-center gap-1 border border-white/10 bg-black/60 p-0.5">
          <button
            onClick={() => setMode('baseline')}
            className={`px-4 py-1.5 text-xs font-medium tracking-wider uppercase transition ${
              mode === 'baseline' ? 'bg-white/12 text-white' : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            Baseline
          </button>
          <button
            onClick={() => setMode('beauty')}
            className={`px-4 py-1.5 text-xs font-medium tracking-wider uppercase transition ${
              mode === 'beauty' ? 'bg-white/12 text-white' : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            Beauty
          </button>
          <button
            onClick={() => setMode('debug')}
            className={`px-4 py-1.5 text-xs font-medium tracking-wider uppercase transition ${
              mode === 'debug' ? 'bg-amber-500/20 text-amber-300' : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            Debug
          </button>
        </div>
      </div>

      {mode === 'debug' && (
        <div className="absolute left-4 top-14 z-30 flex flex-col gap-1 border border-amber-500/20 bg-black/80 p-2 backdrop-blur-sm">
          <span className="mb-1 text-[10px] font-medium tracking-wider uppercase text-amber-400">Segment</span>
          <div className="flex flex-wrap gap-1" style={{ maxWidth: 280 }}>
            {DEBUG_SEGMENTS.map((segment) => (
              <button
                key={segment}
                onClick={() => setDebugSegment(segment)}
                className={`px-2 py-1 text-[10px] font-medium transition ${
                  debugSegment === segment
                    ? 'bg-amber-500/25 text-amber-200 border border-amber-500/40'
                    : 'bg-white/5 text-stone-400 border border-white/8 hover:text-stone-200 hover:bg-white/10'
                }`}
              >
                {segment}
              </button>
            ))}
          </div>
          {debugSegment !== 'all-regions' && (
            <div className="mt-1 flex items-center gap-2 text-[10px] text-stone-400">
              <span
                className="inline-block h-3 w-3"
                style={{
                  backgroundColor: `rgb(${(SEGMENT_COLORS[debugSegment] ?? [1, 1, 1]).map((value) => Math.round(value * 255)).join(',')})`,
                }}
              />
              <span>{debugSegment}</span>
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-lg border border-white/10 bg-black/40 px-6 py-5 text-sm leading-6 text-stone-300 backdrop-blur-sm">
        {message}
      </div>
    </div>
  );
}

function WebGPUFailureState({ result }: { result: WebGPUSessionProbeResult }) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-xl rounded-3xl border border-amber-300/20 bg-amber-100/10 px-6 py-5 text-amber-50 backdrop-blur-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">WebGPU lab unavailable</p>
        <h2 className="mt-3 text-xl font-semibold">This browser GPU session is not healthy enough to start the lab.</h2>
        <p className="mt-3 text-sm leading-6 text-amber-50/85">{result.message}</p>
        <p className="mt-3 text-xs leading-5 text-amber-50/60">
          The main presentation route remains safe to use. This guard prevents the WebGPU lab from creating a renderer in a stale or unsupported page session.
        </p>
      </div>
    </div>
  );
}

export default function BeautyMaterialLabRoute() {
  const { showStats, exposure } = useControls('Lab', {
    showStats: false,
    exposure: { value: 0.5, min: 0.5, max: 3, step: 0.01 },
  });

  const expressionControls = useControls('Expressions', {
    browRaise: { value: 0, min: 0, max: 1, step: 0.01 },
    browCompress: { value: 0, min: 0, max: 1, step: 0.01 },
    squint: { value: 0, min: 0, max: 1, step: 0.01 },
    smile: { value: 0, min: 0, max: 1, step: 0.01 },
    noseSneer: { value: 0, min: 0, max: 1, step: 0.01 },
    mouthCompress: { value: 0, min: 0, max: 1, step: 0.01 },
  });

  const skinControls = useControls('Skin', {
    flushStrength: { value: 0.42, min: 0, max: 1, step: 0.01 },
    scatterStrength: { value: 0.72, min: 0, max: 1.5, step: 0.01 },
    oilStrength: { value: 0.28, min: 0, max: 1, step: 0.01 },
    aoStrength: { value: 0.38, min: 0, max: 1.5, step: 0.01 },
    roughnessOffset: { value: -0.04, min: -0.3, max: 0.3, step: 0.005 },
    wrinkleDepth: { value: 1.15, min: 0, max: 2, step: 0.01 },
    epidermalTint: '#f2ddd0',
    dermalTint: '#9a4a34',
    deepTint: '#5b2a1d',
  });

  const [conditioningData, setConditioningData] = React.useState<FacecapConditioningData | null>(null);
  const [loadingError, setLoadingError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<BeautyMaterialMode>('beauty');
  const [debugSegment, setDebugSegment] = React.useState<DebugSegment>('all-regions');
  const [webgpuProbe, setWebgpuProbe] = React.useState<WebGPUSessionProbeResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    probeWebGPUSession().then((result) => {
      if (!cancelled) setWebgpuProbe(result);
    });

    loadFacecapConditioning()
      .then((data) => {
        if (cancelled) return;
        setConditioningData(data);
        setLoadingError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Unable to load the conditioning payload.';
        setLoadingError(message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const skinUniforms = useMemo(() => createSkinUniforms(), []);
  useEffect(() => {
    const expressions = expressionControls;
    const skin = skinControls;
    skinUniforms.uBrowRaise.value = expressions.browRaise;
    skinUniforms.uBrowCompress.value = expressions.browCompress;
    skinUniforms.uSquint.value = expressions.squint;
    skinUniforms.uSmile.value = expressions.smile;
    skinUniforms.uNoseSneer.value = expressions.noseSneer;
    skinUniforms.uMouthCompress.value = expressions.mouthCompress;
    skinUniforms.uFlushStrength.value = skin.flushStrength;
    skinUniforms.uScatterStrength.value = skin.scatterStrength;
    skinUniforms.uOilStrength.value = skin.oilStrength;
    skinUniforms.uAoStrength.value = skin.aoStrength;
    skinUniforms.uRoughnessOffset.value = skin.roughnessOffset;
    skinUniforms.uWrinkleDepth.value = skin.wrinkleDepth;
    skinUniforms.uEpidermalTint.value.set(skin.epidermalTint);
    skinUniforms.uDermalTint.value.set(skin.dermalTint);
    skinUniforms.uDeepTint.value.set(skin.deepTint);
  }, [expressionControls, skinControls, skinUniforms]);

  const conditioningTexturePack = useMemo(
    () => (conditioningData ? createConditioningTexturePack(conditioningData.detailTextures) : null),
    [conditioningData],
  );
  useEffect(() => {
    return () => {
      conditioningTexturePack?.baseMap.dispose();
      conditioningTexturePack?.dermalMap.dispose();
      conditioningTexturePack?.microMap.dispose();
    };
  }, [conditioningTexturePack]);

  const materialFactory = useMemo(
    () => (conditioningData ? createBeautyLabMaterialFactory(conditioningData, conditioningTexturePack) : null),
    [conditioningData, conditioningTexturePack],
  );

  const bustScale = 1.15;
  const bustY = -1.1;
  const bustZ = -1.0;

  const canvasProps = {
    camera: { position: [0, 0.15, 6.5] as [number, number, number], fov: 30 },
    dpr: [1, 1.5] as [number, number],
    shadows: true,
    gl: (async (defaults: Record<string, unknown>) => {
      const canvas = defaults.canvas as HTMLCanvasElement;
      const result = await probeWebGPUSession({ canvas });
      if (!result.ok) {
        setWebgpuProbe(result);
        throw new Error(result.message);
      }
      const renderer = new THREE_WEBGPU.WebGPURenderer({ canvas, antialias: true, forceWebGL: false });
      await renderer.init();
      return renderer;
    }) as any,
  };

  return (
    <RouteShell mode={mode} setMode={setMode} debugSegment={debugSegment} setDebugSegment={setDebugSegment}>
      <Leva hidden={mode === 'debug'} collapsed={false} />

      {!webgpuProbe ? (
        <LoadingState message="Checking the WebGPU adapter and canvas context before starting the lab." />
      ) : !webgpuProbe.ok ? (
        <WebGPUFailureState result={webgpuProbe} />
      ) : !conditioningData || !materialFactory ? (
        <LoadingState message={loadingError ? `Conditioning payload failed to load: ${loadingError}` : 'Loading the conditioned face payload and detail atlases for the beauty lab.'} />
      ) : (
        <>
          <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-white/8 bg-black/70 px-5 py-2.5 text-[10px] font-medium tracking-wider uppercase text-stone-500 backdrop-blur-sm">
            <div className="flex gap-6">
              <span>
                Pipeline:{' '}
                <span className={mode === 'beauty' ? 'text-amber-400' : mode === 'debug' ? 'text-amber-300' : 'text-stone-300'}>
                  {mode === 'beauty' ? 'Atlas + JSON + TSL' : mode === 'debug' ? `Debug: ${debugSegment}` : 'Baseline'}
                </span>
              </span>
              <span>
                Nodes:{' '}
                <span className={mode === 'beauty' ? 'text-green-400' : mode === 'debug' ? 'text-amber-300' : 'text-stone-500'}>
                  {mode === 'beauty' ? 'Color + Roughness + Emissive' : mode === 'debug' ? 'Segmentation' : 'None'}
                </span>
              </span>
              <span>
                Renderer: <span className="text-stone-300">WebGPU</span>
              </span>
            </div>
            <div className="flex gap-6">
              <span>
                Flush: <span className="text-stone-300">{skinControls.flushStrength.toFixed(2)}</span>
              </span>
              <span>
                SSS: <span className="text-stone-300">{skinControls.scatterStrength.toFixed(2)}</span>
              </span>
              <span>
                Oil: <span className="text-stone-300">{skinControls.oilStrength.toFixed(2)}</span>
              </span>
              <span>
                AO: <span className="text-stone-300">{skinControls.aoStrength.toFixed(2)}</span>
              </span>
            </div>
          </div>

          <CanvasErrorBoundary>
            <Canvas {...canvasProps}>
              {showStats && <Stats />}
              <AdaptiveDpr />
              <SceneGrade exposure={exposure} />
              <StudioLightRig />
              <CubemapEnvironment variant="studio" background={false} />
              <Suspense fallback={null}>
                <BeautyBust
                  mode={mode}
                  skinUniforms={mode === 'beauty' ? skinUniforms : null}
                  expressions={expressionControls}
                  debugSegment={debugSegment}
                  position={[0, bustY, bustZ]}
                  scale={bustScale}
                  conditioningData={conditioningData}
                  materialFactory={materialFactory}
                />
              </Suspense>
              <OrbitControls makeDefault enablePan={false} minDistance={4.5} maxDistance={12} target={[0, -0.15, bustZ]} />
            </Canvas>
          </CanvasErrorBoundary>
        </>
      )}
    </RouteShell>
  );
}
