/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { useControls } from 'leva';
import Face from './components/Face';
import UI from './components/UI';
import WebcamEnvironment from './components/WebcamEnvironment';

export default function App() {
  const [color1, setColor1] = useState('#1e3a8a');
  const [color2, setColor2] = useState('#3b82f6');
  const [envMapIntensity, setEnvMapIntensity] = useState(1.5);
  const [ior, setIor] = useState(1.376);
  const [thickness, setThickness] = useState(0.1);
  const [screenBrightness, setScreenBrightness] = useState(1.0);
  const [lightingMode, setLightingMode] = useState<'webcam' | 'diagnostic'>('diagnostic');
  const [animationMode, setAnimationMode] = useState<'mouse' | 'calm' | 'saccades' | 'scanning'>('mouse');
  const [pupilSize, setPupilSize] = useState(0.15);

  const { faceScale, viewMode, showCustomEyes, eyeScale, eyePosX, eyePosY, eyePosZ, eyeRotX, eyeRotY, eyeRotZ } = useControls({
    faceScale: { value: 3.0, min: 0.1, max: 10, step: 0.1 },
    viewMode: { options: ['beauty', 'wireframe', 'normals', 'depth', 'basic'] },
    showCustomEyes: true,
    eyeScale: { value: 0.85, min: 0.01, max: 5, step: 0.01 },
    eyePosX: { value: 0, min: -2, max: 2, step: 0.01 },
    eyePosY: { value: 0, min: -2, max: 2, step: 0.01 },
    eyePosZ: { value: 0.02, min: -2, max: 2, step: 0.01 },
    eyeRotX: { value: 0, min: -Math.PI, max: Math.PI, step: 0.01 },
    eyeRotY: { value: 0, min: -Math.PI, max: Math.PI, step: 0.01 },
    eyeRotZ: { value: 0, min: -Math.PI, max: Math.PI, step: 0.01 },
  });

  return (
    <div className="w-full h-screen bg-neutral-950 text-white overflow-hidden relative">
      <Canvas shadows camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 2]}>
        <OrbitControls enablePan={false} enableZoom={true} minDistance={1.5} maxDistance={10} target={[0, 0, 0]} />
        <color attach="background" args={['#050505']} />
        
        {lightingMode === 'webcam' ? (
          <>
            <ambientLight intensity={0.2} />
            <spotLight position={[5, 5, 5]} angle={0.2} penumbra={0.5} intensity={4} castShadow shadow-mapSize={[1024, 1024]} />
            <pointLight position={[-5, -5, 5]} intensity={1} color="#abcdef" />
            <pointLight position={[0, 5, 2]} intensity={0.5} color="#ffffff" />
            <Suspense fallback={null}>
              <WebcamEnvironment screenBrightness={screenBrightness} />
            </Suspense>
          </>
        ) : (
          <>
            {/* Brutal Diagnostic Lighting */}
            <ambientLight intensity={0.2} />
            {/* Main Catchlight (Window/Softbox simulation) */}
            <spotLight position={[3, 3, 5]} angle={0.2} penumbra={0.2} intensity={15} decay={2} color="#ffffff" castShadow shadow-mapSize={[1024, 1024]} />
            {/* Hard Rim/Side Light */}
            <pointLight position={[-5, -2, 2]} intensity={10} distance={20} decay={2} color="#ffeedd" />
            <Suspense fallback={null}>
              <Environment preset="city" background blur={0.6} />
            </Suspense>
          </>
        )}
        
        <Suspense fallback={null}>
          <group position={[0, -0.5, 0]} scale={faceScale}>
            <Face 
              viewMode={viewMode} 
              showCustomEyes={showCustomEyes}
              eyeScale={eyeScale}
              eyePosX={eyePosX}
              eyePosY={eyePosY}
              eyePosZ={eyePosZ}
              eyeRotX={eyeRotX}
              eyeRotY={eyeRotY}
              eyeRotZ={eyeRotZ}
              eyeProps={{ color1, color2, envMapIntensity, ior, thickness, animationMode, pupilSize }}
            />
          </group>
        </Suspense>
        
        <ContactShadows position={[0, -1.2, 0]} opacity={0.6} scale={10} blur={2.5} far={4} />
        
        <EffectComposer>
          <Bloom luminanceThreshold={1.0} mipmapBlur intensity={0.8} />
          <Noise opacity={0.02} />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
      </Canvas>
      
      <UI 
        color1={color1} 
        setColor1={setColor1} 
        color2={color2} 
        setColor2={setColor2} 
        envMapIntensity={envMapIntensity}
        setEnvMapIntensity={setEnvMapIntensity}
        ior={ior}
        setIor={setIor}
        thickness={thickness}
        setThickness={setThickness}
        screenBrightness={screenBrightness}
        setScreenBrightness={setScreenBrightness}
        lightingMode={lightingMode}
        setLightingMode={setLightingMode}
        animationMode={animationMode}
        setAnimationMode={setAnimationMode}
        pupilSize={pupilSize}
        setPupilSize={setPupilSize}
      />
    </div>
  );
}
