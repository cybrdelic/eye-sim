import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface EyeProps {
  color1: string;
  color2: string;
  envMapIntensity: number;
  ior: number;
  thickness: number;
  animationMode: 'mouse' | 'calm' | 'saccades' | 'scanning';
  pupilSize: number;
  isRightEye?: boolean;
}

export default function Eye({ color1, color2, envMapIntensity, ior, thickness, animationMode, pupilSize, isRightEye = false }: EyeProps) {
  const eyeballGroupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const saccadeState = useRef({ nextMoveTime: 0, targetX: 0, targetY: 0 });
  
  useFrame((state) => {
    const { pointer, clock } = state;
    const t = clock.elapsedTime;
    
    let targetX = 0;
    let targetY = 0;
    let lerpSpeed = 0.08;

    if (animationMode === 'mouse') {
      targetX = (pointer.x * Math.PI) / 4;
      targetY = (pointer.y * Math.PI) / 4;
    } else if (animationMode === 'calm') {
      targetX = Math.sin(t * 0.5) * 0.15 + Math.sin(t * 0.2) * 0.1;
      targetY = Math.cos(t * 0.4) * 0.1 + Math.sin(t * 0.1) * 0.05;
      lerpSpeed = 0.02;
    } else if (animationMode === 'saccades') {
      if (t > saccadeState.current.nextMoveTime) {
        // 80% chance for small micro-saccade, 20% chance for large dart
        const isMacro = Math.random() > 0.8;
        if (isMacro) {
          saccadeState.current.targetX = (Math.random() - 0.5) * 1.2;
          saccadeState.current.targetY = (Math.random() - 0.5) * 0.8;
        } else {
          saccadeState.current.targetX += (Math.random() - 0.5) * 0.2;
          saccadeState.current.targetY += (Math.random() - 0.5) * 0.2;
        }
        
        // Clamp values to keep eye from rolling back into head
        saccadeState.current.targetX = THREE.MathUtils.clamp(saccadeState.current.targetX, -0.8, 0.8);
        saccadeState.current.targetY = THREE.MathUtils.clamp(saccadeState.current.targetY, -0.5, 0.5);
        
        const pause = isMacro ? (Math.random() * 1.0 + 0.5) : (Math.random() * 0.2 + 0.05);
        saccadeState.current.nextMoveTime = t + pause;
      }
      targetX = saccadeState.current.targetX;
      targetY = saccadeState.current.targetY;
      lerpSpeed = 0.4; // fast snap
    } else if (animationMode === 'scanning') {
      targetX = Math.sin(t * 1.2) * 0.5;
      targetY = Math.sin(t * 0.5) * 0.1;
      lerpSpeed = 0.05;
    }

    // Dynamic pupil size
    let currentPupilSize = pupilSize;
    currentPupilSize += Math.sin(t * 2.0) * 0.005 + Math.sin(t * 0.5) * 0.01; // Hippus

    if (materialRef.current && materialRef.current.userData.shader) {
      materialRef.current.userData.shader.uniforms.uTime.value = t;
      materialRef.current.userData.shader.uniforms.uIrisColor1.value.set(color1);
      materialRef.current.userData.shader.uniforms.uIrisColor2.value.set(color2);
      
      if (!materialRef.current.userData.shader.uniforms.uPupilSize) {
          materialRef.current.userData.shader.uniforms.uPupilSize = { value: currentPupilSize };
      } else {
          materialRef.current.userData.shader.uniforms.uPupilSize.value = currentPupilSize;
      }
    }
    
    if (eyeballGroupRef.current) {
      eyeballGroupRef.current.rotation.y = THREE.MathUtils.lerp(eyeballGroupRef.current.rotation.y, targetX, lerpSpeed);
      eyeballGroupRef.current.rotation.x = THREE.MathUtils.lerp(eyeballGroupRef.current.rotation.x, -targetY, lerpSpeed);
    }
  });

  const onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uIrisColor1 = { value: new THREE.Color(color1) };
    shader.uniforms.uIrisColor2 = { value: new THREE.Color(color2) };
    shader.uniforms.uPupilSize = { value: pupilSize };
    
    if (materialRef.current) {
      materialRef.current.userData.shader = shader;
    }

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `
      #include <common>
      varying vec3 vOriginalPosition;
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      vec3 transformed = vec3(position);
      vOriginalPosition = position;
      
      float r = length(position.xy);
      float irisRadius = 0.46;
      
      if (position.z > 0.0 && r < irisRadius) {
         float depth = 0.2; // Increased depth for more parallax
         float bowl = 1.0 - pow(r / irisRadius, 2.0);
         transformed.z -= bowl * depth;
      }
      `
    );

    // Fix normals for the concave iris so lighting reacts correctly to the depth
    shader.vertexShader = shader.vertexShader.replace(
      '#include <beginnormal_vertex>',
      `
      vec3 objectNormal = vec3(normal);
      float r_n = length(position.xy);
      float irisRadius_n = 0.46;
      if (position.z > 0.0 && r_n < irisRadius_n) {
         float dzdx = 2.0 * position.x * 0.2 / (irisRadius_n * irisRadius_n);
         float dzdy = 2.0 * position.y * 0.2 / (irisRadius_n * irisRadius_n);
         objectNormal = normalize(vec3(-dzdx, -dzdy, 1.0));
      }
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `
      #include <common>
      varying vec3 vOriginalPosition;
      uniform float uTime;
      uniform vec3 uIrisColor1;
      uniform vec3 uIrisColor2;
      uniform float uPupilSize;

      vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
      float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                 -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
        + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
          dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }
      
      float fbm(vec2 p) {
          float f = 0.0;
          float amp = 0.5;
          for(int i=0; i<5; i++) {
              f += amp * snoise(p);
              p *= 2.0;
              amp *= 0.5;
          }
          return f;
      }
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      
      vec3 p = normalize(vOriginalPosition);
      vec3 finalColor = vec3(1.0);
      
      if (p.z < -0.2) {
          finalColor = vec3(0.8, 0.2, 0.2);
      } else {
          float r = length(p.xy);
          float a = atan(p.y, p.x);
          
          float pupilBaseRadius = uPupilSize;
          float pupilScallop = fbm(vec2(a * 12.0, 0.0)) * 0.015;
          float pupilRadius = pupilBaseRadius + pupilScallop;
          
          float irisRadius = 0.46;
          float normalizedR = clamp((r - pupilRadius) / (irisRadius - pupilRadius), 0.0, 1.0);
          
          // SCLERA
          vec3 scleraColor = vec3(0.92, 0.90, 0.88);
          float pinkness = smoothstep(0.6, 1.0, abs(p.x)) * smoothstep(0.0, 0.5, r);
          scleraColor = mix(scleraColor, vec3(0.85, 0.4, 0.4), pinkness * 0.6);
          float yellowing = fbm(vec2(p.x * 2.0, p.y * 2.0)) * smoothstep(0.5, 0.8, r);
          scleraColor = mix(scleraColor, vec3(0.9, 0.85, 0.6), yellowing * 0.4);
          
          float vNoise = fbm(vec2(a * 5.0, r * 3.0));
          float vein1 = 1.0 - abs(snoise(vec2(a * 8.0 + vNoise * 2.0, r * 10.0)));
          vein1 = pow(vein1, 30.0);
          float vein2 = 1.0 - abs(snoise(vec2(a * 20.0 - vNoise * 1.5, r * 20.0)));
          vein2 = pow(vein2, 20.0);
          
          float veinFade = smoothstep(0.48, 1.0, r);
          scleraColor = mix(scleraColor, vec3(0.4, 0.05, 0.05), vein1 * veinFade * 0.8);
          scleraColor = mix(scleraColor, vec3(0.6, 0.1, 0.1), vein2 * veinFade * 0.5);
          
          // IRIS
          float macroPigment = fbm(vec2(p.x * 3.0, p.y * 3.0));
          float fiberNoise = fbm(vec2(a * 30.0, normalizedR * 2.0));
          float fiberNoiseFine = fbm(vec2(a * 80.0, normalizedR * 5.0));
          
          float collaretteRadius = 0.35 + fbm(vec2(a * 8.0, 0.0)) * 0.05;
          float collaretteMask = smoothstep(collaretteRadius - 0.08, collaretteRadius, normalizedR) * 
                                 smoothstep(collaretteRadius + 0.12, collaretteRadius, normalizedR);
                                 
          float crypts = fbm(vec2(a * 12.0, normalizedR * 6.0));
          crypts = smoothstep(0.5, 0.9, crypts) * smoothstep(0.1, 0.8, normalizedR);
          
          vec3 color1 = uIrisColor1;
          vec3 color2 = uIrisColor2;
          vec3 irisBase = mix(color1, color2, normalizedR + macroPigment * 0.4);
          
          float fiberStrength = mix(0.5, 1.5, fiberNoise) * mix(0.8, 1.2, fiberNoiseFine);
          irisBase *= fiberStrength;
          irisBase = mix(irisBase, color1 * 1.5, collaretteMask * 0.6 * (1.0 - crypts));
          irisBase = mix(irisBase, irisBase * 0.1, crypts);
          
          float limbusNoise = fbm(vec2(a * 15.0, r * 20.0)) * 0.02;
          float limbusMask = smoothstep(0.42 + limbusNoise, 0.48 + limbusNoise, r);
          
          float pupilShadow = smoothstep(pupilRadius, pupilRadius + 0.1, r);
          irisBase *= mix(0.0, 1.0, pupilShadow); // Deep shadow near pupil to enhance depth
          
          if (r < pupilRadius) {
              finalColor = vec3(0.002); 
          } else {
              finalColor = mix(irisBase, scleraColor, limbusMask);
              float limbusDarkening = smoothstep(0.4, 0.46, r) * smoothstep(0.52, 0.46, r);
              finalColor *= mix(1.0, 0.4, limbusDarkening);
          }
          
          float topShadow = smoothstep(0.3, 0.9, p.y);
          finalColor *= mix(1.0, 0.2, topShadow);
          float bottomShadow = smoothstep(-0.3, -0.9, p.y);
          finalColor *= mix(1.0, 0.5, bottomShadow);
          
          float ao = smoothstep(1.0, 0.7, r);
          finalColor *= mix(0.3, 1.0, ao);
      }
      
      diffuseColor.rgb = finalColor;
      `
    );
  };

  const onCorneaBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `
      #include <common>
      varying vec3 vCorneaLocalPos;
      varying vec3 vCorneaWorldPos;
      `
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      vCorneaLocalPos = position;
      vCorneaWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `
      #include <common>
      varying vec3 vCorneaLocalPos;
      varying vec3 vCorneaWorldPos;
      `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      #include <dithering_fragment>
      
      // Anatomical fade: The cornea is highly glossy, but the sclera is less so.
      // We fade out the reflection layer as we move away from the iris towards the far edges.
      float corneaR = length(vCorneaLocalPos.xy);
      float anatomicalMask = 1.0 - smoothstep(0.5, 0.85, corneaR);
      
      // Eyelid occlusion: In real life, eyelids cover the top and bottom of the eye.
      // We fade out reflections at the top and bottom of the world space to simulate this.
      float topMask = 1.0 - smoothstep(0.35, 0.7, vCorneaWorldPos.y);
      float bottomMask = 1.0 - smoothstep(0.35, 0.7, -vCorneaWorldPos.y);
      
      // Apply the masks to the alpha channel to smoothly blend out the reflection layer
      gl_FragColor.a *= anatomicalMask * topMask * bottomMask;
      `
    );
  };

  // Generate a physically accurate corneal bulge geometry
  const corneaGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(1.01, 256, 256); // High poly for perfect normals
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (z > 0) {
        const r = Math.sqrt(x*x + y*y);
        const limbus = 0.55;
        if (r < limbus) {
          // Use a cubic Hermite spline for a perfectly smooth dome
          // This ensures the derivative is 0 at the tip (r=0) and at the base (r=limbus)
          // preventing any sharp points or seams that would break the reflection normals.
          const t = r / limbus;
          const f = 2.0 * t * t * t - 3.0 * t * t + 1.0;
          const bulge = f * 0.06; // reduced bulge height
          pos.setZ(i, z + bulge);
        }
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, []);
  
  return (
    <group ref={eyeballGroupRef}>
      {/* Inner Eyeball (Sclera + Iris + Pupil) */}
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[1, 128, 128]} />
        <meshStandardMaterial 
          ref={materialRef}
          onBeforeCompile={onBeforeCompile}
          roughness={0.8}
          metalness={0.0}
          envMapIntensity={0.1} // Prevent inner eye from looking like shiny plastic
        />
      </mesh>
      
      {/* Outer Cornea (Transparent, Reflective) */}
      <mesh geometry={corneaGeo} receiveShadow>
        <meshPhysicalMaterial 
          transmission={1}
          opacity={1}
          transparent
          roughness={0}
          ior={ior} // Realistic IOR for cornea
          thickness={thickness}
          envMapIntensity={envMapIntensity}
          clearcoat={1}
          clearcoatRoughness={0}
          onBeforeCompile={onCorneaBeforeCompile}
        />
      </mesh>
    </group>
  );
}
