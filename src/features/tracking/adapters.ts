import { INITIAL_TRACKING, type FaceTwinTracking } from './types';

export type FaceTrackingAdapterId = 'mouse' | 'demo' | 'webcam';

export type FaceTrackingAdapterDescriptor = {
  id: FaceTrackingAdapterId;
  label: string;
  description: string;
  requiresVideoCapture: boolean;
  producesTrackedPose: boolean;
};

export const FACE_TRACKING_ADAPTERS: Record<FaceTrackingAdapterId, FaceTrackingAdapterDescriptor> = {
  mouse: {
    id: 'mouse',
    label: 'Mouse',
    description: 'Manual presentation mode; eye motion is driven by the local pointer and animation settings.',
    requiresVideoCapture: false,
    producesTrackedPose: false,
  },
  demo: {
    id: 'demo',
    label: 'Demo',
    description: 'Deterministic synthetic head, gaze, and expression motion for demos without a camera.',
    requiresVideoCapture: false,
    producesTrackedPose: true,
  },
  webcam: {
    id: 'webcam',
    label: 'Webcam',
    description: 'MediaPipe webcam driver for live face pose, gaze, and blendshape data.',
    requiresVideoCapture: true,
    producesTrackedPose: true,
  },
};

export function createMouseTrackingFrame(videoElement: HTMLVideoElement | null = null): FaceTwinTracking {
  return {
    ...INITIAL_TRACKING,
    status: 'idle',
    videoElement,
  };
}

export function createDemoTrackingFrame(timeSeconds: number): FaceTwinTracking {
  const blinkPulse = Math.max(0, Math.sin(timeSeconds * 2.8) - 0.92) * 8.5;
  const smile = 0.08 + Math.sin(timeSeconds * 0.6) * 0.025;
  const jawOpen = 0.035 + Math.max(0, Math.sin(timeSeconds * 1.1)) * 0.035;
  const gazeYaw = Math.sin(timeSeconds * 0.85) * 0.22;
  const gazePitch = Math.sin(timeSeconds * 0.42) * 0.08;

  return {
    ...INITIAL_TRACKING,
    status: 'tracking',
    refinementConfidence: 1,
    proximity: 0.52 + Math.sin(timeSeconds * 0.28) * 0.025,
    blendshapes: {
      eyeBlink_L: blinkPulse,
      eyeBlink_R: blinkPulse,
      eyeSquint_L: 0.04 + Math.max(0, smile) * 0.18,
      eyeSquint_R: 0.04 + Math.max(0, smile) * 0.18,
      jawOpen,
      mouthSmile_L: smile,
      mouthSmile_R: smile * 0.95,
      mouthDimple_L: smile * 0.38,
      mouthDimple_R: smile * 0.36,
      mouthClose: 0.04,
    },
    headRotation: {
      pitch: Math.sin(timeSeconds * 0.42) * 0.08,
      yaw: Math.sin(timeSeconds * 0.36) * 0.18,
      roll: Math.sin(timeSeconds * 0.31) * 0.04,
    },
    gaze: {
      left: { yaw: gazeYaw, pitch: gazePitch },
      right: { yaw: gazeYaw, pitch: gazePitch },
    },
  };
}
