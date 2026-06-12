import * as THREE from 'three';
import { Skeleton, Constraint, ConstraintType } from '../types';
import { getJointWorldPosition, getJointWorldQuaternion, getJointChain, setJointQuaternion } from './skeleton';
import { generateId, clamp } from '../utils/math';

export function createConstraint(
  type: ConstraintType,
  jointId: string,
  priority: number = 0
): Constraint {
  return {
    id: generateId(),
    type,
    jointId,
    priority,
    enabled: true,
  };
}

export function applyConstraints(skeleton: Skeleton, constraints: Constraint[]): Skeleton {
  let result = skeleton;
  
  const sortedConstraints = [...constraints]
    .filter(c => c.enabled)
    .sort((a, b) => b.priority - a.priority);
  
  for (const constraint of sortedConstraints) {
    result = applyConstraint(result, constraint);
  }
  
  return result;
}

function applyConstraint(skeleton: Skeleton, constraint: Constraint): Skeleton {
  switch (constraint.type) {
    case 'lookAt':
      return applyLookAtConstraint(skeleton, constraint);
    case 'distance':
      return applyDistanceConstraint(skeleton, constraint);
    case 'position':
      return applyPositionConstraint(skeleton, constraint);
    case 'parent':
      return applyParentConstraint(skeleton, constraint);
    default:
      return skeleton;
  }
}

function applyLookAtConstraint(skeleton: Skeleton, constraint: Constraint): Skeleton {
  const joint = skeleton.joints.get(constraint.jointId);
  if (!joint || !constraint.targetPosition) return skeleton;
  
  const jointPos = getJointWorldPosition(skeleton, joint.id);
  const direction = new THREE.Vector3().subVectors(constraint.targetPosition, jointPos).normalize();
  
  const worldQuat = getJointWorldQuaternion(skeleton, joint.id);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(worldQuat);
  
  const rotationAxis = new THREE.Vector3().crossVectors(forward, direction).normalize();
  const angle = forward.angleTo(direction);
  
  if (angle < 0.001) return skeleton;
  
  const rotationDelta = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angle * 0.5);
  const newWorldQuat = new THREE.Quaternion().multiplyQuaternions(rotationDelta, worldQuat);
  
  const parentQuat = joint.parentId 
    ? getJointWorldQuaternion(skeleton, joint.parentId)
    : new THREE.Quaternion();
  const parentInv = parentQuat.clone().invert();
  const newLocalQuat = new THREE.Quaternion().multiplyQuaternions(parentInv, newWorldQuat);
  
  return setJointQuaternion(skeleton, joint.id, newLocalQuat);
}

function applyDistanceConstraint(skeleton: Skeleton, constraint: Constraint): Skeleton {
  if (!constraint.targetId || !constraint.targetPosition) return skeleton;
  
  const joint = skeleton.joints.get(constraint.jointId);
  const targetJoint = skeleton.joints.get(constraint.targetId);
  if (!joint) return skeleton;
  
  const jointPos = getJointWorldPosition(skeleton, joint.id);
  const targetPos = targetJoint 
    ? getJointWorldPosition(skeleton, targetJoint.id)
    : constraint.targetPosition;
  
  const distance = jointPos.distanceTo(targetPos);
  const targetDistance = constraint.targetPosition?.x || 1;
  
  if (Math.abs(distance - targetDistance) < 0.001) return skeleton;
  
  return skeleton;
}

function applyPositionConstraint(skeleton: Skeleton, constraint: Constraint): Skeleton {
  if (!constraint.targetPosition) return skeleton;
  
  const joint = skeleton.joints.get(constraint.jointId);
  if (!joint || !joint.parentId) return skeleton;
  
  const parentPos = getJointWorldPosition(skeleton, joint.parentId);
  const parentQuat = getJointWorldQuaternion(skeleton, joint.parentId);
  const parentInv = parentQuat.clone().invert();
  
  const localPos = constraint.targetPosition.clone().sub(parentPos).applyQuaternion(parentInv);
  
  const newJoints = new Map(skeleton.joints);
  newJoints.set(joint.id, { ...joint, position: localPos });
  return { ...skeleton, joints: newJoints };
}

function applyParentConstraint(skeleton: Skeleton, constraint: Constraint): Skeleton {
  return skeleton;
}

export function addConstraint(skeleton: Skeleton, constraints: Constraint[], constraint: Constraint): Constraint[] {
  return [...constraints, constraint];
}

export function removeConstraint(constraints: Constraint[], constraintId: string): Constraint[] {
  return constraints.filter(c => c.id !== constraintId);
}

export function updateConstraint(constraints: Constraint[], constraintId: string, updates: Partial<Constraint>): Constraint[] {
  return constraints.map(c => 
    c.id === constraintId ? { ...c, ...updates } : c
  );
}
