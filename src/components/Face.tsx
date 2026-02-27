import { useGLTF } from '@react-three/drei';
import { useFrame, useThree, createPortal } from '@react-three/fiber';
import { useControls, folder } from 'leva';
import * as THREE from 'three';
import { useEffect, useMemo } from 'react';
import { KTX2Loader } from 'three-stdlib';
import Eye from './Eye';

export default function Face({ 
  viewMode = 'beauty', 
  showCustomEyes = true,
  eyeScale = 0.85,
  eyePosX = 0,
  eyePosY = 0,
  eyePosZ = 0,
  eyeRotX = 0,
  eyeRotY = 0,
  eyeRotZ = 0,
  eyeProps,
  ...props 
}: any) {
  const gl = useThree((state) => state.gl);

  // Load a properly rigged FACS model (contains ARKit blendshapes and bones)
  const { scene } = useGLTF('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/facecap.glb', true, true, (loader) => {
    const ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/basis/');
    ktx2Loader.detectSupport(gl);
    loader.setKTX2Loader(ktx2Loader);
  });

  // Extract all meshes that have morph targets (blendshapes)
  const morphMeshes = useMemo(() => {
    const meshes: THREE.Mesh[] = [];
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).morphTargetInfluences) {
        meshes.push(child as THREE.Mesh);
      }
    });
    return meshes;
  }, [scene]);

  // Extract nodes for skeletal animation (facecap uses regular objects, not Bones)
  const nodes = useMemo(() => {
    const n: Record<string, THREE.Object3D> = {};
    scene.traverse((child) => {
      n[child.name] = child;
    });
    return n;
  }, [scene]);

  // Setup Leva controls for FACS Blendshapes (Morph Targets)
  // These are standard ARKit facial action units
  const facsControls = useControls('FACS Blendshapes (Muscles)', {
    eyeBlink_L: { value: 0, min: 0, max: 1 },
    eyeBlink_R: { value: 0, min: 0, max: 1 },
    jawOpen: { value: 0, min: 0, max: 1 },
    mouthSmile_L: { value: 0, min: 0, max: 1 },
    mouthSmile_R: { value: 0, min: 0, max: 1 },
    mouthFunnel: { value: 0, min: 0, max: 1 },
    mouthPucker: { value: 0, min: 0, max: 1 },
    browInnerUp: { value: 0, min: 0, max: 1 },
    browDown_L: { value: 0, min: 0, max: 1 },
    browDown_R: { value: 0, min: 0, max: 1 },
    cheekPuff: { value: 0, min: 0, max: 1 },
    noseSneer_L: { value: 0, min: 0, max: 1 },
    noseSneer_R: { value: 0, min: 0, max: 1 },
  });

  // Setup Leva controls for Bones (Skeletal Rig)
  const boneControls = useControls('Skeletal Rig (Bones)', {
    headPitch: { value: 0, min: -1, max: 1 },
    headYaw: { value: 0, min: -1, max: 1 },
    headRoll: { value: 0, min: -1, max: 1 },
    leftEyeYaw: { value: 0, min: -0.5, max: 0.5 },
    rightEyeYaw: { value: 0, min: -0.5, max: 0.5 },
  });

  useFrame(() => {
    // 1. Apply FACS Blendshapes (Muscle deformations)
    morphMeshes.forEach((mesh) => {
      if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        Object.entries(facsControls).forEach(([name, value]) => {
          const index = mesh.morphTargetDictionary![name];
          if (index !== undefined) {
            mesh.morphTargetInfluences![index] = value;
          }
        });
      }
    });

    // 2. Apply Bone Rotations (Rigid skeletal transformations)
    const headNode = nodes['grp_transform'] || nodes['head'] || nodes['Head'];
    if (headNode) {
      headNode.rotation.x = boneControls.headPitch;
      headNode.rotation.y = boneControls.headYaw;
      headNode.rotation.z = boneControls.headRoll;
    }

    const leftEyeNode = nodes['grp_eyeLeft'] || nodes['eyeLeft'];
    if (leftEyeNode) leftEyeNode.rotation.y = boneControls.leftEyeYaw;

    const rightEyeNode = nodes['grp_eyeRight'] || nodes['eyeRight'];
    if (rightEyeNode) rightEyeNode.rotation.y = boneControls.rightEyeYaw;
  });

  // Apply Materials based on view mode
  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        
        // Hide the built-in eyes if we are showing custom eyes
        // In facecap.glb, the eyes are usually a specific material or sub-mesh
        const name = mesh.name.toLowerCase();
        const parentName = mesh.parent?.name.toLowerCase() || '';
        if (showCustomEyes && (name.includes('eye') || parentName.includes('eye'))) {
           mesh.visible = false;
        } else {
           mesh.visible = true;
        }

        // Store original material on first load so we don't lose the texture maps
        if (!mesh.userData.originalMaterial) {
          mesh.userData.originalMaterial = mesh.material;
        }

        if (viewMode === 'beauty') {
          const origMat = mesh.userData.originalMaterial as THREE.MeshStandardMaterial;
          mesh.material = new THREE.MeshPhysicalMaterial({
            map: origMat.map,
            normalMap: origMat.normalMap,
            color: origMat.map ? 0xffffff : "#f4d0b8",
            roughness: 0.4,
            transmission: 0.1, // Subsurface scattering effect
            thickness: 1.5,
            attenuationColor: new THREE.Color("#ff3311"),
            attenuationDistance: 0.5,
            clearcoat: 0.1,
            clearcoatRoughness: 0.3,
          });
        } else if (viewMode === 'wireframe') {
          mesh.material = new THREE.MeshBasicMaterial({ color: '#00ff00', wireframe: true });
        } else if (viewMode === 'normals') {
          mesh.material = new THREE.MeshNormalMaterial();
        } else if (viewMode === 'depth') {
          mesh.material = new THREE.MeshDepthMaterial();
        } else if (viewMode === 'basic') {
          mesh.material = new THREE.MeshBasicMaterial({ color: '#cccccc' });
        }
      }
    });
  }, [scene, viewMode]);

  const leftEyeNode = nodes['eyeLeft'] || nodes['grp_eyeLeft'];
  const rightEyeNode = nodes['eyeRight'] || nodes['grp_eyeRight'];

  return (
    <group {...props}>
      <primitive object={scene} />
      {showCustomEyes && leftEyeNode && createPortal(
        <group position={[eyePosX, eyePosY, eyePosZ]} rotation={[eyeRotX, eyeRotY, eyeRotZ]} scale={eyeScale}>
          <Eye {...eyeProps} isRightEye={false} />
        </group>,
        leftEyeNode
      )}
      {showCustomEyes && rightEyeNode && createPortal(
        <group position={[-eyePosX, eyePosY, eyePosZ]} rotation={[eyeRotX, -eyeRotY, -eyeRotZ]} scale={eyeScale}>
          <Eye {...eyeProps} isRightEye={true} />
        </group>,
        rightEyeNode
      )}
    </group>
  );
}
