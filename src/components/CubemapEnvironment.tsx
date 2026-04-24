import { Environment } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import outdoorNegX from '../assets/cubemaps/outdoor/negx.jpg';
import outdoorNegY from '../assets/cubemaps/outdoor/negy.jpg';
import outdoorNegZ from '../assets/cubemaps/outdoor/negz.jpg';
import outdoorPosX from '../assets/cubemaps/outdoor/posx.jpg';
import outdoorPosY from '../assets/cubemaps/outdoor/posy.jpg';
import outdoorPosZ from '../assets/cubemaps/outdoor/posz.jpg';
import studioNegX from '../assets/cubemaps/studio/negx.jpg';
import studioNegY from '../assets/cubemaps/studio/negy.jpg';
import studioNegZ from '../assets/cubemaps/studio/negz.jpg';
import studioPosX from '../assets/cubemaps/studio/posx.jpg';
import studioPosY from '../assets/cubemaps/studio/posy.jpg';
import studioPosZ from '../assets/cubemaps/studio/posz.jpg';

type CubemapVariant = 'studio' | 'outdoor';

const CUBEMAP_URLS: Record<CubemapVariant, string[]> = {
  studio: [
    studioPosX,
    studioNegX,
    studioPosY,
    studioNegY,
    studioPosZ,
    studioNegZ,
  ],
  outdoor: [
    outdoorPosX,
    outdoorNegX,
    outdoorPosY,
    outdoorNegY,
    outdoorPosZ,
    outdoorNegZ,
  ],
};

interface CubemapEnvironmentProps {
  variant: CubemapVariant;
  background?: boolean;
}

export default function CubemapEnvironment({ variant, background: showBackground = true }: CubemapEnvironmentProps) {
  const [map, setMap] = useState<THREE.CubeTexture | null>(null);
  const textureRef = useRef<THREE.CubeTexture | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadingManager = new THREE.LoadingManager();
    loadingManager.onError = (url) => {
      console.error('[cubemap] failed to load face', url);
      if (!cancelled) {
        if (textureRef.current) {
          textureRef.current.dispose();
          textureRef.current = null;
        }
        setMap(null);
      }
    };

    const loader = new THREE.CubeTextureLoader(loadingManager);
    loader.load(
      CUBEMAP_URLS[variant],
      (nextMap) => {
        if (cancelled) {
          nextMap.dispose();
          return;
        }

        nextMap.colorSpace = THREE.SRGBColorSpace;
        if (textureRef.current) textureRef.current.dispose();
        textureRef.current = nextMap;
        setMap(nextMap);
      },
      undefined,
      () => {
        if (!cancelled) setMap(null);
      }
    );

    return () => {
      cancelled = true;
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
    };
  }, [variant]);

  if (!map) return null;

  return <Environment map={map} background={showBackground} />;
}
