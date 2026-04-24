import { useEffect, useState } from 'react';
import {
  createDemoTrackingFrame,
  createMouseTrackingFrame,
  type FaceTrackingAdapterId,
} from '../features/tracking/adapters';
import type { FaceTwinTracking } from '../features/tracking/types';
import { useMediaPipeFaceTwin } from './useMediaPipeFaceTwin';

export type UseFaceTrackingAdapterOptions = {
  adapterId: FaceTrackingAdapterId;
  webcamCaptureEnabled: boolean;
  webcamTrackingEnabled: boolean;
};

export function useFaceTrackingAdapter({
  adapterId,
  webcamCaptureEnabled,
  webcamTrackingEnabled,
}: UseFaceTrackingAdapterOptions): FaceTwinTracking {
  const webcamTracking = useMediaPipeFaceTwin({
    captureEnabled: webcamCaptureEnabled,
    trackingEnabled: adapterId === 'webcam' && webcamTrackingEnabled,
  });
  const [demoTracking, setDemoTracking] = useState(() => createDemoTrackingFrame(0));

  useEffect(() => {
    if (adapterId !== 'demo') return;

    let cancelled = false;
    let rafId = 0;

    const tick = () => {
      if (cancelled) return;
      setDemoTracking(createDemoTrackingFrame(performance.now() * 0.001));
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [adapterId]);

  if (adapterId === 'webcam') {
    return webcamTracking;
  }

  if (adapterId === 'demo') {
    return demoTracking;
  }

  return createMouseTrackingFrame(webcamTracking.videoElement);
}
