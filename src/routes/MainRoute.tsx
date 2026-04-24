import { AdaptiveDpr, Stats } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import { Leva, useControls } from 'leva';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import AppNav from '../components/AppNav';
import CanvasErrorBoundary from '../components/CanvasErrorBoundary';
import CubemapEnvironment from '../components/CubemapEnvironment';
import Face from '../components/Face';
import TrackingDebugOverlay from '../components/TrackingDebugOverlay';
import UI from '../components/UI';
import VideoFeedEnvironment from '../components/VideoFeedEnvironment';
import type { FaceViewMode } from '../features/face/materials';
import { type FaceTwinTracking, useMediaPipeFaceTwin } from '../hooks/useMediaPipeFaceTwin';

type FocusMode = 'portrait' | 'eyes' | 'mouth';

type PresentationPreset = {
  camera: THREE.Vector3;
  target: THREE.Vector3;
  facePosition: [number, number, number];
  faceScale: number;
};

const DESKTOP_PRESENTATION_PRESETS: Record<FocusMode, PresentationPreset> = {
  portrait: {
    camera: new THREE.Vector3(0, 0.04, 8.7),
    target: new THREE.Vector3(0, -0.03, 0),
    facePosition: [0, -0.35, 0],
    faceScale: 1.62,
  },
  eyes: {
    camera: new THREE.Vector3(0, 0.12, 6.95),
    target: new THREE.Vector3(0, 0.36, 0),
    facePosition: [0, -0.98, 0],
    faceScale: 2.42,
  },
  mouth: {
    camera: new THREE.Vector3(0, -0.18, 6.85),
    target: new THREE.Vector3(0, -0.78, 0),
    facePosition: [0, 0.25, 0],
    faceScale: 2.26,
  },
};

const COMPACT_PRESENTATION_PRESETS: Record<FocusMode, PresentationPreset> = {
  portrait: {
    camera: new THREE.Vector3(0, 0.04, 9.35),
    target: new THREE.Vector3(0, -0.02, 0),
    facePosition: [0, -0.24, 0],
    faceScale: 1.22,
  },
  eyes: {
    camera: new THREE.Vector3(0, 0.1, 7.7),
    target: new THREE.Vector3(0, 0.32, 0),
    facePosition: [0, -0.72, 0],
    faceScale: 1.72,
  },
  mouth: {
    camera: new THREE.Vector3(0, -0.12, 7.45),
    target: new THREE.Vector3(0, -0.62, 0),
    facePosition: [0, 0.08, 0],
    faceScale: 1.66,
  },
};

function getPresentationPreset(focusMode: FocusMode, compactViewport: boolean) {
  return compactViewport ? COMPACT_PRESENTATION_PRESETS[focusMode] : DESKTOP_PRESENTATION_PRESETS[focusMode];
}

function SceneGrade({ screenBrightness, exposure, environmentIntensity }: { screenBrightness: number; exposure: number; environmentIntensity: number }) {
  const { gl, scene } = useThree();

  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMappingExposure = exposure * screenBrightness;
    scene.backgroundIntensity = 1;
    scene.backgroundBlurriness = 0;
    scene.environmentIntensity = environmentIntensity;
  }, [environmentIntensity, exposure, gl, scene, screenBrightness]);

  return null;
}

function useCompactViewport() {
  const [compactViewport, setCompactViewport] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 700px)').matches : false
  ));

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 700px)');
    const update = () => setCompactViewport(mediaQuery.matches);

    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return compactViewport;
}

function PresentationCameraRig({
  faceTracking,
  focusMode,
  compactViewport,
}: {
  faceTracking: FaceTwinTracking | null;
  focusMode: FocusMode;
  compactViewport: boolean;
}) {
  const { camera } = useThree();
  const stableProximityRef = useRef(0.5);

  useEffect(() => {
    camera.position.copy(DESKTOP_PRESENTATION_PRESETS.portrait.camera);
    camera.lookAt(DESKTOP_PRESENTATION_PRESETS.portrait.target);
  }, [camera]);

  useFrame((_, delta) => {
    const preset = getPresentationPreset(focusMode, compactViewport);
    const isTracking = faceTracking?.status === 'tracking';
    const proximity = isTracking ? faceTracking.proximity : 0.5;
    const proximityDelta = proximity - stableProximityRef.current;

    if (Math.abs(proximityDelta) > 0.035) {
      stableProximityRef.current = THREE.MathUtils.lerp(stableProximityRef.current, proximity, 0.14);
    }

    const normalized = THREE.MathUtils.clamp((stableProximityRef.current - 0.5) / 0.38, -1, 1);
    const trackingZ = THREE.MathUtils.clamp(preset.camera.z - normalized * 0.82, preset.camera.z - 0.75, preset.camera.z + 0.42);

    const damping = 1 - Math.exp(-delta * 3.2);
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, preset.camera.x, damping);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, preset.camera.y, damping);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, trackingZ, damping);
    camera.lookAt(preset.target);
  });

  return null;
}

export default function MainRoute() {
  const [color1, setColor1] = useState('#1e3a8a');
  const [color2, setColor2] = useState('#3b82f6');
  const [envMapIntensity, setEnvMapIntensity] = useState(1.5);
  const [ior, setIor] = useState(1.376);
  const [thickness, setThickness] = useState(0.1);
  const [screenBrightness, setScreenBrightness] = useState(1.0);
  const [lightingMode, setLightingMode] = useState<'studio' | 'outdoor'>('studio');
  const [animationMode, setAnimationMode] = useState<'mouse' | 'calm' | 'saccades' | 'scanning'>('mouse');
  const [pupilSize, setPupilSize] = useState(0.15);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [videoEnvEnabled, setVideoEnvEnabled] = useState(false);
  const [debugOverlayEnabled, setDebugOverlayEnabled] = useState(false);
  const [advancedRigOpen, setAdvancedRigOpen] = useState(false);
  const [focusMode, setFocusMode] = useState<FocusMode>('portrait');
  const [effectsEnabled] = useState(false);
  const compactViewport = useCompactViewport();

  const faceTracking = useMediaPipeFaceTwin({
    captureEnabled: trackingEnabled || videoEnvEnabled,
    trackingEnabled,
  });

  const { faceScale, viewMode, showCustomEyes, showStats, renderExposure, cubemapIntensity } = useControls({
    faceScale: { value: 1, min: 0.72, max: 1.35, step: 0.01 },
    viewMode: { options: ['beauty', 'wireframe', 'normals', 'depth', 'basic'] as const },
    showCustomEyes: true,
    showStats: false,
    renderExposure: { value: 1.18, min: 0.4, max: 3, step: 0.01 },
    cubemapIntensity: { value: 1.0, min: 0, max: 3, step: 0.01 },
  }) as {
    faceScale: number;
    viewMode: FaceViewMode;
    showCustomEyes: boolean;
    showStats: boolean;
    renderExposure: number;
    cubemapIntensity: number;
  };

  const presentation = getPresentationPreset(focusMode, compactViewport);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-neutral-950 text-white">
      <AppNav className="absolute left-4 top-4 z-40" />
      <Leva hidden={!advancedRigOpen} collapsed oneLineLabels />

      <CanvasErrorBoundary>
        <Canvas
          camera={{ position: [0, 0.04, 8.05], fov: 40 }}
          dpr={[1, 1.5]}
          gl={{ antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false }}
        >
          {showStats && <Stats />}
          <AdaptiveDpr />
          <SceneGrade screenBrightness={screenBrightness} exposure={renderExposure} environmentIntensity={cubemapIntensity} />
          <PresentationCameraRig faceTracking={trackingEnabled ? faceTracking : null} focusMode={focusMode} compactViewport={compactViewport} />

          {lightingMode === 'studio' ? (
            <>
              <ambientLight intensity={0.3 * screenBrightness} />
              <hemisphereLight args={['#fff2df', '#2d3644', 0.85 * screenBrightness]} />
              <spotLight position={[3.5, 3, 5]} angle={0.24} penumbra={0.45} intensity={10.5 * screenBrightness} color="#fff4df" />
              <directionalLight position={[-2.5, 1.5, 4.5]} intensity={1.8 * screenBrightness} color="#d8ecff" />
              <pointLight position={[-4, -1.5, 3]} intensity={2.4 * screenBrightness} color="#dbeafe" />
              {videoEnvEnabled ? <VideoFeedEnvironment video={faceTracking.videoElement} /> : <CubemapEnvironment variant="studio" />}
            </>
          ) : (
            <>
              <ambientLight intensity={0.22 * screenBrightness} />
              <hemisphereLight args={['#fff3d9', '#394558', 0.95 * screenBrightness]} />
              <spotLight position={[4.5, 2.5, 6]} angle={0.22} penumbra={0.25} intensity={12 * screenBrightness} decay={2} color="#fff4dd" />
              <directionalLight position={[-3.5, 2.0, 5.0]} intensity={2.2 * screenBrightness} color="#c7e7ff" />
              <pointLight position={[-6, -2, 1]} intensity={5.6 * screenBrightness} distance={20} decay={2} color="#c7e7ff" />
              {videoEnvEnabled ? <VideoFeedEnvironment video={faceTracking.videoElement} /> : <CubemapEnvironment variant="outdoor" />}
            </>
          )}

          <group position={presentation.facePosition} scale={presentation.faceScale * faceScale}>
            <Face
              viewMode={viewMode}
              showCustomEyes={showCustomEyes}
              faceTracking={trackingEnabled ? faceTracking : null}
              eyeProps={{ color1, color2, envMapIntensity, ior, thickness, animationMode, pupilSize }}
            />
          </group>

          {effectsEnabled && (
            <EffectComposer>
              <Bloom luminanceThreshold={1.05} mipmapBlur intensity={0.45} />
              <Noise opacity={0.01} />
              <Vignette eskil={false} offset={0.08} darkness={0.9} />
            </EffectComposer>
          )}
        </Canvas>
      </CanvasErrorBoundary>

      <UI
        color1={color1}
        setColor1={setColor1}
        color2={color2}
        setColor2={setColor2}
        envMapIntensity={envMapIntensity}
        setEnvMapIntensity={setEnvMapIntensity}
        ior={ior}
        setIor={setIor}
        thickness={thickness}
        setThickness={setThickness}
        screenBrightness={screenBrightness}
        setScreenBrightness={setScreenBrightness}
        lightingMode={lightingMode}
        setLightingMode={setLightingMode}
        trackingEnabled={trackingEnabled}
        setTrackingEnabled={setTrackingEnabled}
        trackingStatus={faceTracking.status}
        debugOverlayEnabled={debugOverlayEnabled}
        setDebugOverlayEnabled={setDebugOverlayEnabled}
        videoEnvEnabled={videoEnvEnabled}
        setVideoEnvEnabled={setVideoEnvEnabled}
        animationMode={animationMode}
        setAnimationMode={setAnimationMode}
        pupilSize={pupilSize}
        setPupilSize={setPupilSize}
        focusMode={focusMode}
        setFocusMode={setFocusMode}
        advancedRigOpen={advancedRigOpen}
        setAdvancedRigOpen={setAdvancedRigOpen}
      />

      {debugOverlayEnabled && (
        <TrackingDebugOverlay
          video={faceTracking.videoElement}
          rawLandmarks={faceTracking.rawLandmarks}
          landmarks={faceTracking.landmarks}
          proximity={faceTracking.proximity}
          refinementConfidence={faceTracking.refinementConfidence}
          status={faceTracking.status}
        />
      )}
    </div>
  );
}
