export { extractBlendshapes, normalizeMirroredFacialSemantics, stabilizeMouthBlendshapes, TRACKED_BLENDSHAPE_KEYS } from './blendshapes';
export { HIGH_FIDELITY_CAPTURE, STABILITY_TUNING } from './config';
export { createCvRefinementScratch, refineLandmarksWithCV } from './cvRefinement';
export { smooth, smoothStable } from './math';
export type { MouthMetricSample } from './mouthRetarget';
export { isLikelyNeutralMouth, sampleMouthMetrics, solveMouthRetarget, updateMouthNeutralBaseline } from './mouthRetarget';
export { estimateEyePose, estimateFaceProximity, extractHeadRotation } from './pose';
export { smoothBlendshape } from './smoothing';
