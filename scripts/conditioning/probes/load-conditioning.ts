import { readFileSync } from 'node:fs';
import path from 'node:path';

export type FacecapConditioning = {
  headMeshName: string;
  positionCount: number;
  frame: {
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
  anchors: Record<string, [number, number, number]>;
  atlases: {
    atlas01: number[];
    atlas02: number[];
    atlas03: number[];
    atlas04: number[];
    atlas05: number[];
    atlas06: number[];
  };
};

export function loadConditioning(): FacecapConditioning {
  const payloadPath = path.resolve(process.cwd(), 'data/conditioning/facecapConditioning.json');
  return JSON.parse(readFileSync(payloadPath, 'utf-8')) as FacecapConditioning;
}
