import { Environment } from '@react-three/drei';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';

interface VideoFeedEnvironmentProps {
  video: HTMLVideoElement | null;
}

export default function VideoFeedEnvironment({ video }: VideoFeedEnvironmentProps) {
  const [ready, setReady] = useState(false);

  const texture = useMemo(() => {
    if (!video) {
      return null;
    }

    const nextTexture = new THREE.VideoTexture(video);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.mapping = THREE.EquirectangularReflectionMapping;
    nextTexture.minFilter = THREE.LinearFilter;
    nextTexture.magFilter = THREE.LinearFilter;
    nextTexture.wrapS = THREE.RepeatWrapping;
    nextTexture.repeat.x = -1;
    nextTexture.offset.x = 1;
    nextTexture.generateMipmaps = false;
    return nextTexture;
  }, [video]);

  useEffect(() => {
    if (!video) {
      setReady(false);
      return;
    }

    const updateReady = () => {
      setReady(video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA);
    };

    updateReady();
    video.addEventListener('loadeddata', updateReady);
    video.addEventListener('playing', updateReady);

    return () => {
      video.removeEventListener('loadeddata', updateReady);
      video.removeEventListener('playing', updateReady);
    };
  }, [video]);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  if (!video || !texture || !ready) return null;

  return <Environment map={texture} background />;
}
