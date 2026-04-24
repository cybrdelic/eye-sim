import * as THREE from 'three';
import { uniform } from 'three/tsl';

export type TSLUniformNode<T = number> = { value: T } & Record<string, any>;

export type SkinUniforms = {
  uBrowRaise: TSLUniformNode<number>;
  uBrowCompress: TSLUniformNode<number>;
  uSquint: TSLUniformNode<number>;
  uSmile: TSLUniformNode<number>;
  uNoseSneer: TSLUniformNode<number>;
  uMouthCompress: TSLUniformNode<number>;
  uFlushStrength: TSLUniformNode<number>;
  uScatterStrength: TSLUniformNode<number>;
  uOilStrength: TSLUniformNode<number>;
  uAoStrength: TSLUniformNode<number>;
  uRoughnessOffset: TSLUniformNode<number>;
  uWrinkleDepth: TSLUniformNode<number>;
  uEpidermalTint: TSLUniformNode<THREE.Color>;
  uDermalTint: TSLUniformNode<THREE.Color>;
  uDeepTint: TSLUniformNode<THREE.Color>;
};

export function createSkinUniforms(): SkinUniforms {
  return {
    uBrowRaise: uniform(0),
    uBrowCompress: uniform(0),
    uSquint: uniform(0),
    uSmile: uniform(0),
    uNoseSneer: uniform(0),
    uMouthCompress: uniform(0),
    uFlushStrength: uniform(0.42),
    uScatterStrength: uniform(0.72),
    uOilStrength: uniform(0.28),
    uAoStrength: uniform(0.38),
    uRoughnessOffset: uniform(-0.04),
    uWrinkleDepth: uniform(1.15),
    uEpidermalTint: uniform(new THREE.Color('#f2ddd0')),
    uDermalTint: uniform(new THREE.Color('#9a4a34')),
    uDeepTint: uniform(new THREE.Color('#5b2a1d')),
  } as SkinUniforms;
}
