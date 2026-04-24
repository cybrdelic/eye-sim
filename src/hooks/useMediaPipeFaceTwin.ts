import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { useEffect, useRef, useState } from 'react';
import { MEDIAPIPE_FACE_LANDMARKER_MODEL_URL, MEDIAPIPE_VISION_WASM_PATH } from '../config/assets';
import {
  createCvRefinementScratch,
  estimateEyePose,
  estimateFaceProximity,
  extractBlendshapes,
  extractHeadRotation,
  HIGH_FIDELITY_CAPTURE,
  isLikelyNeutralMouth,
  normalizeMirroredFacialSemantics,
  refineLandmarksWithCV,
  sampleMouthMetrics,
  smooth,
  smoothBlendshape,
  smoothStable,
  solveMouthRetarget,
  stabilizeMouthBlendshapes,
  STABILITY_TUNING,
  TRACKED_BLENDSHAPE_KEYS,
  updateMouthNeutralBaseline,
  type MouthMetricSample,
} from '../features/tracking/pipeline';
import {
  INITIAL_TRACKING,
  type FaceLandmarkPoint,
  type FaceTwinTracking,
  type UseMediaPipeFaceTwinOptions,
} from '../features/tracking/types';

export type {
  FaceLandmarkPoint,
  FaceTwinTracking,
  TrackedEyePose,
  TrackingStatus,
  UseMediaPipeFaceTwinOptions,
} from '../features/tracking/types';

export function useMediaPipeFaceTwin(options: boolean | UseMediaPipeFaceTwinOptions) {
  const captureEnabled = typeof options === 'boolean' ? options : options.captureEnabled;
  const trackingEnabled = typeof options === 'boolean' ? options : options.trackingEnabled;
  const [tracking, setTracking] = useState<FaceTwinTracking>(INITIAL_TRACKING);
  const smoothedRef = useRef<FaceTwinTracking>(INITIAL_TRACKING);
  const lastDetectAtRef = useRef(0);
  const mouthNeutralRef = useRef<MouthMetricSample | null>(null);
  const refinedLandmarksRef = useRef<FaceLandmarkPoint[] | null>(null);

  useEffect(() => {
    if (!captureEnabled) {
      setTracking(INITIAL_TRACKING);
      smoothedRef.current = INITIAL_TRACKING;
      lastDetectAtRef.current = 0;
      mouthNeutralRef.current = null;
      refinedLandmarksRef.current = null;
      return;
    }

    let cancelled = false;
    let rafId = 0;
    let stream: MediaStream | null = null;
    let faceLandmarker: FaceLandmarker | null = null;
    let lastVideoTime = -1;
    let lastEmit = 0;
    const cvScratch = createCvRefinementScratch();

    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;

    const tick = () => {
      if (cancelled || !faceLandmarker) return;

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== lastVideoTime) {
        const now = performance.now();
        if (now - lastDetectAtRef.current < HIGH_FIDELITY_CAPTURE.detectIntervalMs) {
          rafId = requestAnimationFrame(tick);
          return;
        }

        lastDetectAtRef.current = now;
        lastVideoTime = video.currentTime;

        const result = faceLandmarker.detectForVideo(video, now);
        const categories = result.faceBlendshapes?.[0]?.categories;
        const landmarks = result.faceLandmarks?.[0];
        const matrix = result.facialTransformationMatrixes?.[0]?.data;

        const { refinedLandmarks, confidence: refinementConfidence } = refineLandmarksWithCV(
          video,
          landmarks,
          refinedLandmarksRef.current,
          cvScratch,
        );
        refinedLandmarksRef.current = refinedLandmarks;

        const nextHead = extractHeadRotation(matrix);
        const nextProximity = estimateFaceProximity(refinedLandmarks);
        const baseBlendshapes = normalizeMirroredFacialSemantics(
          extractBlendshapes(categories as Array<{ categoryName: string; score: number }> | undefined),
        );
        const mouthSample = sampleMouthMetrics(refinedLandmarks);
        if (mouthSample) {
          mouthNeutralRef.current = updateMouthNeutralBaseline(
            mouthNeutralRef.current,
            mouthSample,
            isLikelyNeutralMouth(mouthSample, baseBlendshapes),
          );
        }
        const nextGaze = {
          left: estimateEyePose(refinedLandmarks, 468, 33, 133, 159, 145),
          right: estimateEyePose(refinedLandmarks, 473, 263, 362, 386, 374),
        };
        const nextBlendshapes = stabilizeMouthBlendshapes(
          solveMouthRetarget(baseBlendshapes, mouthSample, mouthNeutralRef.current),
        );

        const current = smoothedRef.current;
        const smoothedBlendshapes: Record<string, number> = { ...current.blendshapes };
        for (const name of TRACKED_BLENDSHAPE_KEYS) {
          smoothedBlendshapes[name] = smoothBlendshape(name, smoothedBlendshapes[name] ?? 0, nextBlendshapes[name] ?? 0);
        }

        smoothedRef.current = {
          status: landmarks ? 'tracking' : current.status,
          videoElement: video,
          rawLandmarks: landmarks ? landmarks.map((point) => ({ x: point.x, y: point.y, z: point.z })) : current.rawLandmarks,
          landmarks: refinedLandmarks,
          refinementConfidence: smooth(current.refinementConfidence, refinementConfidence, 0.22),
          blendshapes: smoothedBlendshapes,
          proximity: smoothStable(current.proximity, nextProximity, 0.1, STABILITY_TUNING.proximityDeadzone),
          headRotation: {
            pitch: smoothStable(current.headRotation.pitch, nextHead.pitch, 0.22, STABILITY_TUNING.headDeadzone),
            yaw: smoothStable(current.headRotation.yaw, nextHead.yaw, 0.28, STABILITY_TUNING.headDeadzone),
            roll: smoothStable(current.headRotation.roll, nextHead.roll, 0.22, STABILITY_TUNING.headDeadzone),
          },
          gaze: {
            left: {
              yaw: smoothStable(current.gaze.left.yaw, nextGaze.left.yaw, 0.26, STABILITY_TUNING.gazeDeadzone),
              pitch: smoothStable(current.gaze.left.pitch, nextGaze.left.pitch, 0.24, STABILITY_TUNING.gazeDeadzone),
            },
            right: {
              yaw: smoothStable(current.gaze.right.yaw, nextGaze.right.yaw, 0.26, STABILITY_TUNING.gazeDeadzone),
              pitch: smoothStable(current.gaze.right.pitch, nextGaze.right.pitch, 0.24, STABILITY_TUNING.gazeDeadzone),
            },
          },
        };

        if (now - lastEmit > HIGH_FIDELITY_CAPTURE.emitIntervalMs) {
          lastEmit = now;
          setTracking(smoothedRef.current);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    const init = async () => {
      try {
        setTracking((current) => ({
          ...current,
          status: trackingEnabled ? 'loading' : 'idle',
          error: undefined,
          videoElement: video,
        }));

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: HIGH_FIDELITY_CAPTURE.width },
            height: { ideal: HIGH_FIDELITY_CAPTURE.height },
            frameRate: { ideal: HIGH_FIDELITY_CAPTURE.frameRate, max: HIGH_FIDELITY_CAPTURE.frameRate },
          },
          audio: false,
        });

        if (cancelled) return;

        video.srcObject = stream;
        await video.play();

        if (cancelled) return;

        smoothedRef.current = {
          ...smoothedRef.current,
          status: trackingEnabled ? 'loading' : 'idle',
          error: undefined,
          videoElement: video,
        };

        if (!trackingEnabled) {
          setTracking((current) => ({ ...current, status: 'idle', error: undefined, videoElement: video }));
          return;
        }

        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_VISION_WASM_PATH);
        if (cancelled) return;

        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MEDIAPIPE_FACE_LANDMARKER_MODEL_URL,
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });

        if (cancelled) return;
        rafId = requestAnimationFrame(tick);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to start MediaPipe face tracking.';
        setTracking({ ...INITIAL_TRACKING, status: 'error', error: message, videoElement: video });
      }
    };

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      faceLandmarker?.close();
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      video.pause();
      video.srcObject = null;
    };
  }, [captureEnabled, trackingEnabled]);

  return tracking;
}
