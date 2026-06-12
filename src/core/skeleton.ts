import * as THREE from 'three';
import { Joint, Skeleton, JointConstraint, DOFType } from '../types';
import { generateId, clamp, degToRad } from '../utils/math';

function createDefaultConstraint(dofType: DOFType = 'spherical'): JointConstraint {
  const limit = degToRad(360);
  return {
    minX: -limit,
    maxX: limit,
    minY: -limit,
    maxY: limit,
    minZ: -limit,
    maxZ: limit,
    dofType,
  };
}

export function createJoint(
  name: string,
  position: THREE.Vector3,
  parentId: string | null = null,
  length: number = 1
): Joint {
  const rotation = new THREE.Euler(0, 0, 0);
  const quaternion = new THREE.Quaternion().setFromEuler(rotation);
  return {
    id: generateId(),
    name,
    parentId,
    position: position.clone(),
    rotation,
    quaternion,
    constraint: createDefaultConstraint(),
    length,
  };
}

export function createSkeleton(name: string): Skeleton {
  return {
    id: generateId(),
    name,
    joints: new Map(),
    rootJointId: null,
  };
}

export function addJoint(skeleton: Skeleton, joint: Joint, parentId?: string): Skeleton {
  const newJoints = new Map(skeleton.joints);
  newJoints.set(joint.id, { ...joint, parentId: parentId || joint.parentId || null });
  
  if (!skeleton.rootJointId && !joint.parentId) {
    return { ...skeleton, joints: newJoints, rootJointId: joint.id };
  }
  
  return { ...skeleton, joints: newJoints };
}

export function removeJoint(skeleton: Skeleton, jointId: string): Skeleton {
  const newJoints = new Map(skeleton.joints);
  const toRemove: string[] = [jointId];
  
  const children = getChildJoints(skeleton, jointId);
  children.forEach(child => toRemove.push(child.id));
  
  toRemove.forEach(id => newJoints.delete(id));
  
  let newRootId: string | null = skeleton.rootJointId;
  if (skeleton.rootJointId === jointId) {
    if (newJoints.size > 0) {
      const firstKey = newJoints.keys().next();
      newRootId = firstKey.value || null;
    } else {
      newRootId = null;
    }
  }
  
  return { ...skeleton, joints: newJoints, rootJointId: newRootId };
}

export function updateJoint(skeleton: Skeleton, jointId: string, updates: Partial<Joint>): Skeleton {
  const joint = skeleton.joints.get(jointId);
  if (!joint) return skeleton;
  
  const newJoints = new Map(skeleton.joints);
  newJoints.set(jointId, { ...joint, ...updates });
  return { ...skeleton, joints: newJoints };
}

export function getChildJoints(skeleton: Skeleton, parentId: string): Joint[] {
  const children: Joint[] = [];
  skeleton.joints.forEach(joint => {
    if (joint.parentId === parentId) {
      children.push(joint);
    }
  });
  return children;
}

export function getJointChain(skeleton: Skeleton, endJointId: string): Joint[] {
  const chain: Joint[] = [];
  let currentId: string | null = endJointId;
  
  while (currentId) {
    const joint = skeleton.joints.get(currentId);
    if (joint) {
      chain.unshift(joint);
      currentId = joint.parentId;
    } else {
      break;
    }
  }
  
  return chain;
}

export function getEndJoints(skeleton: Skeleton): Joint[] {
  const ends: Joint[] = [];
  skeleton.joints.forEach(joint => {
    const children = getChildJoints(skeleton, joint.id);
    if (children.length === 0) {
      ends.push(joint);
    }
  });
  return ends;
}

export function reparentJoint(skeleton: Skeleton, jointId: string, newParentId: string | null): Skeleton {
  const joint = skeleton.joints.get(jointId);
  if (!joint) return skeleton;
  
  if (newParentId) {
    const chain = getJointChain(skeleton, newParentId);
    if (chain.some(j => j.id === jointId)) {
      return skeleton;
    }
  }
  
  return updateJoint(skeleton, jointId, { parentId: newParentId });
}

export function getJointWorldPosition(skeleton: Skeleton, jointId: string): THREE.Vector3 {
  const chain = getJointChain(skeleton, jointId);
  let position = new THREE.Vector3(0, 0, 0);
  let quaternion = new THREE.Quaternion();
  
  for (const joint of chain) {
    const localPos = joint.position.clone();
    localPos.applyQuaternion(quaternion);
    position.add(localPos);
    quaternion.multiply(joint.quaternion);
  }
  
  return position;
}

export function getJointWorldQuaternion(skeleton: Skeleton, jointId: string): THREE.Quaternion {
  const chain = getJointChain(skeleton, jointId);
  let quaternion = new THREE.Quaternion();
  
  for (const joint of chain) {
    quaternion.multiply(joint.quaternion);
  }
  
  return quaternion;
}

export function getJointWorldMatrix(skeleton: Skeleton, jointId: string): THREE.Matrix4 {
  const position = getJointWorldPosition(skeleton, jointId);
  const quaternion = getJointWorldQuaternion(skeleton, jointId);
  const matrix = new THREE.Matrix4();
  matrix.makeRotationFromQuaternion(quaternion);
  matrix.setPosition(position);
  return matrix;
}

export function applyFK(skeleton: Skeleton): Skeleton {
  return skeleton;
}

export function clampJointRotation(joint: Joint): Joint {
  const { constraint, rotation } = joint;
  
  const clampedX = clamp(rotation.x, constraint.minX, constraint.maxX);
  const clampedY = clamp(rotation.y, constraint.minY, constraint.maxY);
  const clampedZ = clamp(rotation.z, constraint.minZ, constraint.maxZ);
  
  const newRotation = new THREE.Euler(clampedX, clampedY, clampedZ, rotation.order);
  const newQuaternion = new THREE.Quaternion().setFromEuler(newRotation);
  
  return { ...joint, rotation: newRotation, quaternion: newQuaternion };
}

export function setJointRotation(skeleton: Skeleton, jointId: string, rotation: THREE.Euler): Skeleton {
  const joint = skeleton.joints.get(jointId);
  if (!joint) return skeleton;
  
  let updatedJoint = { ...joint, rotation: rotation.clone() };
  updatedJoint.quaternion = new THREE.Quaternion().setFromEuler(updatedJoint.rotation);
  updatedJoint = clampJointRotation(updatedJoint);
  
  return updateJoint(skeleton, jointId, updatedJoint);
}

export function setJointQuaternion(skeleton: Skeleton, jointId: string, quaternion: THREE.Quaternion): Skeleton {
  const joint = skeleton.joints.get(jointId);
  if (!joint) return skeleton;
  
  const euler = new THREE.Euler().setFromQuaternion(quaternion);
  let updatedJoint = { ...joint, quaternion: quaternion.clone(), rotation: euler };
  updatedJoint = clampJointRotation(updatedJoint);
  
  return updateJoint(skeleton, jointId, updatedJoint);
}

export function setJointConstraint(skeleton: Skeleton, jointId: string, constraint: JointConstraint): Skeleton {
  return updateJoint(skeleton, jointId, { constraint });
}

export function setJointLength(skeleton: Skeleton, jointId: string, length: number): Skeleton {
  return updateJoint(skeleton, jointId, { length: Math.max(0.01, length) });
}
