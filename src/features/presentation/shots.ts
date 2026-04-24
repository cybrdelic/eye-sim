export type PresentationShotId = 'portrait' | 'eyes' | 'mouth' | 'trackingTwin' | 'inspect';

export type LightingMode = 'studio' | 'outdoor';

export type AnimationMode = 'mouse' | 'calm' | 'saccades' | 'scanning';

export type Vec3Tuple = [number, number, number];

export type PresentationPreset = {
  camera: Vec3Tuple;
  target: Vec3Tuple;
  facePosition: Vec3Tuple;
  faceScale: number;
};

export type ShotControlPanel = 'capture' | 'iris' | 'lighting' | 'animation' | 'optics' | 'rig';

export type PresentationShot = {
  id: PresentationShotId;
  label: string;
  shortLabel: string;
  description: string;
  desktop: PresentationPreset;
  compact: PresentationPreset;
  defaults: {
    lightingMode: LightingMode;
    animationMode: AnimationMode;
    trackingEnabled: boolean;
    videoEnvEnabled: boolean;
    debugOverlayEnabled: boolean;
    advancedRigOpen: boolean;
  };
  allowedPanels: ShotControlPanel[];
  mouthSafety: {
    jawOpenMax: number;
    smileMax: number;
    description: string;
  };
};

const DEFAULT_MOUTH_SAFETY: PresentationShot['mouthSafety'] = {
  jawOpenMax: 0.36,
  smileMax: 0.44,
  description: 'Keep the current Facecap mouth interior out of extreme expression ranges.',
};

export const PRESENTATION_SHOTS: Record<PresentationShotId, PresentationShot> = {
  portrait: {
    id: 'portrait',
    label: 'Portrait',
    shortLabel: 'Face',
    description: 'Balanced hero framing for the full digital face rig.',
    desktop: {
      camera: [0, 0.04, 8.7],
      target: [0, -0.03, 0],
      facePosition: [0, -0.35, 0],
      faceScale: 1.62,
    },
    compact: {
      camera: [0, 0.04, 9.35],
      target: [0, -0.02, 0],
      facePosition: [0, -0.24, 0],
      faceScale: 1.22,
    },
    defaults: {
      lightingMode: 'studio',
      animationMode: 'mouse',
      trackingEnabled: false,
      videoEnvEnabled: false,
      debugOverlayEnabled: false,
      advancedRigOpen: false,
    },
    allowedPanels: ['capture', 'iris', 'lighting', 'animation', 'optics', 'rig'],
    mouthSafety: DEFAULT_MOUTH_SAFETY,
  },
  eyes: {
    id: 'eyes',
    label: 'Eyes',
    shortLabel: 'Eyes',
    description: 'Close framing that keeps the iris and gaze system as the hero.',
    desktop: {
      camera: [0, 0.12, 6.95],
      target: [0, 0.36, 0],
      facePosition: [0, -0.98, 0],
      faceScale: 2.42,
    },
    compact: {
      camera: [0, 0.1, 7.7],
      target: [0, 0.32, 0],
      facePosition: [0, -0.72, 0],
      faceScale: 1.72,
    },
    defaults: {
      lightingMode: 'studio',
      animationMode: 'saccades',
      trackingEnabled: false,
      videoEnvEnabled: false,
      debugOverlayEnabled: false,
      advancedRigOpen: false,
    },
    allowedPanels: ['iris', 'lighting', 'animation', 'optics', 'rig'],
    mouthSafety: {
      jawOpenMax: 0.18,
      smileMax: 0.28,
      description: 'Favor eye motion and avoid mouth expressions while the crop hides the lower face.',
    },
  },
  mouth: {
    id: 'mouth',
    label: 'Mouth',
    shortLabel: 'Mouth',
    description: 'A constrained lower-face shot for checking lips without exposing bad dental geometry.',
    desktop: {
      camera: [0, -0.18, 6.85],
      target: [0, -0.78, 0],
      facePosition: [0, 0.25, 0],
      faceScale: 2.26,
    },
    compact: {
      camera: [0, -0.12, 7.45],
      target: [0, -0.62, 0],
      facePosition: [0, 0.08, 0],
      faceScale: 1.66,
    },
    defaults: {
      lightingMode: 'studio',
      animationMode: 'calm',
      trackingEnabled: false,
      videoEnvEnabled: false,
      debugOverlayEnabled: false,
      advancedRigOpen: false,
    },
    allowedPanels: ['lighting', 'animation', 'optics', 'rig'],
    mouthSafety: {
      jawOpenMax: 0.22,
      smileMax: 0.24,
      description: 'Hold the lower face in a calm performance range until the asset mouth is replaced.',
    },
  },
  trackingTwin: {
    id: 'trackingTwin',
    label: 'Tracking Twin',
    shortLabel: 'Twin',
    description: 'Webcam-driven presentation with a safer portrait crop and live status.',
    desktop: {
      camera: [0, 0.02, 8.25],
      target: [0, -0.04, 0],
      facePosition: [0, -0.32, 0],
      faceScale: 1.72,
    },
    compact: {
      camera: [0, 0.04, 9.05],
      target: [0, -0.02, 0],
      facePosition: [0, -0.22, 0],
      faceScale: 1.3,
    },
    defaults: {
      lightingMode: 'studio',
      animationMode: 'calm',
      trackingEnabled: true,
      videoEnvEnabled: false,
      debugOverlayEnabled: false,
      advancedRigOpen: false,
    },
    allowedPanels: ['capture', 'iris', 'lighting', 'optics', 'rig'],
    mouthSafety: {
      jawOpenMax: 0.2,
      smileMax: 0.22,
      description: 'Prefer stable head and eye motion over full mouth retargeting in live mode.',
    },
  },
  inspect: {
    id: 'inspect',
    label: 'Material Inspect',
    shortLabel: 'Inspect',
    description: 'A neutral inspection shot that opens rig controls without entering the lab surface.',
    desktop: {
      camera: [0, 0.02, 7.45],
      target: [0, 0.02, 0],
      facePosition: [0, -0.5, 0],
      faceScale: 1.9,
    },
    compact: {
      camera: [0, 0.02, 8.35],
      target: [0, 0.02, 0],
      facePosition: [0, -0.36, 0],
      faceScale: 1.42,
    },
    defaults: {
      lightingMode: 'outdoor',
      animationMode: 'scanning',
      trackingEnabled: false,
      videoEnvEnabled: false,
      debugOverlayEnabled: false,
      advancedRigOpen: true,
    },
    allowedPanels: ['capture', 'iris', 'lighting', 'animation', 'optics', 'rig'],
    mouthSafety: DEFAULT_MOUTH_SAFETY,
  },
};

export const PRESENTATION_SHOT_ORDER: PresentationShotId[] = ['portrait', 'eyes', 'mouth', 'trackingTwin', 'inspect'];

export function getPresentationShotPreset(shotId: PresentationShotId, compactViewport: boolean) {
  const shot = PRESENTATION_SHOTS[shotId];
  return compactViewport ? shot.compact : shot.desktop;
}
