import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
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
  blink?: number;
  saccadeTarget?: THREE.Vector2;
  trackedGaze?: {
    yaw: number;
    pitch: number;
  };
  rotationLimits?: {
    yawMax: number;
    pitchUpMax: number;
    pitchDownMax: number;
    source?: 'raycast' | 'fallback' | string;
  };
}

export default function Eye({
  color1,
  color2,
  envMapIntensity,
  ior,
  thickness,
  animationMode,
  pupilSize,
  isRightEye = false,
  blink = 0,
  saccadeTarget,
  trackedGaze,
  rotationLimits,
}: EyeProps) {
  const showMuscles = false;
  const eyeRootRef = useRef<THREE.Group>(null);
  const eyeballGroupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  const muscleRefs = useRef<Array<THREE.Mesh | null>>([]);

  const muscleAnchors = useMemo(
    () => [
      new THREE.Vector3(0.35, 0.0, -1.55),
      new THREE.Vector3(-0.35, 0.0, -1.55),
      new THREE.Vector3(0.0, 0.35, -1.55),
      new THREE.Vector3(0.0, -0.35, -1.55),
    ],
    []
  );
  const muscleAttachmentsLocal = useMemo(
    () => [
      new THREE.Vector3(0.78, 0.0, -0.35),
      new THREE.Vector3(-0.78, 0.0, -0.35),
      new THREE.Vector3(0.0, 0.78, -0.35),
      new THREE.Vector3(0.0, -0.78, -0.35),
    ],
    []
  );
  const muscleRestLengths = useMemo(
    () => muscleAnchors.map((a, i) => a.distanceTo(muscleAttachmentsLocal[i])),
    [muscleAnchors, muscleAttachmentsLocal]
  );
  const muscleTwistAngles = useMemo(() => [0.12, -0.12, 0.12, -0.12], []);
  const muscleColor = useMemo(() => new THREE.Color(0.8, 0.2, 0.2), []);

  const camera = useThree((s) => s.camera);
  const pointer = useThree((s) => s.pointer);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const tmpEyeWorldPos = useMemo(() => new THREE.Vector3(), []);
  const tmpParentWorldQuat = useMemo(() => new THREE.Quaternion(), []);
  const tmpDirWorld = useMemo(() => new THREE.Vector3(), []);
  const tmpDirLocal = useMemo(() => new THREE.Vector3(), []);
  const tmpTargetWorld = useMemo(() => new THREE.Vector3(), []);

  const tmpQ = useMemo(() => new THREE.Quaternion(), []);
  const tmpA = useMemo(() => new THREE.Vector3(), []);
  const tmpB = useMemo(() => new THREE.Vector3(), []);
  const tmpMid = useMemo(() => new THREE.Vector3(), []);
  const tmpDir = useMemo(() => new THREE.Vector3(), []);
  const tmpUp = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const tmpFromY = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const tmpTwist = useMemo(() => new THREE.Quaternion(), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(Math.max(delta, 0), 1 / 10);

    let targetYaw = 0;
    let targetPitch = 0;

    // Blink-aware openness (0 closed -> 1 open)
    const openness = THREE.MathUtils.clamp(1 - blink, 0, 1);

    // Rotation limits (radians).
    // If we have raycast-derived limits from the actual eyelid geometry, clamp directly to them.
    // Otherwise fall back to conservative heuristic limits that tighten as the eye closes.
    const hasRaycastLimits = rotationLimits?.source === 'raycast';
    let yawMax = rotationLimits?.yawMax ?? 0.55;
    let pitchUpMax = rotationLimits?.pitchUpMax ?? 0.35;
    let pitchDownMax = rotationLimits?.pitchDownMax ?? 0.45;

    if (!hasRaycastLimits) {
      const yawClosed = 0.18;
      const pitchUpClosed = 0.12;
      const pitchDownClosed = 0.16;
      yawMax = THREE.MathUtils.lerp(yawClosed, yawMax, openness);
      pitchUpMax = THREE.MathUtils.lerp(pitchUpClosed, pitchUpMax, openness);
      pitchDownMax = THREE.MathUtils.lerp(pitchDownClosed, pitchDownMax, openness);
    }

    // Speed limit (rad/s) to prevent snapping/tunneling artifacts.
    const maxAngularSpeed = THREE.MathUtils.lerp(1.5, 4.5, openness);

    if (trackedGaze) {
      targetYaw = trackedGaze.yaw;
      targetPitch = trackedGaze.pitch;
    } else if (animationMode === 'mouse') {
      // Non-naive mouse gaze:
      // Cast a ray from the camera through the pointer and pick a target point at a fixed depth.
      // Each eye then rotates to look at the same 3D target -> natural vergence.
      raycaster.setFromCamera(pointer, camera);

      // Distance in world units in front of camera.
      // Small distances increase vergence; keep moderate so it feels stable.
      const focusDist = 3.0;
      tmpTargetWorld.copy(raycaster.ray.direction).multiplyScalar(focusDist).add(raycaster.ray.origin);

      const eyeGroup = eyeballGroupRef.current;
      const parent = eyeGroup?.parent as THREE.Object3D | null;
      if (eyeGroup && parent) {
        eyeGroup.getWorldPosition(tmpEyeWorldPos);
        parent.getWorldQuaternion(tmpParentWorldQuat);

        tmpDirWorld.copy(tmpTargetWorld).sub(tmpEyeWorldPos);
        if (tmpDirWorld.lengthSq() > 1e-10) {
          tmpDirWorld.normalize();

          // Convert the desired world direction into the eye's parent local space.
          tmpDirLocal.copy(tmpDirWorld).applyQuaternion(tmpParentWorldQuat.invert()).normalize();

          // With our eye convention, +Z is iris-forward.
          targetYaw = Math.atan2(tmpDirLocal.x, tmpDirLocal.z);
          targetPitch = -Math.asin(THREE.MathUtils.clamp(tmpDirLocal.y, -1, 1));
        }
      }
    } else if (animationMode === 'calm') {
      targetYaw = Math.sin(t * 0.5) * 0.15 + Math.sin(t * 0.2) * 0.1;
      targetPitch = Math.cos(t * 0.4) * 0.1 + Math.sin(t * 0.1) * 0.05;
    } else if (animationMode === 'saccades') {
      targetYaw = saccadeTarget?.x ?? 0;
      targetPitch = saccadeTarget?.y ?? 0;
    } else if (animationMode === 'scanning') {
      targetYaw = Math.sin(t * 1.2) * 0.5;
      targetPitch = Math.sin(t * 0.5) * 0.1;
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
      // When blinking, bias gaze back to center to avoid the iris “sliding under” lids.
      const centerBias = 1 - openness;
      targetYaw = THREE.MathUtils.lerp(targetYaw, 0, centerBias);
      targetPitch = THREE.MathUtils.lerp(targetPitch, 0, centerBias);

      // Clamp to physical limits.
      targetYaw = THREE.MathUtils.clamp(targetYaw, -yawMax, yawMax);
      targetPitch = THREE.MathUtils.clamp(targetPitch, -pitchUpMax, pitchDownMax);

      // Smooth with a speed limit (prevents tunneling/snapping).
      const curYaw = eyeballGroupRef.current.rotation.y;
      const curPitch = eyeballGroupRef.current.rotation.x;

      const yawDelta = THREE.MathUtils.clamp(targetYaw - curYaw, -maxAngularSpeed * dt, maxAngularSpeed * dt);
      const pitchDelta = THREE.MathUtils.clamp(targetPitch - curPitch, -maxAngularSpeed * dt, maxAngularSpeed * dt);

      // Apply small damping on top of speed limiting.
      const damp = THREE.MathUtils.lerp(10, 22, openness);
      const nextYaw = THREE.MathUtils.damp(curYaw, curYaw + yawDelta, damp, dt);
      const nextPitch = THREE.MathUtils.damp(curPitch, curPitch + pitchDelta, damp, dt);

      eyeballGroupRef.current.rotation.y = nextYaw;
      eyeballGroupRef.current.rotation.x = nextPitch;

      // Update extraocular muscles (simple strap model).
      // Anchor points are fixed in the socket (eyeRoot local), attachment points rotate with the eyeball.
      const root = eyeRootRef.current;
      if (root) {
        // Copy local quaternion (no scale/shear).
        tmpQ.copy(eyeballGroupRef.current.quaternion);

        for (let i = 0; i < 4; i++) {
          const m = muscleRefs.current[i];
          if (!m) continue;

          tmpA.copy(muscleAnchors[i]);

          // Rotate attachment by the eyeball quaternion (in root local space).
          tmpB.copy(muscleAttachmentsLocal[i]).applyQuaternion(tmpQ);

          tmpDir.copy(tmpB).sub(tmpA);
          const len = tmpDir.length();
          if (len < 1e-6) continue;
          tmpDir.multiplyScalar(1 / len);

          tmpMid.copy(tmpA).add(tmpB).multiplyScalar(0.5);
          m.position.copy(tmpMid);

          // Orient cylinder Y axis along the strap direction.
          m.quaternion.setFromUnitVectors(tmpFromY, tmpDir);

          // Scale: cylinder height is 1 in geometry local space.
          // Slight taper via X/Z scale based on stretch for a subtle “tension” feel.
          const restLen = muscleRestLengths[i] || len;
          const stretch = THREE.MathUtils.clamp((len - restLen) / Math.max(restLen, 1e-6), -0.25, 0.5);
          const thickness = 0.045 * (1 - 0.35 * stretch);
          m.scale.set(thickness, len, thickness);

          // Tiny twist to avoid a perfectly planar look (non-accumulating).
          tmpTwist.setFromAxisAngle(tmpUp, muscleTwistAngles[i] ?? 0);
          m.quaternion.multiply(tmpTwist);
        }
      }
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
          for(int i=0; i<3; i++) {
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

          float ao = smoothstep(1.0, 0.7, r);
          finalColor *= mix(0.3, 1.0, ao);
      }

      diffuseColor.rgb = finalColor;
      `
    );
  };

  // Generate a physically accurate corneal bulge geometry
  const corneaGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(1.006, 48, 48); // Slightly larger than sclera for refraction
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
          const bulge = f * 0.022; // reduced bulge height to avoid eyelid clipping
          pos.setZ(i, z + bulge);
        }
      }
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <group ref={eyeRootRef}>
      {/* Extraocular muscles (visual + stretch model) */}
      {showMuscles && (
        <group>
          {Array.from({ length: 4 }).map((_, i) => (
            <mesh
              key={`muscle-${i}`}
              ref={(r) => {
                muscleRefs.current[i] = r;
              }}
              castShadow
              receiveShadow
            >
              <cylinderGeometry args={[1, 1, 1, 8, 1, true]} />
              <meshStandardMaterial
                color={muscleColor}
                roughness={0.75}
                metalness={0.0}
              />
            </mesh>
          ))}
        </group>
      )}

      <group ref={eyeballGroupRef}>
      {/* Inner Eyeball (Sclera + Iris + Pupil) */}
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[1, 32, 32]} />
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
        />
      </mesh>
      </group>
    </group>
  );
}
