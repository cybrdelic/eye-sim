import * as THREE from 'three';

export const FACS_CONTROL_KEYS = [
  'eyeBlink_L',
  'eyeBlink_R',
  'eyeSquint_L',
  'eyeSquint_R',
  'eyeWide_L',
  'eyeWide_R',
  'jawOpen',
  'jawForward',
  'jawLeft',
  'jawRight',
  'mouthClose',
  'mouthLeft',
  'mouthRight',
  'mouthSmile_L',
  'mouthSmile_R',
  'mouthFrown_L',
  'mouthFrown_R',
  'mouthStretch_L',
  'mouthStretch_R',
  'mouthDimple_L',
  'mouthDimple_R',
  'mouthFunnel',
  'mouthPucker',
  'mouthPress_L',
  'mouthPress_R',
  'mouthRollLower',
  'mouthRollUpper',
  'mouthShrugLower',
  'mouthShrugUpper',
  'mouthLowerDown_L',
  'mouthLowerDown_R',
  'mouthUpperUp_L',
  'mouthUpperUp_R',
  'browInnerUp',
  'browDown_L',
  'browDown_R',
  'browOuterUp_L',
  'browOuterUp_R',
  'cheekPuff',
  'cheekSquint_L',
  'cheekSquint_R',
  'noseSneer_L',
  'noseSneer_R',
  'tongueOut',
] as const;

export type FacsControlKey = (typeof FACS_CONTROL_KEYS)[number];
export type FaceViewMode = 'beauty' | 'wireframe' | 'normals' | 'depth' | 'basic';

export type WrinkleUniformRefs = {
  foreheadLeft: { value: number };
  foreheadRight: { value: number };
  glabella: { value: number };
  crowLeft: { value: number };
  crowRight: { value: number };
  nasolabialLeft: { value: number };
  nasolabialRight: { value: number };
  nose: { value: number };
};

type WrinkleRegionKey = keyof WrinkleUniformRefs;

type WrinkleSimulationCell = {
  strain: number;
  velocity: number;
  driver: number;
};

export type WrinkleSimulationState = Record<WrinkleRegionKey, WrinkleSimulationCell>;

export type SkinUniformRefs = {
  epidermalTint: { value: THREE.Color };
  dermalTint: { value: THREE.Color };
  deepTint: { value: THREE.Color };
  scatterStrength: { value: number };
  flushStrength: { value: number };
  oilStrength: { value: number };
  coolStrength: { value: number };
  aoStrength: { value: number };
  displacementStrength: { value: number };
  sssStrength: { value: number };
  thicknessLip: { value: number };
  thicknessNose: { value: number };
  thicknessUnderEye: { value: number };
  thicknessCheek: { value: number };
  thicknessForehead: { value: number };
};

export type SkinShaderControls = {
  poreAoStrength: number;
  displacementAmount: number;
  sssStrength: number;
  thicknessLip: number;
  thicknessNose: number;
  thicknessUnderEye: number;
  thicknessCheek: number;
  thicknessForehead: number;
};

const SKIN_COLOR_BASE = new THREE.Color('#f3c6b3');
const SKIN_COLOR_WARM = new THREE.Color('#ffd2c1');
const SKIN_COLOR_DERMAL = new THREE.Color('#cf6f63');
const SKIN_COLOR_FLUSH = new THREE.Color('#e07c72');
const SKIN_COLOR_DEEP = new THREE.Color('#6d241f');

export const FACS_CONTROL_DEFAULTS = Object.fromEntries(
  FACS_CONTROL_KEYS.map((key) => [key, { value: 0, min: 0, max: 1 }]),
) as Record<FacsControlKey, { value: number; min: number; max: number }>;

export const FACS_PREVIOUS_VALUES = Object.fromEntries(
  FACS_CONTROL_KEYS.map((key) => [key, -1]),
) as Record<FacsControlKey, number>;

export const HEAD_RIG_TRACKING_MAP = {
  pitchSign: 1,
  yawToZSign: 1,
  rollToYSign: -1,
} as const;

export const BEAUTY_SHADER_VERSION = 'skin-v13';

const WRINKLE_REGION_KEYS: WrinkleRegionKey[] = [
  'foreheadLeft',
  'foreheadRight',
  'glabella',
  'crowLeft',
  'crowRight',
  'nasolabialLeft',
  'nasolabialRight',
  'nose',
];

const WRINKLE_PHYSICS = {
  maxDt: 1 / 30,
  substeps: 2,
  params: {
    foreheadLeft: { stiffness: 28, damping: 10.5, mass: 1.05, gain: 18 },
    foreheadRight: { stiffness: 28, damping: 10.5, mass: 1.05, gain: 18 },
    glabella: { stiffness: 34, damping: 11.5, mass: 0.95, gain: 22 },
    crowLeft: { stiffness: 26, damping: 9.2, mass: 0.85, gain: 17 },
    crowRight: { stiffness: 26, damping: 9.2, mass: 0.85, gain: 17 },
    nasolabialLeft: { stiffness: 20, damping: 8.6, mass: 0.82, gain: 20 },
    nasolabialRight: { stiffness: 20, damping: 8.6, mass: 0.82, gain: 20 },
    nose: { stiffness: 24, damping: 9.5, mass: 0.75, gain: 18 },
  },
  couplings: {
    foreheadLeft: { glabella: 0.18 },
    foreheadRight: { glabella: 0.18 },
    glabella: { foreheadLeft: 0.12, foreheadRight: 0.12, nose: 0.08 },
    crowLeft: { nasolabialLeft: 0.08 },
    crowRight: { nasolabialRight: 0.08 },
    nasolabialLeft: { crowLeft: 0.1, nose: 0.14 },
    nasolabialRight: { crowRight: 0.1, nose: 0.14 },
    nose: { glabella: 0.08, nasolabialLeft: 0.1, nasolabialRight: 0.1 },
  } satisfies Record<WrinkleRegionKey, Partial<Record<WrinkleRegionKey, number>>>,
} as const;

export function createWrinkleUniformRefs(): WrinkleUniformRefs {
  return {
    foreheadLeft: { value: 0 },
    foreheadRight: { value: 0 },
    glabella: { value: 0 },
    crowLeft: { value: 0 },
    crowRight: { value: 0 },
    nasolabialLeft: { value: 0 },
    nasolabialRight: { value: 0 },
    nose: { value: 0 },
  };
}

export function createWrinkleSimulationState(): WrinkleSimulationState {
  return {
    foreheadLeft: { strain: 0, velocity: 0, driver: 0 },
    foreheadRight: { strain: 0, velocity: 0, driver: 0 },
    glabella: { strain: 0, velocity: 0, driver: 0 },
    crowLeft: { strain: 0, velocity: 0, driver: 0 },
    crowRight: { strain: 0, velocity: 0, driver: 0 },
    nasolabialLeft: { strain: 0, velocity: 0, driver: 0 },
    nasolabialRight: { strain: 0, velocity: 0, driver: 0 },
    nose: { strain: 0, velocity: 0, driver: 0 },
  };
}

export function createSkinUniformRefs(): SkinUniformRefs {
  return {
    epidermalTint: { value: SKIN_COLOR_BASE.clone() },
    dermalTint: { value: SKIN_COLOR_DERMAL.clone() },
    deepTint: { value: SKIN_COLOR_DEEP.clone() },
    scatterStrength: { value: 0.42 },
    flushStrength: { value: 0.16 },
    oilStrength: { value: 0.22 },
    coolStrength: { value: 0.14 },
    aoStrength: { value: 0.7 },
    displacementStrength: { value: 0.85 },
    sssStrength: { value: 1.2 },
    thicknessLip: { value: 1.4 },
    thicknessNose: { value: 0.92 },
    thicknessUnderEye: { value: 1.18 },
    thicknessCheek: { value: 1.08 },
    thicknessForehead: { value: 0.78 },
  };
}

function getWrinkleDriverTargets(blendshapes: Partial<Record<FacsControlKey, number>>) {
  const browInnerUp = blendshapes.browInnerUp ?? 0;
  const browDownL = blendshapes.browDown_L ?? 0;
  const browDownR = blendshapes.browDown_R ?? 0;
  const browOuterUpL = blendshapes.browOuterUp_L ?? 0;
  const browOuterUpR = blendshapes.browOuterUp_R ?? 0;
  const eyeSquintL = blendshapes.eyeSquint_L ?? 0;
  const eyeSquintR = blendshapes.eyeSquint_R ?? 0;
  const cheekSquintL = blendshapes.cheekSquint_L ?? 0;
  const cheekSquintR = blendshapes.cheekSquint_R ?? 0;
  const smileL = blendshapes.mouthSmile_L ?? 0;
  const smileR = blendshapes.mouthSmile_R ?? 0;
  const dimpleL = blendshapes.mouthDimple_L ?? 0;
  const dimpleR = blendshapes.mouthDimple_R ?? 0;
  const stretchL = blendshapes.mouthStretch_L ?? 0;
  const stretchR = blendshapes.mouthStretch_R ?? 0;
  const pressL = blendshapes.mouthPress_L ?? 0;
  const pressR = blendshapes.mouthPress_R ?? 0;
  const upperUpL = blendshapes.mouthUpperUp_L ?? 0;
  const upperUpR = blendshapes.mouthUpperUp_R ?? 0;
  const noseSneerL = blendshapes.noseSneer_L ?? 0;
  const noseSneerR = blendshapes.noseSneer_R ?? 0;

  return {
    foreheadLeft: THREE.MathUtils.clamp(
      browInnerUp * 0.28 + browOuterUpL * 0.54 + browDownL * 0.24,
      0,
      1,
    ),
    foreheadRight: THREE.MathUtils.clamp(
      browInnerUp * 0.28 + browOuterUpR * 0.54 + browDownR * 0.24,
      0,
      1,
    ),
    glabella: THREE.MathUtils.clamp((browDownL + browDownR) * 0.58 + browInnerUp * 0.18, 0, 1),
    crowLeft: THREE.MathUtils.clamp(eyeSquintL * 0.82 + cheekSquintL * 0.34 + smileL * 0.2, 0, 1),
    crowRight: THREE.MathUtils.clamp(eyeSquintR * 0.82 + cheekSquintR * 0.34 + smileR * 0.2, 0, 1),
    nasolabialLeft: THREE.MathUtils.clamp(
      smileL * 0.52 + dimpleL * 0.36 + stretchL * 0.18 + pressL * 0.16 + upperUpL * 0.18 + noseSneerL * 0.16,
      0,
      1,
    ),
    nasolabialRight: THREE.MathUtils.clamp(
      smileR * 0.52 + dimpleR * 0.36 + stretchR * 0.18 + pressR * 0.16 + upperUpR * 0.18 + noseSneerR * 0.16,
      0,
      1,
    ),
    nose: THREE.MathUtils.clamp((noseSneerL + noseSneerR) * 0.46 + (cheekSquintL + cheekSquintR) * 0.16, 0, 1),
  };
}

export function simulateWrinkleUniforms(
  uniforms: WrinkleUniformRefs,
  state: WrinkleSimulationState,
  blendshapes: Partial<Record<FacsControlKey, number>>,
  dt: number,
) {
  const targets = getWrinkleDriverTargets(blendshapes);
  const clampedDt = Math.min(Math.max(dt, 1 / 240), WRINKLE_PHYSICS.maxDt);
  const stepDt = clampedDt / WRINKLE_PHYSICS.substeps;

  for (const key of WRINKLE_REGION_KEYS) {
    state[key].driver = targets[key];
  }

  for (let step = 0; step < WRINKLE_PHYSICS.substeps; step++) {
    const previousStrain = Object.fromEntries(WRINKLE_REGION_KEYS.map((key) => [key, state[key].strain])) as Record<WrinkleRegionKey, number>;

    for (const key of WRINKLE_REGION_KEYS) {
      const cell = state[key];
      const params = WRINKLE_PHYSICS.params[key];
      const coupling = WRINKLE_PHYSICS.couplings[key];

      let neighborForce = 0;
      for (const [otherKey, weight] of Object.entries(coupling) as Array<[WrinkleRegionKey, number]>) {
        neighborForce += (previousStrain[otherKey] - previousStrain[key]) * weight;
      }

      const targetStrain = cell.driver * params.gain;
      const externalForce = (targetStrain - previousStrain[key]) * params.stiffness;
      const restoringForce = -previousStrain[key] * params.stiffness * 0.82;
      const dampingForce = -cell.velocity * params.damping;
      const acceleration = (externalForce + restoringForce + neighborForce * params.stiffness * 0.45 + dampingForce) / params.mass;

      cell.velocity += acceleration * stepDt;
      cell.strain = Math.max(0, cell.strain + cell.velocity * stepDt);

      const yieldTarget = Math.max(0, cell.driver - 0.58) * 0.08;
      cell.strain = THREE.MathUtils.lerp(cell.strain, cell.strain + yieldTarget, 0.12 * stepDt * 60);
    }
  }

  for (const key of WRINKLE_REGION_KEYS) {
    const driverCarry = state[key].driver * 0.18;
    uniforms[key].value = THREE.MathUtils.clamp(state[key].strain * 0.06 + driverCarry, 0, 1);
  }
}

export function updateSkinUniforms(
  uniforms: SkinUniformRefs,
  blendshapes: Partial<Record<FacsControlKey, number>>,
  controls: SkinShaderControls,
) {
  const smile = Math.max(blendshapes.mouthSmile_L ?? 0, blendshapes.mouthSmile_R ?? 0);
  const stretch = Math.max(blendshapes.mouthStretch_L ?? 0, blendshapes.mouthStretch_R ?? 0);
  const press = Math.max(blendshapes.mouthPress_L ?? 0, blendshapes.mouthPress_R ?? 0);
  const cheekSquint = Math.max(blendshapes.cheekSquint_L ?? 0, blendshapes.cheekSquint_R ?? 0);
  const noseSneer = Math.max(blendshapes.noseSneer_L ?? 0, blendshapes.noseSneer_R ?? 0);
  const eyeSquint = Math.max(blendshapes.eyeSquint_L ?? 0, blendshapes.eyeSquint_R ?? 0);
  const browTension = Math.max(blendshapes.browDown_L ?? 0, blendshapes.browDown_R ?? 0, blendshapes.browInnerUp ?? 0);

  const flushTarget = THREE.MathUtils.clamp(smile * 0.36 + stretch * 0.18 + cheekSquint * 0.22 + noseSneer * 0.2 + press * 0.1, 0.08, 0.92);
  const scatterTarget = THREE.MathUtils.clamp(0.38 + smile * 0.08 + cheekSquint * 0.05 + browTension * 0.06 - press * 0.05, 0.24, 0.72);
  const oilTarget = THREE.MathUtils.clamp(0.18 + eyeSquint * 0.08 + noseSneer * 0.18 + browTension * 0.08, 0.12, 0.64);
  const coolTarget = THREE.MathUtils.clamp(0.14 + browTension * 0.1 - smile * 0.06, 0.08, 0.32);

  uniforms.flushStrength.value = THREE.MathUtils.lerp(uniforms.flushStrength.value, flushTarget, 0.16);
  uniforms.scatterStrength.value = THREE.MathUtils.lerp(uniforms.scatterStrength.value, scatterTarget * controls.sssStrength, 0.14);
  uniforms.oilStrength.value = THREE.MathUtils.lerp(uniforms.oilStrength.value, oilTarget, 0.16);
  uniforms.coolStrength.value = THREE.MathUtils.lerp(uniforms.coolStrength.value, coolTarget, 0.12);
  uniforms.aoStrength.value = THREE.MathUtils.lerp(uniforms.aoStrength.value, controls.poreAoStrength, 0.18);
  uniforms.displacementStrength.value = THREE.MathUtils.lerp(uniforms.displacementStrength.value, controls.displacementAmount, 0.18);
  uniforms.sssStrength.value = THREE.MathUtils.lerp(uniforms.sssStrength.value, controls.sssStrength, 0.16);
  uniforms.thicknessLip.value = THREE.MathUtils.lerp(uniforms.thicknessLip.value, controls.thicknessLip, 0.16);
  uniforms.thicknessNose.value = THREE.MathUtils.lerp(uniforms.thicknessNose.value, controls.thicknessNose, 0.16);
  uniforms.thicknessUnderEye.value = THREE.MathUtils.lerp(uniforms.thicknessUnderEye.value, controls.thicknessUnderEye, 0.16);
  uniforms.thicknessCheek.value = THREE.MathUtils.lerp(uniforms.thicknessCheek.value, controls.thicknessCheek, 0.16);
  uniforms.thicknessForehead.value = THREE.MathUtils.lerp(uniforms.thicknessForehead.value, controls.thicknessForehead, 0.16);

  uniforms.epidermalTint.value.copy(SKIN_COLOR_BASE).lerp(SKIN_COLOR_WARM, uniforms.flushStrength.value * 0.22);
  uniforms.dermalTint.value.copy(SKIN_COLOR_DERMAL).lerp(SKIN_COLOR_FLUSH, uniforms.flushStrength.value * 0.35);
  uniforms.deepTint.value.copy(SKIN_COLOR_DEEP).lerp(SKIN_COLOR_FLUSH, uniforms.flushStrength.value * 0.08);
}

export function adaptFacecapBlendshapes(blendshapes: Record<FacsControlKey, number>) {
  const next = { ...blendshapes };
  const smile = Math.max(next.mouthSmile_L ?? 0, next.mouthSmile_R ?? 0);
  const stretch = Math.max(next.mouthStretch_L ?? 0, next.mouthStretch_R ?? 0);
  const funnel = next.mouthFunnel ?? 0;
  const pucker = next.mouthPucker ?? 0;
  const openEnvelope = THREE.MathUtils.clamp(Math.max(smile * 0.5, stretch * 0.42, funnel * 0.3, pucker * 0.24), 0, 0.28);

  next.jawOpen = THREE.MathUtils.clamp((next.jawOpen ?? 0) * 0.82, 0, 0.44 - openEnvelope * 0.18);
  next.jawForward = THREE.MathUtils.clamp(next.jawForward ?? 0, 0, 0.16);
  next.jawLeft = THREE.MathUtils.clamp(next.jawLeft ?? 0, 0, 0.32);
  next.jawRight = THREE.MathUtils.clamp(next.jawRight ?? 0, 0, 0.32);

  next.mouthLowerDown_L = THREE.MathUtils.clamp((next.mouthLowerDown_L ?? 0) * 0.72, 0, 0.22);
  next.mouthLowerDown_R = THREE.MathUtils.clamp((next.mouthLowerDown_R ?? 0) * 0.72, 0, 0.22);
  next.mouthUpperUp_L = THREE.MathUtils.clamp((next.mouthUpperUp_L ?? 0) * 0.6, 0, 0.16);
  next.mouthUpperUp_R = THREE.MathUtils.clamp((next.mouthUpperUp_R ?? 0) * 0.6, 0, 0.16);
  next.mouthShrugUpper = THREE.MathUtils.clamp((next.mouthShrugUpper ?? 0) * 0.6, 0, 0.18);
  next.mouthShrugLower = THREE.MathUtils.clamp((next.mouthShrugLower ?? 0) * 0.74, 0, 0.18);
  next.mouthRollUpper = THREE.MathUtils.clamp((next.mouthRollUpper ?? 0) * 0.72, 0, 0.22);
  next.mouthRollLower = THREE.MathUtils.clamp((next.mouthRollLower ?? 0) * 0.82, 0, 0.24);
  next.mouthFunnel = THREE.MathUtils.clamp((next.mouthFunnel ?? 0) * 0.78, 0, 0.56);
  next.mouthPucker = THREE.MathUtils.clamp((next.mouthPucker ?? 0) * 0.82, 0, 0.58);
  next.tongueOut = THREE.MathUtils.clamp(next.tongueOut ?? 0, 0, 0.08);

  return next;
}

export function isDentalCandidateMesh(mesh: THREE.Mesh, material: THREE.Material) {
  const combinedName = `${mesh.name} ${mesh.parent?.name ?? ''} ${material.name}`.toLowerCase();
  return /(teeth|tooth|gum|tongue|mouthinner|mouth_inner|saliva)/.test(combinedName);
}

function isSkinCandidateMesh(mesh: THREE.Mesh, material: THREE.Material) {
  const combinedName = `${mesh.name} ${material.name}`.toLowerCase();
  if (/(eye|cornea|iris|pupil|teeth|tooth|gum|tongue|mouthinner|mouth_inner|saliva|lash)/.test(combinedName)) {
    return false;
  }

  if (/(skin|face|head|cheek|nose|ear)/.test(combinedName)) {
    return true;
  }

  return mesh.name === 'mesh_2'
    || material.name === 'lambert5'
    || Object.keys(mesh.morphTargetDictionary ?? {}).length >= 12;
}

export function createDentalMaterial(originalMaterial: THREE.Material, mesh: THREE.Mesh) {
  const geometry = mesh.geometry as THREE.BufferGeometry;
  if (!geometry.boundingBox) {
    geometry.computeBoundingBox();
  }

  const bboxMin = geometry.boundingBox?.min.clone() ?? new THREE.Vector3(-1, -1, -1);
  const bboxMax = geometry.boundingBox?.max.clone() ?? new THREE.Vector3(1, 1, 1);
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#efe7de'),
    roughness: 0.34,
    metalness: 0,
    envMapIntensity: 0.32,
    clearcoat: 0.12,
    clearcoatRoughness: 0.18,
    ior: 1.53,
  });
  material.name = `dental-${originalMaterial.name || mesh.name}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDentalBBoxMin = { value: bboxMin };
    shader.uniforms.uDentalBBoxMax = { value: bboxMax };

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vDentalLocalPosition;
uniform vec3 uDentalBBoxMin;
uniform vec3 uDentalBBoxMax;`,
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vDentalLocalPosition = clamp((position - uDentalBBoxMin) / max(uDentalBBoxMax - uDentalBBoxMin, vec3(0.0001)), vec3(0.0), vec3(1.0));`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vDentalLocalPosition;

float dentalBand(float value, float center, float radius, float blur) {
  return 1.0 - smoothstep(radius, radius + blur, abs(value - center));
}`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
{
  float dentalDepth = smoothstep(0.18, 0.78, vDentalLocalPosition.z);
  float incisorMask = dentalBand(vDentalLocalPosition.x, 0.5, 0.22, 0.08);
  float gumMask = smoothstep(0.72, 0.98, vDentalLocalPosition.y) * (1.0 - dentalDepth * 0.45);
  float rootShadow = smoothstep(0.56, 0.92, vDentalLocalPosition.y) * smoothstep(0.35, 0.95, vDentalLocalPosition.z);
  vec3 enamel = vec3(0.97, 0.95, 0.91);
  vec3 dentin = vec3(0.86, 0.79, 0.72);
  vec3 gumTint = vec3(0.52, 0.28, 0.28);
  vec3 toothColor = mix(dentin, enamel, incisorMask * 0.45 + 0.4);
  toothColor = mix(toothColor, gumTint, gumMask * 0.65);
  toothColor *= 1.0 - rootShadow * 0.35;
  diffuseColor.rgb = toothColor;
}`,
    );
  };
  material.customProgramCacheKey = () => 'dental-v2';
  return material;
}

export function createWrinkleBeautyMaterial(
  originalMaterial: THREE.Material,
  mesh: THREE.Mesh,
  wrinkleUniforms: WrinkleUniformRefs,
  skinUniforms: SkinUniformRefs,
) {
  if (!(originalMaterial instanceof THREE.MeshStandardMaterial || originalMaterial instanceof THREE.MeshPhysicalMaterial)) {
    return originalMaterial;
  }

  if (!isSkinCandidateMesh(mesh, originalMaterial)) {
    return originalMaterial;
  }

  const geometry = mesh.geometry as THREE.BufferGeometry;
  if (!geometry.boundingBox) {
    geometry.computeBoundingBox();
  }

  const bboxMin = geometry.boundingBox?.min.clone() ?? new THREE.Vector3(-1, -1, -1);
  const bboxMax = geometry.boundingBox?.max.clone() ?? new THREE.Vector3(1, 1, 1);
  const wrinkleMaterial = originalMaterial.clone();
  const originalOnBeforeCompile = wrinkleMaterial.onBeforeCompile;

  wrinkleMaterial.color.copy(SKIN_COLOR_BASE).multiplyScalar(1.02);
  wrinkleMaterial.roughness = THREE.MathUtils.clamp(wrinkleMaterial.roughness * 0.78, 0.12, 0.92);
  wrinkleMaterial.metalness = 0;
  wrinkleMaterial.envMapIntensity = 1.25;
  if (wrinkleMaterial instanceof THREE.MeshPhysicalMaterial) {
    wrinkleMaterial.clearcoat = 0.08;
    wrinkleMaterial.clearcoatRoughness = 0.48;
    wrinkleMaterial.sheen = 0.28;
    wrinkleMaterial.sheenColor = new THREE.Color('#ffc1ae');
    wrinkleMaterial.sheenRoughness = 0.42;
    wrinkleMaterial.ior = 1.42;
  }

  wrinkleMaterial.onBeforeCompile = (shader, renderer) => {
    shader.uniforms.uWrinkleBBoxMin = { value: bboxMin };
    shader.uniforms.uWrinkleBBoxMax = { value: bboxMax };
    shader.uniforms.uWrinkleForeheadLeft = wrinkleUniforms.foreheadLeft;
    shader.uniforms.uWrinkleForeheadRight = wrinkleUniforms.foreheadRight;
    shader.uniforms.uWrinkleGlabella = wrinkleUniforms.glabella;
    shader.uniforms.uWrinkleCrowLeft = wrinkleUniforms.crowLeft;
    shader.uniforms.uWrinkleCrowRight = wrinkleUniforms.crowRight;
    shader.uniforms.uWrinkleNasolabialLeft = wrinkleUniforms.nasolabialLeft;
    shader.uniforms.uWrinkleNasolabialRight = wrinkleUniforms.nasolabialRight;
    shader.uniforms.uWrinkleNose = wrinkleUniforms.nose;
    shader.uniforms.uSkinEpidermalTint = skinUniforms.epidermalTint;
    shader.uniforms.uSkinDermalTint = skinUniforms.dermalTint;
    shader.uniforms.uSkinDeepTint = skinUniforms.deepTint;
    shader.uniforms.uSkinScatterStrength = skinUniforms.scatterStrength;
    shader.uniforms.uSkinFlushStrength = skinUniforms.flushStrength;
    shader.uniforms.uSkinOilStrength = skinUniforms.oilStrength;
    shader.uniforms.uSkinCoolStrength = skinUniforms.coolStrength;
    shader.uniforms.uSkinAoStrength = skinUniforms.aoStrength;
    shader.uniforms.uSkinDisplacementStrength = skinUniforms.displacementStrength;
    shader.uniforms.uSkinSssStrength = skinUniforms.sssStrength;
    shader.uniforms.uSkinThicknessLip = skinUniforms.thicknessLip;
    shader.uniforms.uSkinThicknessNose = skinUniforms.thicknessNose;
    shader.uniforms.uSkinThicknessUnderEye = skinUniforms.thicknessUnderEye;
    shader.uniforms.uSkinThicknessCheek = skinUniforms.thicknessCheek;
    shader.uniforms.uSkinThicknessForehead = skinUniforms.thicknessForehead;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vWrinkleLocalPosition;
uniform vec3 uWrinkleBBoxMin;
uniform vec3 uWrinkleBBoxMax;
uniform float uWrinkleForeheadLeft;
uniform float uWrinkleForeheadRight;
uniform float uWrinkleGlabella;
uniform float uWrinkleNasolabialLeft;
uniform float uWrinkleNasolabialRight;
uniform float uWrinkleNose;
uniform float uSkinDisplacementStrength;

float vertexWrinkleBand(float value, float center, float radius, float blur) {
  return 1.0 - smoothstep(radius, radius + blur, abs(value - center));
}`
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vec3 wrinkleBBoxSize = max(uWrinkleBBoxMax - uWrinkleBBoxMin, vec3(0.0001));
vec3 wrinklePosVertex = clamp((position - uWrinkleBBoxMin) / wrinkleBBoxSize, vec3(0.0), vec3(1.0));
float vForeheadLeftMask = vertexWrinkleBand(wrinklePosVertex.y, 0.80, 0.14, 0.10) * vertexWrinkleBand(wrinklePosVertex.x, 0.34, 0.17, 0.12);
float vForeheadRightMask = vertexWrinkleBand(wrinklePosVertex.y, 0.80, 0.14, 0.10) * vertexWrinkleBand(wrinklePosVertex.x, 0.66, 0.17, 0.12);
float vGlabellaMask = vertexWrinkleBand(wrinklePosVertex.y, 0.65, 0.12, 0.08) * vertexWrinkleBand(wrinklePosVertex.x, 0.50, 0.10, 0.08);
float vLeftNasolabialMask = vertexWrinkleBand(wrinklePosVertex.x, 0.35, 0.10, 0.10) * vertexWrinkleBand(wrinklePosVertex.y, 0.43, 0.20, 0.12);
float vRightNasolabialMask = vertexWrinkleBand(wrinklePosVertex.x, 0.65, 0.10, 0.10) * vertexWrinkleBand(wrinklePosVertex.y, 0.43, 0.20, 0.12);
float vNoseMask = vertexWrinkleBand(wrinklePosVertex.x, 0.50, 0.12, 0.08) * vertexWrinkleBand(wrinklePosVertex.y, 0.48, 0.16, 0.12);
float macroDisplacement =
  uWrinkleForeheadLeft * vForeheadLeftMask * 0.0045 +
  uWrinkleForeheadRight * vForeheadRightMask * 0.0045 +
  uWrinkleGlabella * vGlabellaMask * 0.006 +
  uWrinkleNasolabialLeft * vLeftNasolabialMask * 0.0042 +
  uWrinkleNasolabialRight * vRightNasolabialMask * 0.0042 +
  uWrinkleNose * vNoseMask * 0.0038;
transformed += normalize(objectNormal) * macroDisplacement * uSkinDisplacementStrength;
vWrinkleLocalPosition = transformed;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vWrinkleLocalPosition;
uniform vec3 uWrinkleBBoxMin;
uniform vec3 uWrinkleBBoxMax;
uniform float uWrinkleForeheadLeft;
uniform float uWrinkleForeheadRight;
uniform float uWrinkleGlabella;
uniform float uWrinkleCrowLeft;
uniform float uWrinkleCrowRight;
uniform float uWrinkleNasolabialLeft;
uniform float uWrinkleNasolabialRight;
uniform float uWrinkleNose;
uniform vec3 uSkinEpidermalTint;
uniform vec3 uSkinDermalTint;
uniform vec3 uSkinDeepTint;
uniform float uSkinScatterStrength;
uniform float uSkinFlushStrength;
uniform float uSkinOilStrength;
uniform float uSkinCoolStrength;
uniform float uSkinAoStrength;
uniform float uSkinDisplacementStrength;
uniform float uSkinSssStrength;
uniform float uSkinThicknessLip;
uniform float uSkinThicknessNose;
uniform float uSkinThicknessUnderEye;
uniform float uSkinThicknessCheek;
uniform float uSkinThicknessForehead;

vec3 gSkinPos;
float gSkinLeftForehead;
float gSkinRightForehead;
float gSkinGlabella;
float gSkinLeftCrow;
float gSkinRightCrow;
float gSkinLeftNasolabial;
float gSkinRightNasolabial;
float gSkinNose;
float gSkinUnderEye;
float gSkinLip;
float gSkinCheek;
float gSkinForehead;
float gSkinCore;
float gSebumZone;
float gPoreNoise;
float gCapillaryNoise;
float gBlotchNoise;
float gMelaninNoise;
float gFuzzNoise;
float gPoreCells;
float gPoreClusters;
float gThicknessField;

float wrinkleBand(float value, float center, float radius, float blur) {
  return 1.0 - smoothstep(radius, radius + blur, abs(value - center));
}

float wrinkleRidge(float phase) {
  return smoothstep(0.58, 0.98, sin(phase) * 0.5 + 0.5);
}

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.35));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise21(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm21(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += noise21(p) * amplitude;
    p = p * 2.03 + vec2(17.1, 9.2);
    amplitude *= 0.5;
  }
  return value;
}

vec2 hash22(vec2 p) {
  float n = hash21(p);
  return fract(vec2(n, n * 1.3723 + 0.217));
}

float voronoi21(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  float minDist = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 point = hash22(cell + offset);
      vec2 delta = offset + point - local;
      minDist = min(minDist, length(delta));
    }
  }
  return minDist;
}

float wrinkleCrease(vec2 uv, vec2 dir, float frequency, float thickness, float breakup, float seed) {
  vec2 basis = normalize(dir);
  vec2 ortho = vec2(-basis.y, basis.x);
  float warp = (fbm21(uv * 8.0 + seed) - 0.5) * breakup;
  float lineCoord = dot(uv, basis) * frequency + warp * 6.0;
  float crossFade = 0.65 + fbm21(uv * 5.5 + seed * 1.7) * 0.7;
  float stripe = wrinkleRidge(lineCoord) * crossFade;
  float edgeSoftness = thickness + (fbm21(uv * 12.0 + ortho * seed) - 0.5) * 0.08;
  return smoothstep(1.0 - max(edgeSoftness, 0.06), 1.0, stripe);
}

float skinSaturate(float value) {
  return clamp(value, 0.0, 1.0);
}

float skinLeftForeheadMask(vec3 wrinklePos) {
  return wrinkleBand(wrinklePos.y, 0.80, 0.14, 0.10) * wrinkleBand(wrinklePos.x, 0.34, 0.17, 0.12);
}

float skinRightForeheadMask(vec3 wrinklePos) {
  return wrinkleBand(wrinklePos.y, 0.80, 0.14, 0.10) * wrinkleBand(wrinklePos.x, 0.66, 0.17, 0.12);
}

float skinGlabellaMask(vec3 wrinklePos) {
  return wrinkleBand(wrinklePos.y, 0.65, 0.12, 0.08) * wrinkleBand(wrinklePos.x, 0.50, 0.10, 0.08);
}

float skinLeftCrowMask(vec3 wrinklePos) {
  return wrinkleBand(wrinklePos.x, 0.24, 0.12, 0.10) * wrinkleBand(wrinklePos.y, 0.58, 0.16, 0.10);
}

float skinRightCrowMask(vec3 wrinklePos) {
  return wrinkleBand(wrinklePos.x, 0.76, 0.12, 0.10) * wrinkleBand(wrinklePos.y, 0.58, 0.16, 0.10);
}

float skinLeftNasolabialMask(vec3 wrinklePos) {
  return wrinkleBand(wrinklePos.x, 0.35, 0.10, 0.10) * wrinkleBand(wrinklePos.y, 0.43, 0.20, 0.12);
}

float skinRightNasolabialMask(vec3 wrinklePos) {
  return wrinkleBand(wrinklePos.x, 0.65, 0.10, 0.10) * wrinkleBand(wrinklePos.y, 0.43, 0.20, 0.12);
}

float skinNoseMask(vec3 wrinklePos) {
  return wrinkleBand(wrinklePos.x, 0.50, 0.12, 0.08) * wrinkleBand(wrinklePos.y, 0.48, 0.16, 0.12);
}

float skinUnderEyeMask(vec3 wrinklePos) {
  float left = wrinkleBand(wrinklePos.x, 0.30, 0.12, 0.08) * wrinkleBand(wrinklePos.y, 0.56, 0.08, 0.06);
  float right = wrinkleBand(wrinklePos.x, 0.70, 0.12, 0.08) * wrinkleBand(wrinklePos.y, 0.56, 0.08, 0.06);
  return skinSaturate(left + right);
}

float skinLipMask(vec3 wrinklePos) {
  return wrinkleBand(wrinklePos.x, 0.50, 0.18, 0.10) * wrinkleBand(wrinklePos.y, 0.31, 0.10, 0.08);
}`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
float leftForeheadLines = wrinkleCrease(gSkinPos.xy, vec2(1.0, 0.08), 32.0, 0.2, 0.35, 1.7);
float rightForeheadLines = wrinkleCrease(gSkinPos.xy, vec2(1.0, -0.08), 32.0, 0.2, 0.35, 2.3);
float glabellaLines = wrinkleCrease(gSkinPos.xy, vec2(0.08, 1.0), 42.0, 0.16, 0.22, 3.1);
float leftCrowLines = wrinkleCrease(gSkinPos.xy, vec2(0.84, 0.54), 30.0, 0.18, 0.3, 4.9);
float rightCrowLines = wrinkleCrease(gSkinPos.xy, vec2(-0.84, 0.54), 30.0, 0.18, 0.3, 5.7);
float leftNasolabialLines = wrinkleCrease(gSkinPos.xy, vec2(-0.42, 0.9), 28.0, 0.17, 0.28, 6.1);
float rightNasolabialLines = wrinkleCrease(gSkinPos.xy, vec2(0.42, 0.9), 28.0, 0.17, 0.28, 6.9);
float noseLines = wrinkleCrease(gSkinPos.xy, vec2(0.08, 1.0), 24.0, 0.14, 0.18, 7.4);
float poreCavities = smoothstep(0.19, 0.03, gPoreCells) * smoothstep(0.28, 0.72, gPoreClusters) * gSebumZone;
float poreRidges = smoothstep(0.24, 0.52, gPoreCells) * gSebumZone * 0.45;
float detailStrength = mix(0.3, 2.0, skinSaturate(uSkinDisplacementStrength * 0.5));

float wrinkleHeight =
  uWrinkleForeheadLeft * gSkinLeftForehead * leftForeheadLines * 0.010 +
  uWrinkleForeheadRight * gSkinRightForehead * rightForeheadLines * 0.010 +
  uWrinkleGlabella * gSkinGlabella * glabellaLines * 0.014 +
  uWrinkleCrowLeft * gSkinLeftCrow * leftCrowLines * 0.010 +
  uWrinkleCrowRight * gSkinRightCrow * rightCrowLines * 0.010 +
  uWrinkleNasolabialLeft * gSkinLeftNasolabial * leftNasolabialLines * 0.011 +
  uWrinkleNasolabialRight * gSkinRightNasolabial * rightNasolabialLines * 0.011 +
  uWrinkleNose * gSkinNose * noseLines * 0.008;

float poreHeight = poreCavities * 0.0035 - poreRidges * 0.0016;
float microGrain = (fbm21(gSkinPos.xy * vec2(260.0, 310.0) + vec2(2.4, 5.3)) - 0.5) * 0.0012 * gSkinCore;

vec2 wrinkleGrad = vec2(dFdx(wrinkleHeight), dFdy(wrinkleHeight)) * (4.0 + detailStrength * 2.8);
vec2 poreGrad = vec2(dFdx(poreHeight + microGrain), dFdy(poreHeight + microGrain)) * (14.0 + detailStrength * 20.0);
normal = normalize(normal + vec3(-wrinkleGrad.x - poreGrad.x, -wrinkleGrad.y - poreGrad.y, 0.0));`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
{
gSkinPos = clamp((vWrinkleLocalPosition - uWrinkleBBoxMin) / max(uWrinkleBBoxMax - uWrinkleBBoxMin, vec3(0.0001)), vec3(0.0), vec3(1.0));
gSkinLeftForehead = skinLeftForeheadMask(gSkinPos);
gSkinRightForehead = skinRightForeheadMask(gSkinPos);
gSkinGlabella = skinGlabellaMask(gSkinPos);
gSkinLeftCrow = skinLeftCrowMask(gSkinPos);
gSkinRightCrow = skinRightCrowMask(gSkinPos);
gSkinLeftNasolabial = skinLeftNasolabialMask(gSkinPos);
gSkinRightNasolabial = skinRightNasolabialMask(gSkinPos);
gSkinNose = skinNoseMask(gSkinPos);
gSkinUnderEye = skinUnderEyeMask(gSkinPos);
gSkinLip = skinLipMask(gSkinPos);
gSkinCheek = skinSaturate(gSkinLeftNasolabial + gSkinRightNasolabial + gSkinLeftCrow * 0.35 + gSkinRightCrow * 0.35);
gSkinForehead = skinSaturate(gSkinLeftForehead + gSkinRightForehead + gSkinGlabella * 0.7);
gSkinCore = skinSaturate(gSkinCheek * 0.7 + gSkinNose * 0.75 + gSkinForehead * 0.4);
gSebumZone = skinSaturate(gSkinNose * 1.15 + gSkinForehead * 0.82 + gSkinCheek * 0.16);
gPoreNoise = sin(gSkinPos.x * 180.0) * sin(gSkinPos.y * 210.0) * 0.5 + 0.5;
gCapillaryNoise = fbm21(gSkinPos.xy * vec2(9.0, 13.0) + vec2(1.7, 4.2));
gBlotchNoise = fbm21(gSkinPos.xy * vec2(23.0, 19.0) + vec2(7.3, 2.1));
gMelaninNoise = fbm21(gSkinPos.xy * vec2(15.0, 17.0) + vec2(9.4, 3.8));
gFuzzNoise = fbm21(gSkinPos.xy * vec2(120.0, 135.0) + vec2(3.0, 7.2));
gPoreCells = voronoi21(gSkinPos.xy * vec2(180.0, 220.0));
gPoreClusters = fbm21(gSkinPos.xy * vec2(42.0, 54.0) + vec2(3.7, 1.8));
gThicknessField = skinSaturate(
  gSkinLip * uSkinThicknessLip +
  gSkinNose * uSkinThicknessNose +
  gSkinUnderEye * uSkinThicknessUnderEye +
  gSkinCheek * uSkinThicknessCheek +
  gSkinForehead * uSkinThicknessForehead
);
float epidermalMix = 0.42 + gSkinCore * (0.14 + gPoreNoise * 0.03) + gSkinForehead * 0.05;
float dermalMix = 0.035 + gSkinCheek * (0.055 + uSkinFlushStrength * 0.08) + gSkinNose * (0.03 + uSkinFlushStrength * 0.04);
float coolMix = (1.0 - gSkinCore) * (0.012 + uSkinCoolStrength * 0.02);
vec3 capillaryTint = uSkinDermalTint * ((gCapillaryNoise - 0.5) * 0.08 + gBlotchNoise * 0.055) * (gSkinCheek * 0.95 + gSkinNose * 0.4 + gSkinForehead * 0.18);
vec3 melaninTint = vec3(0.08, 0.055, 0.035) * ((gMelaninNoise - 0.5) * 0.08) * gSkinCore;
float oilLift = gSebumZone * (0.04 + fbm21(gSkinPos.xy * vec2(38.0, 41.0) + vec2(4.4, 8.1)) * 0.03);
float thicknessLift = max(gThicknessField - 0.55, 0.0) * (0.016 + uSkinSssStrength * 0.03);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uSkinEpidermalTint, skinSaturate(epidermalMix));
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb + uSkinDermalTint * dermalMix, skinSaturate(dermalMix));
diffuseColor.rgb += capillaryTint - melaninTint;
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb - vec3(0.020, 0.012, 0.008), coolMix);
diffuseColor.rgb += oilLift * vec3(0.018, 0.012, 0.008);
diffuseColor.rgb += uSkinDermalTint * thicknessLift * (gSkinLip * 0.9 + gSkinUnderEye * 0.65 + gSkinNose * 0.45 + gSkinCheek * 0.35 + gSkinForehead * 0.2);
}
`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <aomap_fragment>',
      `#include <aomap_fragment>
{
float poreCavitiesAo = smoothstep(0.19, 0.03, gPoreCells) * smoothstep(0.28, 0.72, gPoreClusters) * skinSaturate(gSkinNose * 1.05 + gSkinCheek * 0.35);
float aoResponse = 0.22 + uSkinAoStrength * 0.92;
float skinAo = clamp(1.0 - (poreCavitiesAo * 0.34 + gSkinCheek * 0.08 + gSkinNose * 0.1 + gSkinForehead * 0.03) * aoResponse, 0.48, 1.0);
reflectedLight.indirectDiffuse *= skinAo;
reflectedLight.directDiffuse *= mix(1.0, skinAo, 0.42);
}
`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <output_fragment>',
      `{
  float skinViewDirSign = 1.0;
  vec3 skinViewDir = normalize(vViewPosition * skinViewDirSign);
float skinFresnel = pow(1.0 - skinSaturate(abs(dot(normalize(normal), skinViewDir))), 2.4);
float forwardScatter = pow(skinSaturate(1.0 - abs(dot(normalize(normal), skinViewDir))), 3.0);
    float poreSparkle = smoothstep(0.08, 0.02, voronoi21(gSkinPos.xy * vec2(190.0, 230.0))) * gSebumZone;
    float vellum = pow(skinSaturate(1.0 - abs(dot(normalize(normal), skinViewDir))), 5.5) * (0.32 + gFuzzNoise * 0.28) * (gSkinCheek * 0.8 + gSkinForehead * 0.55 + gSkinNose * 0.35);
float subsurfaceWrap = pow(skinSaturate(1.0 - abs(dot(normalize(normal), skinViewDir))), 1.8);
    float sssResponse = 0.18 + uSkinSssStrength;
    vec3 subdermalLayer = uSkinDermalTint * (0.05 + uSkinScatterStrength * 0.18) * sssResponse * skinFresnel * (gSkinCheek * 0.9 + gSkinNose * 0.45 + gSkinForehead * 0.22 + gSkinUnderEye * 0.3 + gSkinLip * 0.42);
    vec3 deepTissueLayer = uSkinDeepTint * (0.022 + uSkinFlushStrength * 0.055) * sssResponse * forwardScatter * (gSkinNose * 0.7 + gSkinCheek * 0.35 + gSkinLip * 0.28);
      vec3 transmissionLikeScatter = mix(uSkinDermalTint, vec3(1.0, 0.72, 0.66), 0.35) * (0.028 + uSkinScatterStrength * 0.11) * sssResponse * gThicknessField * subsurfaceWrap;
      vec3 oilSheen = vec3(1.0, 0.94, 0.9) * (0.016 + uSkinOilStrength * 0.06) * pow(skinFresnel, 3.4) * (gSkinNose * 0.95 + gSkinForehead * 0.65 + gSkinCheek * 0.28);
      vec3 poreSpec = vec3(1.0, 0.93, 0.88) * poreSparkle * (0.008 + uSkinOilStrength * 0.02) * pow(skinFresnel, 6.0);
      vec3 vellumLayer = vec3(1.0, 0.82, 0.72) * vellum * 0.05;
    outgoingLight += subdermalLayer + deepTissueLayer + transmissionLikeScatter + oilSheen + poreSpec + vellumLayer;
  #include <output_fragment>
}`
    );

    originalOnBeforeCompile?.(shader, renderer);
  };

  wrinkleMaterial.customProgramCacheKey = () => `${originalMaterial.uuid}:${BEAUTY_SHADER_VERSION}`;
  wrinkleMaterial.needsUpdate = true;
  return wrinkleMaterial;
}
