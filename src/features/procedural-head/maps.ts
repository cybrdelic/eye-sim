import * as THREE from 'three';
import type { ProceduralHeadIdentity, ProceduralHeadQuality } from './types';
import { PROCEDURAL_QUALITY_CONFIG } from './types';
import { clamp, fbm2D, gaussian2D, hashString, lerp, smoothstep, valueNoise2D } from './random';

export type ProceduralSkinTexturePack = {
  albedoMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  regionMap: THREE.CanvasTexture;
  resolution: number;
  dispose: () => void;
};

function makeCanvas(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function makeTexture(canvas: HTMLCanvasElement, colorSpace: THREE.ColorSpace) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function writePixel(data: Uint8ClampedArray, index: number, r: number, g: number, b: number, a = 255) {
  data[index] = clamp(r, 0, 255);
  data[index + 1] = clamp(g, 0, 255);
  data[index + 2] = clamp(b, 0, 255);
  data[index + 3] = clamp(a, 0, 255);
}

function skinRegionMasks(u: number, v: number) {
  const x = u * 2 - 1;
  const y = v * 2 - 1;
  const center = 1 - Math.min(Math.abs(x), 1);
  const forehead = gaussian2D(x, y, 0, -0.48, 0.74, 0.28) * center;
  const nose = gaussian2D(x, y, 0, -0.08, 0.18, 0.34) * center;
  const cheekL = gaussian2D(x, y, -0.42, 0.04, 0.32, 0.26);
  const cheekR = gaussian2D(x, y, 0.42, 0.04, 0.32, 0.26);
  const underEye = gaussian2D(x, y, -0.34, -0.25, 0.24, 0.08) + gaussian2D(x, y, 0.34, -0.25, 0.24, 0.08);
  const mouth = gaussian2D(x, y, 0, 0.42, 0.44, 0.13) * center;
  const chin = gaussian2D(x, y, 0, 0.72, 0.42, 0.2) * center;
  const sebum = clamp(nose * 0.9 + forehead * 0.45 + chin * 0.22, 0, 1);

  return {
    forehead,
    nose,
    cheeks: clamp(cheekL + cheekR, 0, 1),
    underEye: clamp(underEye, 0, 1),
    mouth,
    chin,
    sebum,
  };
}

export function createProceduralSkinTexturePack(
  identity: ProceduralHeadIdentity,
  quality: ProceduralHeadQuality,
): ProceduralSkinTexturePack {
  const resolution = PROCEDURAL_QUALITY_CONFIG[quality].mapResolution;
  const seed = hashString(identity.seed);
  const albedoCanvas = makeCanvas(resolution);
  const roughnessCanvas = makeCanvas(resolution);
  const normalCanvas = makeCanvas(resolution);
  const regionCanvas = makeCanvas(resolution);

  const albedoCtx = albedoCanvas.getContext('2d');
  const roughnessCtx = roughnessCanvas.getContext('2d');
  const normalCtx = normalCanvas.getContext('2d');
  const regionCtx = regionCanvas.getContext('2d');

  if (!albedoCtx || !roughnessCtx || !normalCtx || !regionCtx) {
    throw new Error('Unable to create procedural skin map contexts.');
  }

  const albedoImage = albedoCtx.createImageData(resolution, resolution);
  const roughnessImage = roughnessCtx.createImageData(resolution, resolution);
  const regionImage = regionCtx.createImageData(resolution, resolution);
  const height = new Float32Array(resolution * resolution);

  const melanin = clamp(identity.melanin);
  const hemoglobin = clamp(identity.hemoglobin);
  const oiliness = clamp(identity.oiliness);
  const age = clamp(identity.age);
  const poreScale = lerp(0.75, 1.45, identity.poreScale);

  for (let y = 0; y < resolution; y += 1) {
    const v = y / (resolution - 1);
    for (let x = 0; x < resolution; x += 1) {
      const u = x / (resolution - 1);
      const index = (y * resolution + x) * 4;
      const fieldIndex = y * resolution + x;
      const masks = skinRegionMasks(u, v);
      const faceX = u * 2 - 1;
      const faceY = v * 2 - 1;

      const macro = fbm2D(u * 4.2, v * 5.6, seed, 4) - 0.5;
      const mottle = fbm2D(u * 16, v * 21, seed + 72, 3) - 0.5;
      const pore = valueNoise2D(u * 170 * poreScale, v * 210 * poreScale, seed + 173);
      const poreRim = smoothstep(0.48, 0.78, pore) - smoothstep(0.78, 0.94, pore);
      const wrinkle = fbm2D(u * 46, v * 20, seed + 991, 3) - 0.5;
      const foreheadLines = masks.forehead * Math.pow(Math.sin((faceY + 0.5) * 52 + macro * 3) * 0.5 + 0.5, 12) * age;
      const crow = masks.underEye * Math.pow(Math.sin((Math.abs(faceX) - 0.24) * 62 + faceY * 24) * 0.5 + 0.5, 10) * age;

      const baseR = lerp(224, 118, melanin);
      const baseG = lerp(174, 88, melanin);
      const baseB = lerp(142, 62, melanin);
      const redness = hemoglobin * (masks.cheeks * 0.42 + masks.nose * 0.24 + masks.underEye * 0.12 + masks.mouth * 0.18);
      const yellow = melanin * 18 - hemoglobin * 5;
      const coolUnderEye = masks.underEye * lerp(5, 18, age);
      const freckleNoise = valueNoise2D(u * 72, v * 87, seed + 337);
      const freckle = smoothstep(0.79, 0.93, freckleNoise) * melanin * (1 - masks.mouth) * 0.72;

      const r = baseR + redness * 42 + macro * 16 + mottle * 10 - freckle * 58;
      const g = baseG - redness * 10 + yellow + macro * 11 + mottle * 7 - freckle * 42 - coolUnderEye;
      const b = baseB - redness * 18 + macro * 8 + mottle * 6 - freckle * 26 + coolUnderEye;
      writePixel(albedoImage.data, index, r, g, b);

      const roughness = clamp(
        0.58
        - masks.sebum * lerp(0.12, 0.24, oiliness)
        + masks.cheeks * 0.035
        + age * 0.05
        + poreRim * 0.06
        + mottle * 0.03,
        0.24,
        0.88,
      );
      writePixel(roughnessImage.data, index, roughness * 255, roughness * 255, roughness * 255);

      height[fieldIndex] =
        macro * 0.018
        + poreRim * 0.025
        - smoothstep(0.12, 0.38, pore) * 0.018 * identity.poreScale
        - foreheadLines * 0.04
        - crow * 0.032
        + wrinkle * 0.01 * age;

      const regionR = clamp(masks.cheeks + masks.mouth * 0.5, 0, 1);
      const regionG = clamp(masks.nose + masks.sebum * 0.5, 0, 1);
      const regionB = clamp(masks.forehead + masks.underEye * 0.8 + masks.chin * 0.3, 0, 1);
      writePixel(regionImage.data, index, regionR * 255, regionG * 255, regionB * 255);
    }
  }

  const normalImage = normalCtx.createImageData(resolution, resolution);
  const normalStrength = quality === 'hero' ? 7.5 : quality === 'balanced' ? 5.25 : 3.4;
  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      const left = height[y * resolution + Math.max(0, x - 1)];
      const right = height[y * resolution + Math.min(resolution - 1, x + 1)];
      const up = height[Math.max(0, y - 1) * resolution + x];
      const down = height[Math.min(resolution - 1, y + 1) * resolution + x];
      const dx = (right - left) * normalStrength;
      const dy = (down - up) * normalStrength;
      const nz = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const nx = -dx * nz;
      const ny = -dy * nz;
      const index = (y * resolution + x) * 4;
      writePixel(normalImage.data, index, (nx * 0.5 + 0.5) * 255, (ny * 0.5 + 0.5) * 255, (nz * 0.5 + 0.5) * 255);
    }
  }

  albedoCtx.putImageData(albedoImage, 0, 0);
  roughnessCtx.putImageData(roughnessImage, 0, 0);
  normalCtx.putImageData(normalImage, 0, 0);
  regionCtx.putImageData(regionImage, 0, 0);

  const pack: ProceduralSkinTexturePack = {
    albedoMap: makeTexture(albedoCanvas, THREE.SRGBColorSpace),
    roughnessMap: makeTexture(roughnessCanvas, THREE.NoColorSpace),
    normalMap: makeTexture(normalCanvas, THREE.NoColorSpace),
    regionMap: makeTexture(regionCanvas, THREE.SRGBColorSpace),
    resolution,
    dispose: () => {
      pack.albedoMap.dispose();
      pack.roughnessMap.dispose();
      pack.normalMap.dispose();
      pack.regionMap.dispose();
    },
  };

  return pack;
}
