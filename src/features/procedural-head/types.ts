export type ProceduralHeadQuality = 'fast' | 'balanced' | 'hero';

export type ProceduralHeadMaterialMode = 'beauty' | 'maps' | 'topology';

export type ProceduralExpressionPreset =
  | 'neutral'
  | 'softSmile'
  | 'jawOpen'
  | 'pucker'
  | 'squint'
  | 'browRaise'
  | 'stressTest';

export type ProceduralExpressionName =
  | 'browInnerUp'
  | 'browOuterUp_L'
  | 'browOuterUp_R'
  | 'eyeBlink_L'
  | 'eyeBlink_R'
  | 'eyeSquint_L'
  | 'eyeSquint_R'
  | 'cheekSquint_L'
  | 'cheekSquint_R'
  | 'jawOpen'
  | 'mouthSmile_L'
  | 'mouthSmile_R'
  | 'mouthFunnel'
  | 'mouthPucker'
  | 'mouthPress_L'
  | 'mouthPress_R'
  | 'noseSneer_L'
  | 'noseSneer_R';

export type ProceduralExpressionValues = Partial<Record<ProceduralExpressionName, number>>;

export type ProceduralHeadIdentity = {
  seed: string;
  faceWidth: number;
  skullHeight: number;
  jawWidth: number;
  cheekbone: number;
  browRidge: number;
  noseProjection: number;
  noseWidth: number;
  lipFullness: number;
  eyeSpacing: number;
  eyeScale: number;
  melanin: number;
  hemoglobin: number;
  poreScale: number;
  oiliness: number;
  age: number;
};

export type ProceduralHeadStats = {
  vertices: number;
  triangles: number;
  morphTargets: number;
  mapResolution: number;
};

export const PROCEDURAL_EXPRESSION_NAMES: ProceduralExpressionName[] = [
  'browInnerUp',
  'browOuterUp_L',
  'browOuterUp_R',
  'eyeBlink_L',
  'eyeBlink_R',
  'eyeSquint_L',
  'eyeSquint_R',
  'cheekSquint_L',
  'cheekSquint_R',
  'jawOpen',
  'mouthSmile_L',
  'mouthSmile_R',
  'mouthFunnel',
  'mouthPucker',
  'mouthPress_L',
  'mouthPress_R',
  'noseSneer_L',
  'noseSneer_R',
];

export const DEFAULT_PROCEDURAL_IDENTITY: ProceduralHeadIdentity = {
  seed: 'studio-01',
  faceWidth: 0.48,
  skullHeight: 0.56,
  jawWidth: 0.38,
  cheekbone: 0.58,
  browRidge: 0.44,
  noseProjection: 0.52,
  noseWidth: 0.42,
  lipFullness: 0.54,
  eyeSpacing: 0.5,
  eyeScale: 0.48,
  melanin: 0.42,
  hemoglobin: 0.46,
  poreScale: 0.62,
  oiliness: 0.42,
  age: 0.34,
};

export const PROCEDURAL_QUALITY_CONFIG: Record<ProceduralHeadQuality, {
  label: string;
  radialSegments: number;
  verticalSegments: number;
  mapResolution: number;
  dpr: [number, number];
}> = {
  fast: {
    label: 'Fast',
    radialSegments: 56,
    verticalSegments: 48,
    mapResolution: 384,
    dpr: [1, 1],
  },
  balanced: {
    label: 'Balanced',
    radialSegments: 80,
    verticalSegments: 64,
    mapResolution: 640,
    dpr: [1, 1.25],
  },
  hero: {
    label: 'Hero',
    radialSegments: 112,
    verticalSegments: 88,
    mapResolution: 1024,
    dpr: [1, 1.5],
  },
};
export const PROCEDURAL_EXPRESSION_PRESETS: Record<ProceduralExpressionPreset, {
  label: string;
  description: string;
  values: ProceduralExpressionValues;
}> = {
  neutral: {
    label: 'Neutral',
    description: 'Closed-mouth neutral pose for material and topology inspection.',
    values: {},
  },
  softSmile: {
    label: 'Soft Smile',
    description: 'Constrained smile that tests cheek, lip, and dental occlusion.',
    values: {
      mouthSmile_L: 0.62,
      mouthSmile_R: 0.62,
      cheekSquint_L: 0.28,
      cheekSquint_R: 0.28,
    },
  },
  jawOpen: {
    label: 'Jaw Open',
    description: 'Oral-system stress pose for teeth, gums, tongue, and mouth shadow.',
    values: {
      jawOpen: 0.78,
      mouthFunnel: 0.12,
    },
  },
  pucker: {
    label: 'Pucker',
    description: 'Forward lip motion with narrowed corners.',
    values: {
      mouthPucker: 0.72,
      mouthFunnel: 0.46,
      mouthPress_L: 0.2,
      mouthPress_R: 0.2,
    },
  },
  squint: {
    label: 'Squint',
    description: 'Eye and cheek compression without invoking webcam tracking.',
    values: {
      eyeSquint_L: 0.62,
      eyeSquint_R: 0.62,
      cheekSquint_L: 0.46,
      cheekSquint_R: 0.46,
    },
  },
  browRaise: {
    label: 'Brow Raise',
    description: 'Upper-face expression test for procedural wrinkle masks.',
    values: {
      browInnerUp: 0.7,
      browOuterUp_L: 0.48,
      browOuterUp_R: 0.48,
    },
  },
  stressTest: {
    label: 'Stress Test',
    description: 'Combined expression to reveal bad topology or oral intersections.',
    values: {
      browInnerUp: 0.34,
      eyeSquint_L: 0.36,
      eyeSquint_R: 0.36,
      jawOpen: 0.48,
      mouthSmile_L: 0.52,
      mouthSmile_R: 0.52,
      noseSneer_L: 0.28,
      noseSneer_R: 0.28,
    },
  },
};
