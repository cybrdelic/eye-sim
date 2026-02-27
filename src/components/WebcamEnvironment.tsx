import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { Environment } from '@react-three/drei';

interface WebcamEnvironmentProps {
  screenBrightness: number;
}

export default function WebcamEnvironment({ screenBrightness }: WebcamEnvironmentProps) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    const vid = document.createElement('video');
    vid.autoplay = true;
    vid.muted = true;
    vid.playsInline = true;
    vid.crossOrigin = "anonymous";

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then((stream) => {
        vid.srcObject = stream;
        vid.play().catch(e => console.error("Video play failed", e));
        setVideo(vid);
      })
      .catch((err) => {
        console.error("Error accessing webcam:", err);
      });

    return () => {
      if (vid.srcObject) {
        const stream = vid.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  if (!video) return null;

  return (
    <Environment frames={Infinity} resolution={1024} background={false}>
      {/* Dark room background so the eye isn't washed out by global light */}
      <mesh scale={100}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#020202" side={THREE.BackSide} toneMapped={false} />
      </mesh>

      {/* The "Monitor" displaying the webcam - curved for natural wrap-around reflection */}
      <mesh position={[0, 0, 10]} rotation={[0, Math.PI, 0]}>
        <cylinderGeometry args={[12, 12, 10, 64, 1, true, -Math.PI / 6, Math.PI / 3]} />
        <meshBasicMaterial 
          side={THREE.DoubleSide} 
          toneMapped={false}
          color={new THREE.Color(screenBrightness, screenBrightness, screenBrightness)}
        >
          <videoTexture attach="map" args={[video]} colorSpace={THREE.SRGBColorSpace} repeat={[-1, 1]} offset={[1, 0]} />
        </meshBasicMaterial>
      </mesh>
      
      {/* Simulated Window Light (Soft Box) for a realistic secondary catchlight */}
      <mesh position={[-15, 5, 5]} rotation={[0, Math.PI / 3, 0]}>
        <planeGeometry args={[8, 8]} />
        <meshBasicMaterial 
          color={new THREE.Color(screenBrightness, screenBrightness, screenBrightness)} 
          toneMapped={false} 
          side={THREE.DoubleSide} 
        />
      </mesh>

      {/* Subtle Fill Light */}
      <mesh position={[15, -5, 5]} rotation={[0, -Math.PI / 3, 0]}>
        <planeGeometry args={[8, 8]} />
        <meshBasicMaterial 
          color={new THREE.Color(screenBrightness * 0.2, screenBrightness * 0.3, screenBrightness * 0.4)} 
          toneMapped={false} 
          side={THREE.DoubleSide} 
        />
      </mesh>
    </Environment>
  );
}
