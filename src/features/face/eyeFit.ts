import * as THREE from 'three';
import { selectBestCandidate } from '../../utils/robust';

export type EyeFit = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
};

export type EyeFitDebug = {
  meshName: string;
  meshUuid: string;
  geometryRadius: number;
  geometryCenter: THREE.Vector3;
  sphericity: number;
  worldRadius: number;
  score: number;
  orientationForwardAxis: 'x' | 'y' | 'z';
  orientationForwardSign: 1 | -1;
  orientationForwardDot: number;
  orientationUpAxis: 'x' | 'y' | 'z';
  orientationUpSign: 1 | -1;
  orientationUpDot: number;
  orientationFlipped: boolean;
  facingDotToCamera: number;
  scaleAutoFactor: number;
  scaleAutoRatioBefore: number;
  scaleAutoRatioAfter: number;
  relativePosition: THREE.Vector3;
  relativeQuaternion: THREE.Quaternion;
  relativeScale: THREE.Vector3;
};

export type EyeFitResult = {
  fit: EyeFit;
  debug: EyeFitDebug;
};

export type EyeRotationLimits = {
  yawMax: number;
  pitchUpMax: number;
  pitchDownMax: number;
  source: 'raycast' | 'fallback';
};

export type EyeRotationLimitsMutable = {
  yawMax: number;
  pitchUpMax: number;
  pitchDownMax: number;
  source: 'raycast' | 'fallback';
};

export type EyeLimitScratch = {
  originWorld: THREE.Vector3;
  nodeWorldQuat: THREE.Quaternion;
  rootWorldQuat: THREE.Quaternion;
  dirLocal: THREE.Vector3;
  dirWorld: THREE.Vector3;
  tmpEuler: THREE.Euler;
  forward: THREE.Vector3;
  scaleW: THREE.Vector3;
  rootScaleW: THREE.Vector3;
  raycaster: THREE.Raycaster;
};

export function createEyeLimitScratch(): EyeLimitScratch {
  return {
    originWorld: new THREE.Vector3(),
    nodeWorldQuat: new THREE.Quaternion(),
    rootWorldQuat: new THREE.Quaternion(),
    dirLocal: new THREE.Vector3(),
    dirWorld: new THREE.Vector3(),
    tmpEuler: new THREE.Euler(0, 0, 0, 'XYZ'),
    forward: new THREE.Vector3(0, 0, 1),
    scaleW: new THREE.Vector3(),
    rootScaleW: new THREE.Vector3(),
    raycaster: new THREE.Raycaster(),
  };
}

export function getHeadForwardReference(headNode: THREE.Object3D | undefined, fallbackCamera: THREE.Camera) {
  const forward = new THREE.Vector3();
  if (headNode) {
    const headPos = new THREE.Vector3();
    headNode.getWorldPosition(headPos);
    forward.copy(fallbackCamera.position).sub(headPos);
    if (forward.lengthSq() > 1e-10) return forward.normalize();
  }

  fallbackCamera.getWorldDirection(forward);
  return forward.negate().normalize();
}

export function isUnderCustomEyeRoot(obj: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if ((cur.userData as { __customEyeRoot?: boolean }).__customEyeRoot) return true;
    cur = cur.parent;
  }
  return false;
}

export function isDescendantOf(obj: THREE.Object3D, ancestor: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur === ancestor) return true;
    cur = cur.parent;
  }
  return false;
}

export function computeEyeRotationLimitsFromScene(params: {
  eyeNode: THREE.Object3D;
  fit: EyeFit;
  eyeRadiusLocal: number;
  occluders: THREE.Object3D[];
  scratch?: EyeLimitScratch;
}): EyeRotationLimits {
  const { eyeNode, fit, eyeRadiusLocal, occluders, scratch } = params;

  const originWorld = scratch?.originWorld ?? new THREE.Vector3();
  const nodeWorldQuat = scratch?.nodeWorldQuat ?? new THREE.Quaternion();
  const rootWorldQuat = scratch?.rootWorldQuat ?? new THREE.Quaternion();
  const dirLocal = scratch?.dirLocal ?? new THREE.Vector3();
  const dirWorld = scratch?.dirWorld ?? new THREE.Vector3();
  const tmpEuler = scratch?.tmpEuler ?? new THREE.Euler(0, 0, 0, 'XYZ');
  const forward = scratch?.forward ?? new THREE.Vector3(0, 0, 1);

  eyeNode.updateWorldMatrix(true, false);
  eyeNode.getWorldQuaternion(nodeWorldQuat);
  rootWorldQuat.copy(nodeWorldQuat).multiply(fit.quaternion);
  originWorld.copy(fit.position);
  eyeNode.localToWorld(originWorld);

  const scaleW = scratch?.scaleW ?? new THREE.Vector3();
  eyeNode.getWorldScale(scaleW);
  const rootScaleW = scratch?.rootScaleW ?? new THREE.Vector3();
  rootScaleW.set(
    scaleW.x * fit.scale.x,
    scaleW.y * fit.scale.y,
    scaleW.z * fit.scale.z,
  );
  const radiusWorld = eyeRadiusLocal * Math.max(rootScaleW.x, rootScaleW.y, rootScaleW.z);
  const marginWorld = Math.max(0.002, radiusWorld * 0.06);
  const far = Math.max(radiusWorld * 8, 0.25);

  const raycaster = scratch?.raycaster ?? new THREE.Raycaster();
  raycaster.near = 0;
  raycaster.far = far;

  const isSafe = (yaw: number, pitch: number) => {
    tmpEuler.set(pitch, yaw, 0);
    dirLocal.copy(forward).applyEuler(tmpEuler).normalize();
    dirWorld.copy(dirLocal).applyQuaternion(rootWorldQuat).normalize();

    raycaster.set(originWorld, dirWorld);
    const hits = raycaster.intersectObjects(occluders, true);
    if (!hits.length) return true;
    const d = hits[0]?.distance ?? Infinity;
    return d > radiusWorld + marginWorld;
  };

  const solveMax = (maxCandidate: number, test: (angle: number) => boolean) => {
    let lo = 0;
    let hi = maxCandidate;
    if (!test(0)) return 0;
    if (test(maxCandidate)) return maxCandidate;
    for (let i = 0; i < 8; i += 1) {
      const mid = (lo + hi) * 0.5;
      if (test(mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  };

  const yawMaxPos = solveMax(0.9, (angle) => isSafe(angle, 0));
  const yawMaxNeg = solveMax(0.9, (angle) => isSafe(-angle, 0));
  const yawMax = Math.max(0.08, Math.min(yawMaxPos, yawMaxNeg));

  const pitchUpMax = Math.max(0.06, solveMax(0.7, (angle) => isSafe(0, -angle)));
  const pitchDownMax = Math.max(0.06, solveMax(0.8, (angle) => isSafe(0, angle)));

  if (yawMax < 0.12 || pitchUpMax < 0.10 || pitchDownMax < 0.10) {
    return {
      yawMax: 0.55,
      pitchUpMax: 0.35,
      pitchDownMax: 0.45,
      source: 'fallback',
    };
  }

  return { yawMax, pitchUpMax, pitchDownMax, source: 'raycast' };
}

export function computeEyeBasisCorrection(
  eyeNode: THREE.Object3D,
  forwardRefWorld: THREE.Vector3,
  upRefWorld: THREE.Vector3,
): {
  quaternion: THREE.Quaternion;
  forwardAxis: 'x' | 'y' | 'z';
  forwardSign: 1 | -1;
  forwardDot: number;
  upAxis: 'x' | 'y' | 'z';
  upSign: 1 | -1;
  upDot: number;
} {
  const fwd = forwardRefWorld.clone().normalize();
  const upW = upRefWorld.clone().normalize();

  const eyeWorldQuat = new THREE.Quaternion();
  eyeNode.getWorldQuaternion(eyeWorldQuat);

  const axes: Array<{ axis: 'x' | 'y' | 'z'; local: THREE.Vector3 }> = [
    { axis: 'x', local: new THREE.Vector3(1, 0, 0) },
    { axis: 'y', local: new THREE.Vector3(0, 1, 0) },
    { axis: 'z', local: new THREE.Vector3(0, 0, 1) },
  ];

  let forwardAxis: 'x' | 'y' | 'z' = 'z';
  let forwardSign: 1 | -1 = 1;
  let forwardDot = 0;
  let bestAbs = -Infinity;
  for (const axis of axes) {
    const axisWorld = axis.local.clone().applyQuaternion(eyeWorldQuat).normalize();
    const dot = axisWorld.dot(fwd);
    const absDot = Math.abs(dot);
    if (absDot > bestAbs) {
      bestAbs = absDot;
      forwardDot = dot;
      forwardAxis = axis.axis;
      forwardSign = dot >= 0 ? 1 : -1;
    }
  }

  const forwardLocal = (
    forwardAxis === 'x'
      ? new THREE.Vector3(1, 0, 0)
      : forwardAxis === 'y'
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1)
  ).multiplyScalar(forwardSign);

  const remaining = axes.filter((axis) => axis.axis !== forwardAxis);
  let upAxis: 'x' | 'y' | 'z' = remaining[0]?.axis ?? 'y';
  let upSign: 1 | -1 = 1;
  let upDot = 0;
  let bestUp = -Infinity;

  const fwdW = forwardLocal.clone().applyQuaternion(eyeWorldQuat).normalize();
  const upProj = upW.clone().sub(fwdW.clone().multiplyScalar(upW.dot(fwdW)));
  if (upProj.lengthSq() > 1e-12) upProj.normalize();

  for (const axis of remaining) {
    const axisWorld = axis.local.clone().applyQuaternion(eyeWorldQuat).normalize();
    const dot = axisWorld.dot(upProj);
    const bestForAxis = Math.abs(dot);
    if (bestForAxis > bestUp) {
      bestUp = bestForAxis;
      upDot = dot;
      upAxis = axis.axis;
      upSign = dot >= 0 ? 1 : -1;
    }
  }

  const upLocal = (
    upAxis === 'x'
      ? new THREE.Vector3(1, 0, 0)
      : upAxis === 'y'
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1)
  ).multiplyScalar(upSign);

  const z = forwardLocal.clone().normalize();
  let y = upLocal.clone().normalize();
  y.sub(z.clone().multiplyScalar(y.dot(z)));
  if (y.lengthSq() < 1e-12) {
    y = Math.abs(z.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    y.sub(z.clone().multiplyScalar(y.dot(z))).normalize();
  } else {
    y.normalize();
  }
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  y = new THREE.Vector3().crossVectors(z, x).normalize();

  const matrix = new THREE.Matrix4().makeBasis(x, y, z);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(matrix);

  return { quaternion, forwardAxis, forwardSign, forwardDot, upAxis, upSign, upDot };
}

export function listEyeMeshes(eyeNode: THREE.Object3D) {
  const tmpScale = new THREE.Vector3();
  const base: Array<{
    name: string;
    uuid: string;
    radius: number;
    worldRadius: number;
    sphericity: number;
    nameScore: number;
    vertexCount: number;
    center: THREE.Vector3;
    worldScale: THREE.Vector3;
  }> = [];

  eyeNode.updateWorldMatrix(true, true);
  eyeNode.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    if (!geometry) return;
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    if (!geometry.boundingSphere) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();

    mesh.updateWorldMatrix(true, false);
    mesh.getWorldScale(tmpScale);
    const radius = geometry.boundingSphere.radius;
    const worldRadius = radius * Math.max(tmpScale.x, tmpScale.y, tmpScale.z);

    let sphericity = 0;
    if (geometry.boundingBox) {
      const size = new THREE.Vector3();
      geometry.boundingBox.getSize(size);
      const mean = (size.x + size.y + size.z) / 3;
      if (mean > 0) {
        const dx = size.x - mean;
        const dy = size.y - mean;
        const dz = size.z - mean;
        const std = Math.sqrt((dx * dx + dy * dy + dz * dz) / 3);
        sphericity = THREE.MathUtils.clamp(1 - std / mean, 0, 1);
      }
    }

    const lowerName = mesh.name.toLowerCase();
    let nameScore = 0;
    if (lowerName.includes('eye') || lowerName.includes('eyeball') || lowerName.includes('cornea')) nameScore += 1.5;
    if (lowerName.includes('lid') || lowerName.includes('lash') || lowerName.includes('brow') || lowerName.includes('socket')) nameScore -= 2.0;

    const vertexCount = (geometry.attributes.position?.count ?? 0) | 0;

    base.push({
      name: mesh.name,
      uuid: mesh.uuid,
      radius,
      worldRadius,
      sphericity,
      nameScore,
      vertexCount,
      center: geometry.boundingSphere.center.clone(),
      worldScale: tmpScale.clone(),
    });
  });

  const logRadii = base.map((mesh) => Math.log(Math.max(mesh.radius, 1e-12))).sort((a, b) => a - b);
  const medianLogR = logRadii.length
    ? (logRadii.length % 2 === 1
      ? logRadii[(logRadii.length - 1) / 2]
      : (logRadii[logRadii.length / 2 - 1] + logRadii[logRadii.length / 2]) / 2)
    : 0;
  const absDev = logRadii.map((value) => Math.abs(value - medianLogR)).sort((a, b) => a - b);
  const mad = absDev.length
    ? (absDev.length % 2 === 1
      ? absDev[(absDev.length - 1) / 2]
      : (absDev[absDev.length / 2 - 1] + absDev[absDev.length / 2]) / 2)
    : 0;
  const denom = Math.max(mad * 3, 1e-6);

  const maxVerts = Math.max(1, ...base.map((mesh) => mesh.vertexCount));

  const result = base.map((mesh) => {
    const radiusZ = Math.abs(Math.log(Math.max(mesh.radius, 1e-12)) - medianLogR) / denom;
    const radiusInlier = 1 - THREE.MathUtils.clamp(radiusZ, 0, 1);
    const vertScore = Math.sqrt(mesh.vertexCount / maxVerts);

    const score =
      mesh.sphericity * 3.0 +
      mesh.nameScore +
      radiusInlier * 0.9 +
      vertScore * 0.2 +
      Math.min(mesh.worldRadius, 0.5) * 0.25;

    return {
      name: mesh.name,
      uuid: mesh.uuid,
      radius: mesh.radius,
      worldRadius: mesh.worldRadius,
      sphericity: mesh.sphericity,
      vertexCount: mesh.vertexCount,
      score,
      center: mesh.center,
      worldScale: mesh.worldScale,
    };
  });

  result.sort((a, b) => b.score - a.score);
  return result;
}

export function computeEyeFit(
  eyeNode: THREE.Object3D,
  forwardRefWorld: THREE.Vector3 | undefined,
  upRefWorld: THREE.Vector3 | undefined,
  cameraWorldPos: THREE.Vector3 | undefined,
): EyeFitResult | null {
  eyeNode.updateWorldMatrix(true, true);

  const meshesInfo = listEyeMeshes(eyeNode);
  if (meshesInfo.length === 0) return null;

  const selection = selectBestCandidate(
    meshesInfo.map((mesh) => ({ item: mesh, score: mesh.score, reasons: { score: mesh.score } })),
    { tieBreakEpsilon: 1e-3 },
  );

  if (!selection) return null;
  if (selection.isTie) {
    console.warn('[eye-fit] ambiguous mesh selection (tie)', {
      best: selection.best.item,
      secondBest: selection.secondBest?.item,
    });
  }

  const best = selection.best.item;
  let bestMesh: THREE.Mesh | null = null;
  eyeNode.traverse((child) => {
    if (bestMesh) return;
    if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).uuid === best.uuid) {
      bestMesh = child as THREE.Mesh;
    }
  });
  if (!bestMesh) return null;

  const geometry = bestMesh.geometry as THREE.BufferGeometry;
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  if (!geometry.boundingSphere) return null;

  const eyeInv = new THREE.Matrix4().copy(eyeNode.matrixWorld).invert();
  const relativeMatrix = new THREE.Matrix4().multiplyMatrices(eyeInv, bestMesh.matrixWorld);

  const relativePosition = new THREE.Vector3();
  const relativeQuaternion = new THREE.Quaternion();
  const relativeScale = new THREE.Vector3();
  relativeMatrix.decompose(relativePosition, relativeQuaternion, relativeScale);

  const radius = geometry.boundingSphere.radius;
  const fittedScale = relativeScale.clone().multiplyScalar(radius);

  const centerLocal = geometry.boundingSphere.center.clone();
  const fittedPosition = centerLocal.applyMatrix4(relativeMatrix);
  const basis = (forwardRefWorld && upRefWorld)
    ? computeEyeBasisCorrection(eyeNode, forwardRefWorld, upRefWorld)
    : {
        quaternion: new THREE.Quaternion(),
        forwardAxis: 'z' as const,
        forwardSign: 1 as const,
        forwardDot: 1,
        upAxis: 'y' as const,
        upSign: 1 as const,
        upDot: 1,
      };
  const fittedQuaternion = basis.quaternion.clone();

  let facingDotToCamera = 1;
  let orientationFlipped = false;
  if (cameraWorldPos) {
    const eyeNodeWorldQuat = new THREE.Quaternion();
    eyeNode.getWorldQuaternion(eyeNodeWorldQuat);

    const eyeCenterWorld = fittedPosition.clone().applyMatrix4(eyeNode.matrixWorld);
    const toCamera = cameraWorldPos.clone().sub(eyeCenterWorld);
    if (toCamera.lengthSq() > 1e-10) {
      toCamera.normalize();

      const worldForward = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(eyeNodeWorldQuat.clone().multiply(fittedQuaternion))
        .normalize();

      facingDotToCamera = worldForward.dot(toCamera);
      if (facingDotToCamera < 0) {
        const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
        fittedQuaternion.multiply(flip);
        orientationFlipped = true;

        console.warn('[eye-fit] flipped eye orientation to face camera', {
          eyeNode: eyeNode.name,
          facingDotToCamera,
        });
      }
    }
  }

  if (forwardRefWorld && Math.abs(basis.forwardDot) < 0.6) {
    console.warn('[eye-fit] uncertain eye axis mapping', {
      eyeNode: eyeNode.name,
      forward: { axis: basis.forwardAxis, sign: basis.forwardSign, dot: basis.forwardDot },
      up: { axis: basis.upAxis, sign: basis.upSign, dot: basis.upDot },
    });
  }

  if (best.sphericity < 0.55) {
    return null;
  }

  return {
    fit: { position: fittedPosition, quaternion: fittedQuaternion, scale: fittedScale },
    debug: {
      meshName: bestMesh.name,
      meshUuid: bestMesh.uuid,
      geometryRadius: radius,
      geometryCenter: geometry.boundingSphere.center.clone(),
      sphericity: best.sphericity,
      worldRadius: best.worldRadius,
      score: best.score,
      orientationForwardAxis: basis.forwardAxis,
      orientationForwardSign: basis.forwardSign,
      orientationForwardDot: basis.forwardDot,
      orientationUpAxis: basis.upAxis,
      orientationUpSign: basis.upSign,
      orientationUpDot: basis.upDot,
      orientationFlipped,
      facingDotToCamera,
      scaleAutoFactor: 1,
      scaleAutoRatioBefore: 0,
      scaleAutoRatioAfter: 0,
      relativePosition,
      relativeQuaternion,
      relativeScale,
    },
  };
}
