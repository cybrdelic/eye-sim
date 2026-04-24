import type { DataTexture } from 'three';

export type ConditioningMeshRoles = {
  headSkin: string[];
  eyes: string[];
  teeth: string[];
  mouthInterior: string[];
  lashesOrBrows: string[];
};

export type ConditioningDetailTextures = {
  size: number;
  baseMap: string;
  dermalMap: string;
  microMap: string;
};

export type ConditioningAtlases = {
  atlas01: number[];
  atlas02: number[];
  atlas03: number[];
  atlas04: number[];
  atlas05: number[];
  atlas06: number[];
};

export type ConditioningFrame = {
  origin: [number, number, number];
  right: [number, number, number];
  up: [number, number, number];
  forward: [number, number, number];
  scaleX: number;
  scaleYTop: number;
  scaleYBottom: number;
  scaleZFront: number;
  scaleZBack: number;
};

export type FacecapConditioningData = {
  headMeshName: string;
  positionCount: number;
  meshRoles?: ConditioningMeshRoles;
  anchors: Record<string, [number, number, number]>;
  frame: ConditioningFrame;
  atlases: ConditioningAtlases;
  detailTextures?: ConditioningDetailTextures | null;
};

export type ConditioningTexturePack = {
  baseMap: DataTexture;
  dermalMap: DataTexture;
  microMap: DataTexture;
} | null;

export type ExpressionControlValues = {
  browRaise: number;
  browCompress: number;
  squint: number;
  smile: number;
  noseSneer: number;
  mouthCompress: number;
};

export type BeautyMaterialMode = 'baseline' | 'beauty' | 'debug';

export const DEBUG_SEGMENTS = [
  'all-regions', 'cheeks', 'nose', 'forehead', 'underEyes', 'lips', 'chin',
  'philtrum', 'skinCoverage', 'sebumZone', 'curvature', 'thickness', 'AO', 'cavity',
  'fhWrinkleL', 'fhWrinkleR', 'glabella', 'crowFeetL', 'crowFeetR',
  'nasolabialL', 'nasolabialR', 'noseWrinkle', 'neckExcl', 'earExcl', 'scalpExcl',
] as const;

export type DebugSegment = typeof DEBUG_SEGMENTS[number];
