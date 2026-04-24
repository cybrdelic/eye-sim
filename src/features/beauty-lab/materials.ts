// @ts-nocheck
import * as THREE from 'three';
import {
  attribute, bumpMap, float, Fn, max, mix, normalize, pow, smoothstep, texture, uv, vec3,
  positionLocal, normalLocal, normalWorld, cameraPosition, positionWorld,
  mx_fractal_noise_float, mx_worley_noise_float,
} from 'three/tsl';
import * as THREE_WEBGPU from 'three/webgpu';
import type { ConditioningTexturePack, DebugSegment, FacecapConditioningData } from './types';
import type { SkinUniforms } from './uniforms';

export const SEGMENT_COLORS: Record<string, [number, number, number]> = {
  cheeks: [1.0, 0.3, 0.3],
  nose: [0.2, 1.0, 0.3],
  forehead: [0.3, 0.4, 1.0],
  underEyes: [1.0, 0.0, 1.0],
  lips: [1.0, 0.1, 0.5],
  chin: [1.0, 0.7, 0.0],
  philtrum: [0.0, 1.0, 1.0],
  skinCoverage: [0.8, 0.8, 0.8],
  sebumZone: [0.9, 0.9, 0.2],
  curvature: [0.5, 1.0, 0.5],
  thickness: [1.0, 0.5, 0.3],
  AO: [0.6, 0.6, 0.6],
  cavity: [0.4, 0.4, 0.7],
  fhWrinkleL: [1.0, 0.2, 0.2],
  fhWrinkleR: [0.2, 0.2, 1.0],
  glabella: [0.8, 0.0, 0.8],
  crowFeetL: [1.0, 0.5, 0.0],
  crowFeetR: [0.0, 0.5, 1.0],
  nasolabialL: [0.7, 1.0, 0.0],
  nasolabialR: [0.0, 1.0, 0.7],
  noseWrinkle: [1.0, 1.0, 0.5],
  neckExcl: [0.5, 0.2, 0.0],
  earExcl: [0.3, 0.0, 0.3],
  scalpExcl: [0.0, 0.3, 0.2],
};

export function createBeautyLabMaterialFactory(
  conditioningData: FacecapConditioningData,
  conditioningTexturePack: ConditioningTexturePack,
) {
  const atlas01 = attribute('conditionAtlas01', 'vec4') as any;
  const atlas02 = attribute('conditionAtlas02', 'vec4') as any;
  const atlas03 = attribute('conditionAtlas03', 'vec4') as any;
  const atlas04 = attribute('conditionAtlas04', 'vec4') as any;
  const atlas05 = attribute('conditionAtlas05', 'vec4') as any;
  const atlas06 = attribute('conditionAtlas06', 'vec4') as any;

  const gCheeks = atlas01.x;
  const gNose = atlas01.y;
  const gForehead = atlas01.z;
  const gUnderEyes = atlas01.w;
  const gLips = atlas02.x;
  const gChin = atlas02.y;
  const gNeckExcl = atlas02.z;
  const gPhiltrum = atlas03.x;
  const gEarExcl = atlas03.y;
  const gScalpExcl = atlas03.z;
  const gSkinCoverage = atlas03.w;
  const gCurvature = atlas04.x;
  const gThickness = atlas04.y;
  const gAO = atlas04.z;
  const gCavity = atlas04.w;
  const gFhWrinkleL = atlas05.x;
  const gFhWrinkleR = atlas05.y;
  const gGlabella = atlas05.z;
  const gCrowFeetL = atlas05.w;
  const gCrowFeetR = atlas06.x;
  const gNasoL = atlas06.y;
  const gNasoR = atlas06.z;
  const gNoseWrinkle = atlas06.w;

  const gSebumZone = gNose.mul(1.15).add(gForehead.mul(0.82)).add(gChin.mul(0.16)).clamp(0, 1);
  const gSkinCore = gCheeks.mul(0.7).add(gNose.mul(0.75)).add(gForehead.mul(0.4)).add(gLips.mul(0.3)).clamp(0, 1);
  const gLipsSurface = smoothstep(float(0.4), float(0.6), gLips);
  const gVascularZone = float(1).sub(gThickness).clamp(0, 1).mul(0.62).add(gUnderEyes.mul(0.18)).add(gLipsSurface.mul(0.32)).add(gCheeks.mul(0.12)).clamp(0, 1);
  const gBeautyWrinkleUnion = gFhWrinkleL.add(gFhWrinkleR).add(gGlabella).add(gCrowFeetL).clamp(0, 1);
  const gPoreMask = gSebumZone.mul(0.95).add(gCheeks.mul(0.35)).add(gChin.mul(0.18)).sub(gUnderEyes.mul(0.75)).clamp(0, 1);

  const gBaseAlbedo = Fn(() => {
    const exclusion = max(gNeckExcl, max(gEarExcl, gScalpExcl));
    const coverage = gSkinCoverage.mul(float(1).sub(exclusion)).clamp(0, 1);
    const lipsClean = max(gLips.sub(gChin.mul(0.8)), float(0)).mul(smoothstep(float(0.25), float(0.251), gLips));
    const r = float(0.52).mul(
      float(1.0).add(gCheeks.mul(0.14)).add(gNose.mul(0.08)).add(lipsClean.mul(0.06))
        .add(gPhiltrum.mul(0.04)).add(gForehead.mul(0.02)).add(gChin.mul(0.02)).sub(gUnderEyes.mul(0.06)),
    );
    const g = float(0.27).mul(
      float(1.0).sub(gCheeks.mul(0.06)).sub(gNose.mul(0.04)).sub(lipsClean.mul(0.04))
        .sub(gPhiltrum.mul(0.02)).add(gForehead.mul(0.02)).add(gChin.mul(0.01)).sub(gUnderEyes.mul(0.10)),
    );
    const b = float(0.17).mul(
      float(1.0).sub(gCheeks.mul(0.14)).sub(gNose.mul(0.10)).sub(lipsClean.mul(0.06))
        .sub(gForehead.mul(0.02)).add(gUnderEyes.mul(0.12)).sub(gChin.mul(0.04)),
    );
    return mix(vec3(0.50, 0.26, 0.16), vec3(r, g, b), coverage);
  })();

  const uvBaseSample = conditioningTexturePack ? texture(conditioningTexturePack.baseMap, uv()) : null;
  const uvDermalSample = conditioningTexturePack ? texture(conditioningTexturePack.dermalMap, uv()) : null;
  const uvMicroSample = conditioningTexturePack ? texture(conditioningTexturePack.microMap, uv()) : null;

  const gSampledBaseAlbedo = conditioningTexturePack ? mix(vec3(gBaseAlbedo), vec3(uvBaseSample.rgb), uvBaseSample.a) : gBaseAlbedo;
  const gSampledCurvature = conditioningTexturePack ? mix(gCurvature, uvDermalSample.r, float(0.82)) : gCurvature;
  const gSampledThickness = conditioningTexturePack ? mix(gThickness, uvDermalSample.g, float(0.84)) : gThickness;
  const gSampledAO = conditioningTexturePack ? mix(gAO, uvDermalSample.b, float(0.78)) : gAO;
  const gSampledCavity = conditioningTexturePack ? mix(gCavity, uvDermalSample.a, float(0.86)) : gCavity;
  const gSampledSebum = conditioningTexturePack ? mix(gSebumZone, uvMicroSample.r, float(0.9)) : gSebumZone;
  const gSampledVascular = conditioningTexturePack ? mix(gVascularZone, uvMicroSample.g, float(0.88)) : gVascularZone;
  const gSampledWrinkleField = conditioningTexturePack ? mix(gBeautyWrinkleUnion, uvMicroSample.b, float(0.9)) : gBeautyWrinkleUnion;
  const gSampledPoreMask = conditioningTexturePack ? mix(gPoreMask, uvMicroSample.a, float(0.92)) : gPoreMask;
  const gSampledThinSkin = float(1).sub(gSampledThickness).clamp(0, 1);

  const frame = conditioningData.frame;
  const faceOrigin = vec3(frame.origin[0], frame.origin[1], frame.origin[2]);
  const faceRight = vec3(frame.right[0], frame.right[1], frame.right[2]);
  const faceUp = vec3(frame.up[0], frame.up[1], frame.up[2]);
  const faceForward = vec3(frame.forward[0], frame.forward[1], frame.forward[2]);
  const faceScaleInv = vec3(
    1.0 / frame.scaleX,
    1.0 / ((frame.scaleYTop + frame.scaleYBottom) * 0.5),
    1.0 / ((frame.scaleZFront + frame.scaleZBack) * 0.5),
  );

  const facePos = Fn(() => {
    const offset = positionLocal.sub(faceOrigin);
    return vec3(offset.dot(faceRight), offset.dot(faceUp), offset.dot(faceForward)).mul(faceScaleInv);
  })();

  const fbm2 = Fn(([position, scaleX, scaleY]: [any, any, any]) => {
    const pos = position.toVar();
    const p = pos.xy.mul(vec3(scaleX, scaleY, float(0)).xy);
    return mx_fractal_noise_float(p, float(4), float(2.0), float(0.5));
  });

  const worley2 = Fn(([position, scaleX, scaleY]: [any, any, any]) => {
    const pos = position.toVar();
    const p = pos.xy.mul(vec3(scaleX, scaleY, float(0)).xy);
    return mx_worley_noise_float(p);
  });

  const wrinkleCrease = Fn(([position, dirX, dirY, frequency, thicknessValue, breakup, seed]: [any, any, any, any, any, any, any]) => {
    const pos = position.toVar();
    const thickness = thicknessValue.toVar();
    const basis = normalize(vec3(dirX, dirY, float(0))).xy;
    const warp = fbm2(pos, float(8), float(8)).sub(0.5).mul(breakup);
    const seededPos = pos.add(vec3(seed.mul(0.17), seed.mul(-0.11), float(0)));
    const lineCoord = pos.xy.dot(basis).mul(frequency).add(warp.mul(6.0)).add(seed.mul(1.732));
    const crossFade = float(0.65).add(fbm2(seededPos, float(5.5), float(5.5)).mul(0.7));
    const ridge = smoothstep(float(0.58), float(0.98), lineCoord.sin().mul(0.5).add(0.5));
    const stripe = ridge.mul(crossFade);
    const edgeSoftness = thickness.add(fbm2(pos, float(12), float(12)).sub(0.5).mul(0.08));
    return smoothstep(float(1).sub(max(edgeSoftness, float(0.06))), float(1), stripe);
  });

  function buildBeautyColorNode(uniforms: SkinUniforms) {
    return Fn(() => {
      const baseColor = vec3(gSampledBaseAlbedo).toVar();
      const pigmentNoise = fbm2(facePos, float(14), float(18)).sub(0.5);
      const vascularNoise = fbm2(facePos.add(vec3(1.7, -2.1, 0)), float(10), float(15)).sub(0.5);

      const epidermalMix = float(0.05).add(gSkinCore.mul(0.04));
      baseColor.assign(mix(baseColor, baseColor.mul(uniforms.uEpidermalTint), epidermalMix.clamp(0, 1)));
      const pigmentField = float(1)
        .sub(gForehead.mul(0.03))
        .sub(gSebumZone.mul(0.018))
        .sub(pigmentNoise.mul(0.055).mul(gSkinCore.add(0.25)))
        .clamp(0.86, 1.08);
      baseColor.assign(baseColor.mul(pigmentField));

      const flushAmount = gCheeks.mul(0.28).add(gNose.mul(0.14)).add(gSampledThinSkin.mul(0.22)).mul(uniforms.uFlushStrength);
      const flushTint = vec3(1.045, 0.988, 0.972);
      baseColor.assign(mix(baseColor, baseColor.mul(flushTint), flushAmount.clamp(0, 1)));
      const dermalLift = uniforms.uDermalTint.mul(float(0.012).add(uniforms.uScatterStrength.mul(0.03)))
        .mul(gSampledVascular.add(vascularNoise.mul(0.08)).clamp(0, 1));
      baseColor.assign(baseColor.add(dermalLift));

      const lipBloom = uniforms.uDermalTint.mul(float(0.018).add(uniforms.uFlushStrength.mul(0.03))).mul(gLipsSurface);
      baseColor.assign(baseColor.add(lipBloom));
      const underEyeCool = mix(vec3(1, 1, 1), vec3(0.96, 0.97, 0.985), gUnderEyes.mul(0.75).clamp(0, 1));
      baseColor.assign(baseColor.mul(underEyeCool));

      const aoFactor = mix(float(1), pow(gSampledAO, float(0.82)), uniforms.uAoStrength.mul(0.75).clamp(0, 0.9));
      const cavityFactor = float(1).sub(gSampledCavity.mul(0.09).mul(uniforms.uAoStrength.clamp(0, 1)));
      baseColor.assign(baseColor.mul(aoFactor).mul(cavityFactor));

      return baseColor.clamp(0, 1.35);
    })();
  }

  function buildBeautyRoughnessNode(uniforms: SkinUniforms) {
    return Fn(() => {
      const baseRoughness = float(0.51).add(uniforms.uRoughnessOffset);
      const oilSmooth = gSampledSebum.mul(float(0.1).add(uniforms.uOilStrength.mul(0.11)));
      const lipSmooth = gLipsSurface.mul(0.16);
      const underEyeSmooth = gSampledThinSkin.mul(gUnderEyes.add(0.2)).mul(0.055);
      const dryRough = gCheeks.mul(0.028).add(gForehead.mul(0.022));

      const poreNoise = worley2(facePos, float(110), float(145));
      const poreBands = smoothstep(float(0.18), float(0.42), poreNoise).sub(smoothstep(float(0.42), float(0.8), poreNoise));
      const oilFilm = fbm2(facePos.add(vec3(-4.1, 2.7, 0)), float(42), float(56)).sub(0.5);
      const poreRoughness = poreBands.mul(0.05).mul(gSampledPoreMask);
      const oilFilmSmooth = oilFilm.mul(0.018).mul(gSampledSebum);

      return baseRoughness
        .sub(oilSmooth)
        .sub(lipSmooth)
        .sub(underEyeSmooth)
        .add(dryRough)
        .add(poreRoughness)
        .sub(oilFilmSmooth)
        .clamp(0.18, 0.88);
    })();
  }

  function buildBeautyEmissiveNode(uniforms: SkinUniforms) {
    return Fn(() => {
      const viewDir = normalize(cameraPosition.sub(positionWorld));
      const nDotV = normalWorld.dot(viewDir).clamp(0, 1);
      const rim = pow(float(1).sub(nDotV), float(2.35));
      const deepRim = pow(float(1).sub(nDotV), float(4.1));

      const subdermal = uniforms.uDermalTint
        .mul(float(0.01).add(uniforms.uScatterStrength.mul(0.028)))
        .mul(gSampledVascular)
        .mul(rim);

      const deep = uniforms.uDeepTint
        .mul(float(0.004).add(uniforms.uFlushStrength.mul(0.012)))
        .mul(gSampledThinSkin.mul(0.55).add(gLipsSurface.mul(0.22)).clamp(0, 1))
        .mul(deepRim);

      return subdermal.add(deep);
    })();
  }

  function buildBeautyNormalNode(uniforms: SkinUniforms) {
    const heightNode = Fn(() => {
      const organicH = fbm2(facePos, float(5), float(7)).sub(0.5).mul(0.01).mul(gSkinCore);
      const stretchH = fbm2(facePos.add(vec3(3.2, -1.8, 0)), float(26), float(8)).sub(0.5).mul(0.004).mul(gCheeks.add(gForehead.mul(0.45)));
      const microGrain = fbm2(facePos.add(vec3(7.1, -2.3, 0)), float(190), float(235)).sub(0.5).mul(0.0016).mul(gSkinCoverage);

      const poreCells = worley2(facePos, float(125), float(165));
      const poreCraters = smoothstep(float(0.12), float(0.32), poreCells).sub(smoothstep(float(0.32), float(0.72), poreCells));
      const poreRims = smoothstep(float(0.72), float(0.9), poreCells);
      const poreH = poreCraters.mul(-0.009).add(poreRims.mul(0.0035)).mul(gSampledPoreMask).mul(float(0.7).add(uniforms.uOilStrength.mul(0.45)));

      const cavityH = gSampledCavity.mul(-0.014);
      const curvH = gSampledCurvature.sub(0.5).mul(0.009);

      const fhLeft = wrinkleCrease(facePos, float(1), float(0.08), float(36), float(0.18), float(0.35), float(1.7));
      const fhRight = wrinkleCrease(facePos, float(1), float(-0.08), float(36), float(0.18), float(0.35), float(2.3));
      const glabellaLines = wrinkleCrease(facePos, float(0.08), float(1), float(48), float(0.15), float(0.22), float(3.1));
      const crowLeft = wrinkleCrease(facePos, float(0.84), float(0.54), float(34), float(0.16), float(0.3), float(4.9));
      const crowRight = wrinkleCrease(facePos, float(-0.84), float(0.54), float(34), float(0.16), float(0.3), float(5.7));
      const nasoLeft = wrinkleCrease(facePos, float(-0.42), float(0.9), float(32), float(0.16), float(0.28), float(6.1));
      const nasoRight = wrinkleCrease(facePos, float(0.42), float(0.9), float(32), float(0.16), float(0.28), float(6.9));
      const noseLines = wrinkleCrease(facePos, float(0.08), float(1), float(28), float(0.14), float(0.18), float(7.4));
      const lipCompress = wrinkleCrease(facePos, float(1), float(0.05), float(38), float(0.16), float(0.24), float(8.2));

      const wrinkleH = float(0).toVar();
      wrinkleH.addAssign(gFhWrinkleL.mul(uniforms.uBrowRaise).mul(fhLeft).mul(-0.012));
      wrinkleH.addAssign(gFhWrinkleR.mul(uniforms.uBrowRaise).mul(fhRight).mul(-0.012));
      wrinkleH.addAssign(gGlabella.mul(uniforms.uBrowCompress).mul(glabellaLines).mul(-0.018));
      wrinkleH.addAssign(gCrowFeetL.mul(uniforms.uSquint).mul(crowLeft).mul(-0.011));
      wrinkleH.addAssign(gUnderEyes.mul(gSampledWrinkleField).mul(uniforms.uSquint).mul(crowRight).mul(-0.011));
      wrinkleH.addAssign(gCheeks.mul(gSampledWrinkleField).mul(uniforms.uSmile).mul(nasoLeft).mul(-0.012));
      wrinkleH.addAssign(gCheeks.mul(gSampledWrinkleField).mul(uniforms.uSmile).mul(nasoRight).mul(-0.012));
      wrinkleH.addAssign(gNose.mul(gSampledWrinkleField).mul(uniforms.uNoseSneer).mul(noseLines).mul(-0.009));
      wrinkleH.addAssign(gLipsSurface.mul(uniforms.uMouthCompress).mul(lipCompress).mul(-0.007));

      const detailStrength = mix(float(0.45), float(1.5), uniforms.uWrinkleDepth.mul(0.5).clamp(0, 1))
        .mul(mix(float(0.82), float(1.18), gSampledWrinkleField));
      return organicH.add(stretchH).add(microGrain).add(poreH).add(cavityH).add(curvH).add(wrinkleH.mul(detailStrength));
    })();

    const bumpScale = mix(float(1.2), float(3.8), uniforms.uWrinkleDepth.mul(0.5).clamp(0, 1));
    return bumpMap(heightNode, bumpScale);
  }

  function buildBeautyPositionNode(uniforms: SkinUniforms) {
    return Fn(() => {
      const foldDisplacement = gFhWrinkleL.add(gFhWrinkleR).mul(uniforms.uBrowRaise).mul(-0.0022)
        .add(gGlabella.mul(uniforms.uBrowCompress).mul(-0.0032))
        .add(gCrowFeetL.add(gUnderEyes.mul(gSampledWrinkleField)).mul(uniforms.uSquint).mul(-0.0018))
        .add(gCheeks.mul(gSampledWrinkleField).add(gCheeks.mul(gSampledWrinkleField)).mul(uniforms.uSmile).mul(-0.0024))
        .add(gNose.mul(gSampledWrinkleField).mul(uniforms.uNoseSneer).mul(-0.0015))
        .add(gLipsSurface.mul(uniforms.uMouthCompress).mul(-0.0017));

      const padBulge = gCheeks.mul(uniforms.uSmile).mul(0.0015)
        .add(gUnderEyes.mul(uniforms.uSquint).mul(0.001))
        .add(gPhiltrum.mul(uniforms.uMouthCompress).mul(0.0008));

      const displacement = foldDisplacement.add(padBulge);
      return positionLocal.add(normalLocal.mul(displacement.mul(uniforms.uWrinkleDepth.clamp(0.25, 2))));
    })();
  }

  function createBaselineMaterial() {
    const material = new THREE_WEBGPU.MeshPhysicalNodeMaterial();
    material.name = 'beauty-lab-baseline';
    material.vertexColors = false;
    material.colorNode = gBaseAlbedo;
    material.side = THREE.FrontSide;
    material.roughness = 0.56;
    material.metalness = 0;
    material.envMapIntensity = 1.25;
    material.clearcoat = 0.08;
    material.clearcoatRoughness = 0.48;
    material.sheen = 0.28;
    material.sheenColor = new THREE.Color('#ffc1ae');
    material.sheenRoughness = 0.42;
    material.ior = 1.42;
    material.specularIntensity = 0.92;
    material.specularColor = new THREE.Color('#f6e7df');
    return material;
  }

  function createBeautyMaterial(uniforms: SkinUniforms) {
    const material = new THREE_WEBGPU.MeshPhysicalNodeMaterial();
    material.name = 'beauty-lab-beauty';
    material.vertexColors = false;
    material.side = THREE.FrontSide;
    material.roughness = 0.52;
    material.metalness = 0;
    material.envMapIntensity = 1.18;
    material.ior = 1.44;
    material.colorNode = buildBeautyColorNode(uniforms);
    material.normalNode = buildBeautyNormalNode(uniforms);
    material.emissiveNode = buildBeautyEmissiveNode(uniforms);
    material.roughnessNode = buildBeautyRoughnessNode(uniforms);
    material.positionNode = buildBeautyPositionNode(uniforms);

    const sheenMask = gCheeks.mul(0.9).add(gForehead.mul(0.65)).add(gNose.mul(0.25));
    material.sheenNode = sheenMask.mul(0.16).mul(float(1).sub(gSampledSebum.mul(0.2)));
    material.sheenRoughnessNode = float(0.72).sub(gSampledSebum.mul(0.08));
    material.sheenColorNode = vec3(1.0, 0.85, 0.75);
    material.clearcoatNode = gSampledSebum.mul(0.035).add(gLipsSurface.mul(0.05)).mul(float(0.55).add(uniforms.uOilStrength.mul(0.9)));
    material.clearcoatRoughnessNode = float(0.26).sub(gSampledSebum.mul(0.08));
    material.specularIntensityNode = float(0.78).add(gSampledSebum.mul(0.18)).add(gSampledThinSkin.mul(0.06)).add(gLipsSurface.mul(0.08));
    material.specularColorNode = vec3(0.97, 0.93, 0.9);

    const thinSkinMask = gSampledThinSkin.mul(0.75).add(gUnderEyes.mul(0.18)).add(gLipsSurface.mul(0.22)).add(gNose.mul(0.08)).clamp(0, 1);
    material.transmissionNode = thinSkinMask.mul(float(0.05).add(uniforms.uScatterStrength.mul(0.12)));
    material.thicknessNode = mix(float(0.18), float(1.45), gSampledThickness.clamp(0, 1));
    material.attenuationDistance = 0.42;
    material.attenuationColor = new THREE.Color(0.88, 0.34, 0.24);

    return material;
  }

  function getSegmentNode(segment: DebugSegment) {
    const maskMap: Record<string, any> = {
      cheeks: gCheeks,
      nose: gNose,
      forehead: gForehead,
      underEyes: gUnderEyes,
      lips: gLips,
      chin: gChin,
      philtrum: gPhiltrum,
      skinCoverage: gSkinCoverage,
      sebumZone: gSebumZone,
      curvature: gCurvature,
      thickness: gThickness,
      AO: gAO,
      cavity: gCavity,
      neckExcl: gNeckExcl,
      earExcl: gEarExcl,
      scalpExcl: gScalpExcl,
      fhWrinkleL: gFhWrinkleL,
      fhWrinkleR: gFhWrinkleR,
      glabella: gGlabella,
      crowFeetL: gCrowFeetL,
      crowFeetR: gCrowFeetR,
      nasolabialL: gNasoL,
      nasolabialR: gNasoR,
      noseWrinkle: gNoseWrinkle,
    };
    return maskMap[segment] ?? float(0);
  }

  function buildDebugColorNode(segment: DebugSegment) {
    return Fn(() => {
      const bg = vec3(0.08, 0.08, 0.08);

      if (segment === 'all-regions') {
        const result = vec3(0.08, 0.08, 0.08).toVar();
        const regions: [string, any][] = [
          ['cheeks', gCheeks],
          ['nose', gNose],
          ['forehead', gForehead],
          ['underEyes', gUnderEyes],
          ['lips', gLips],
          ['chin', gChin],
          ['philtrum', gPhiltrum],
          ['neckExcl', gNeckExcl],
          ['earExcl', gEarExcl],
          ['scalpExcl', gScalpExcl],
        ];
        for (const [name, mask] of regions) {
          const colorValue = SEGMENT_COLORS[name] ?? [0.5, 0.5, 0.5];
          result.assign(result.add(vec3(colorValue[0], colorValue[1], colorValue[2]).mul(mask)));
        }
        return result;
      }

      const mask = getSegmentNode(segment);
      const colorValue = SEGMENT_COLORS[segment] ?? [1, 1, 1];
      return mix(bg, vec3(colorValue[0], colorValue[1], colorValue[2]), mask.clamp(0, 1));
    })();
  }

  function createDebugMaterial(segment: DebugSegment) {
    const material = new THREE_WEBGPU.MeshPhysicalNodeMaterial();
    material.name = `beauty-lab-debug-${segment}`;
    material.vertexColors = false;
    material.side = THREE.FrontSide;
    material.roughness = 0.9;
    material.metalness = 0;
    material.envMapIntensity = 0.1;
    material.clearcoat = 0;
    material.sheen = 0;
    material.colorNode = buildDebugColorNode(segment);
    return material;
  }

  return {
    createBaselineMaterial,
    createBeautyMaterial,
    createDebugMaterial,
  };
}

export type BeautyLabMaterialFactory = ReturnType<typeof createBeautyLabMaterialFactory>;
