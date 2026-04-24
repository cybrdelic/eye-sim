export type TrackingStatus = 'idle' | 'loading' | 'tracking' | 'error';

export interface TrackedEyePose {
  yaw: number;
  pitch: number;
}

export interface FaceLandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export interface FaceTwinTracking {
  status: TrackingStatus;
  error?: string;
  videoElement: HTMLVideoElement | null;
  rawLandmarks: FaceLandmarkPoint[];
  landmarks: FaceLandmarkPoint[];
  refinementConfidence: number;
  proximity: number;
  blendshapes: Record<string, number>;
  headRotation: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  gaze: {
    left: TrackedEyePose;
    right: TrackedEyePose;
  };
}

export interface UseMediaPipeFaceTwinOptions {
  captureEnabled: boolean;
  trackingEnabled: boolean;
}

export const INITIAL_TRACKING: FaceTwinTracking = {
  status: 'idle',
  videoElement: null,
  rawLandmarks: [],
  landmarks: [],
  refinementConfidence: 0,
  proximity: 0.5,
  blendshapes: {},
  headRotation: { pitch: 0, yaw: 0, roll: 0 },
  gaze: {
    left: { yaw: 0, pitch: 0 },
    right: { yaw: 0, pitch: 0 },
  },
};
