import * as THREE from 'three';
import { Skeleton, IKConfig, IKTarget, Joint } from '../types';
import { getJointChain, getJointWorldPosition, setJointQuaternion, clampJointRotation, getJointWorldQuaternion } from './skeleton';
import { clamp, vectorsEqual } from '../utils/math';

export interface IKSolveResult {
  skeleton: Skeleton;
  converged: boolean;
  iterations: number;
  error: number;
}

function getJointWorldPositions(skeleton: Skeleton, jointIds: string[]): THREE.Vector3[] {
  return jointIds.map(id => getJointWorldPosition(skeleton, id));
}

function getWeightsByPriority(targets: IKTarget[]): Map<string, number> {
  const sorted = [...targets].filter(t => t.enabled).sort((a, b) => b.priority - a.priority);
  const weights = new Map<string, number>();
  
  let currentPriority: number | null = null;
  let currentWeight = 1.0;
  
  sorted.forEach(target => {
    if (currentPriority !== null && target.priority < currentPriority) {
      currentWeight = Math.max(0.3, currentWeight * 0.3);
    }
    weights.set(target.id, currentWeight);
    currentPriority = target.priority;
  });
  
  return weights;
}

export function solveCCD(
  skeleton: Skeleton,
  targets: IKTarget[],
  config: IKConfig
): IKSolveResult {
  let resultSkeleton = skeleton;
  let converged = false;
  let iterations = 0;
  let totalError = 0;
  
  const weights = getWeightsByPriority(targets);
  const activeTargets = targets.filter(t => t.enabled);
  
  if (activeTargets.length === 0) {
    return { skeleton: resultSkeleton, converged: true, iterations: 0, error: 0 };
  }
  
  for (let iter = 0; iter < config.maxIterations; iter++) {
    iterations = iter + 1;
    let maxError = 0;
    
    for (const target of activeTargets) {
      const weight = weights.get(target.id) || 1.0;
      const chain = getJointChain(resultSkeleton, target.jointId);
      if (chain.length < 2) continue;
      
      const endJoint = chain[chain.length - 1];
      let endPos = getJointWorldPosition(resultSkeleton, endJoint.id);
      const targetPos = target.targetPosition.clone();
      
      const error = endPos.distanceTo(targetPos);
      maxError = Math.max(maxError, error);
      
      if (error < config.convergenceThreshold) continue;
      
      for (let i = chain.length - 2; i >= 0; i--) {
        const joint = chain[i];
        const jointPos = getJointWorldPosition(resultSkeleton, joint.id);
        const worldQuat = getJointWorldQuaternion(resultSkeleton, joint.id);
        
        const toEnd = new THREE.Vector3().subVectors(endPos, jointPos).normalize();
        const toTarget = new THREE.Vector3().subVectors(targetPos, jointPos).normalize();
        
        const dot = toEnd.dot(toTarget);
        if (dot > 0.99999) continue;
        
        const axis = new THREE.Vector3().crossVectors(toEnd, toTarget).normalize();
        const angle = Math.acos(clamp(dot, -1, 1)) * weight;
        
        const rotationDelta = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        const newWorldQuat = new THREE.Quaternion().multiplyQuaternions(rotationDelta, worldQuat);
        
        const parentWorldQuat = joint.parentId 
          ? getJointWorldQuaternion(resultSkeleton, joint.parentId)
          : new THREE.Quaternion();
        const parentInv = parentWorldQuat.clone().invert();
        const newLocalQuat = new THREE.Quaternion().multiplyQuaternions(parentInv, newWorldQuat);
        
        let updatedJoint = { ...resultSkeleton.joints.get(joint.id)!, quaternion: newLocalQuat };
        const euler = new THREE.Euler().setFromQuaternion(newLocalQuat);
        updatedJoint.rotation = euler;
        updatedJoint = clampJointRotation(updatedJoint);
        
        const newJoints = new Map(resultSkeleton.joints);
        newJoints.set(joint.id, updatedJoint);
        resultSkeleton = { ...resultSkeleton, joints: newJoints };
        
        endPos = getJointWorldPosition(resultSkeleton, endJoint.id);
        
        if (endPos.distanceTo(targetPos) < config.convergenceThreshold) break;
      }
      
      if (target.poleTarget) {
        resultSkeleton = applyPoleTarget(resultSkeleton, target, chain);
      }
    }
    
    totalError = maxError;
    if (maxError < config.convergenceThreshold) {
      converged = true;
      break;
    }
  }
  
  return { skeleton: resultSkeleton, converged, iterations, error: totalError };
}

function applyPoleTarget(skeleton: Skeleton, target: IKTarget, chain: Joint[]): Skeleton {
  if (!target.poleTarget || chain.length < 3) return skeleton;
  
  let result = skeleton;
  const midIndex = Math.floor(chain.length / 2);
  const midJoint = chain[midIndex];
  const startJoint = chain[0];
  const endJoint = chain[chain.length - 1];
  
  const startPos = getJointWorldPosition(result, startJoint.id);
  const endPos = getJointWorldPosition(result, endJoint.id);
  const midPos = getJointWorldPosition(result, midJoint.id);
  
  const axis = new THREE.Vector3().subVectors(endPos, startPos).normalize();
  const toMid = new THREE.Vector3().subVectors(midPos, startPos);
  const toPole = new THREE.Vector3().subVectors(target.poleTarget, startPos);
  
  const midProj = toMid.clone().projectOnVector(axis);
  const poleProj = toPole.clone().projectOnVector(axis);
  
  const midPlane = toMid.sub(midProj).normalize();
  const polePlane = toPole.sub(poleProj).normalize();
  
  const angle = midPlane.angleTo(polePlane);
  if (angle < 0.001) return result;
  
  const cross = new THREE.Vector3().crossVectors(midPlane, polePlane);
  const sign = Math.sign(cross.dot(axis));
  const rotationDelta = new THREE.Quaternion().setFromAxisAngle(axis, angle * sign);
  
  const worldQuat = getJointWorldQuaternion(result, startJoint.id);
  const newWorldQuat = new THREE.Quaternion().multiplyQuaternions(rotationDelta, worldQuat);
  
  const parentWorldQuat = startJoint.parentId 
    ? getJointWorldQuaternion(result, startJoint.parentId)
    : new THREE.Quaternion();
  const parentInv = parentWorldQuat.clone().invert();
  const newLocalQuat = new THREE.Quaternion().multiplyQuaternions(parentInv, newWorldQuat);
  
  const newJoints = new Map(result.joints);
  let updatedJoint = { ...newJoints.get(startJoint.id)!, quaternion: newLocalQuat };
  const euler = new THREE.Euler().setFromQuaternion(newLocalQuat);
  updatedJoint.rotation = euler;
  updatedJoint = clampJointRotation(updatedJoint);
  newJoints.set(startJoint.id, updatedJoint);
  result = { ...result, joints: newJoints };
  
  return result;
}

export function solveFABRIK(
  skeleton: Skeleton,
  targets: IKTarget[],
  config: IKConfig
): IKSolveResult {
  let resultSkeleton = skeleton;
  let converged = false;
  let iterations = 0;
  let totalError = 0;
  
  const weights = getWeightsByPriority(targets);
  const activeTargets = targets.filter(t => t.enabled);
  
  if (activeTargets.length === 0) {
    return { skeleton: resultSkeleton, converged: true, iterations: 0, error: 0 };
  }
  
  for (let iter = 0; iter < config.maxIterations; iter++) {
    iterations = iter + 1;
    let maxError = 0;
    
    for (const target of activeTargets) {
      const weight = weights.get(target.id) || 1.0;
      const chain = getJointChain(resultSkeleton, target.jointId);
      if (chain.length < 2) continue;
      
      const jointIds = chain.map(j => j.id);
      const boneLengths: number[] = [];
      for (let i = 0; i < chain.length - 1; i++) {
        boneLengths.push(chain[i + 1].length);
      }
      
      let positions = getJointWorldPositions(resultSkeleton, jointIds);
      
      const targetPos = target.targetPosition.clone();
      const error = positions[positions.length - 1].distanceTo(targetPos);
      maxError = Math.max(maxError, error);
      
      if (error < config.convergenceThreshold) continue;
      
      const originalRootPos = positions[0].clone();
      
      positions[positions.length - 1] = targetPos.clone();
      
      for (let i = positions.length - 2; i >= 0; i--) {
        const direction = new THREE.Vector3().subVectors(positions[i], positions[i + 1]).normalize();
        const length = boneLengths[i];
        positions[i] = positions[i + 1].clone().add(direction.multiplyScalar(length));
      }
      
      positions[0] = originalRootPos.clone();
      
      for (let i = 0; i < positions.length - 1; i++) {
        const direction = new THREE.Vector3().subVectors(positions[i + 1], positions[i]).normalize();
        const length = boneLengths[i];
        positions[i + 1] = positions[i].clone().add(direction.multiplyScalar(length));
      }
      
      resultSkeleton = applyPositionsToSkeleton(resultSkeleton, chain, positions);
      
      for (const joint of chain) {
        const updated = resultSkeleton.joints.get(joint.id);
        if (updated) {
          const clamped = clampJointRotation(updated);
          const newJoints = new Map(resultSkeleton.joints);
          newJoints.set(joint.id, clamped);
          resultSkeleton = { ...resultSkeleton, joints: newJoints };
        }
      }
      
      if (target.poleTarget) {
        resultSkeleton = applyPoleTarget(resultSkeleton, target, chain);
      }
    }
    
    totalError = maxError;
    if (maxError < config.convergenceThreshold) {
      converged = true;
      break;
    }
  }
  
  return { skeleton: resultSkeleton, converged, iterations, error: totalError };
}

function applyPositionsToSkeleton(skeleton: Skeleton, chain: Joint[], positions: THREE.Vector3[]): Skeleton {
  let result = skeleton;
  
  for (let i = 0; i < chain.length; i++) {
    const joint = chain[i];
    const worldPos = positions[i];
    
    const parentWorldPos = i === 0 
      ? new THREE.Vector3(0, 0, 0)
      : getJointWorldPosition(result, chain[i - 1].id);
    
    const parentWorldQuat = i === 0
      ? new THREE.Quaternion()
      : getJointWorldQuaternion(result, chain[i - 1].id);
    
    if (i === 0) {
      const newJoints = new Map(result.joints);
      newJoints.set(joint.id, { ...newJoints.get(joint.id)!, position: worldPos.clone() });
      result = { ...result, joints: newJoints };
    } else {
      const newJoints = new Map(result.joints);
      const j = newJoints.get(joint.id)!;
      const parentInv = parentWorldQuat.clone().invert();
      const localPos = worldPos.clone().sub(parentWorldPos).applyQuaternion(parentInv);
      newJoints.set(joint.id, { ...j, position: localPos });
      result = { ...result, joints: newJoints };
    }
    
    if (i < chain.length - 1) {
      const nextWorldPos = positions[i + 1];
      const direction = new THREE.Vector3().subVectors(nextWorldPos, worldPos).normalize();
      
      const worldQuat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction
      );
      
      const parentWorldQuatForRot = i === 0
        ? new THREE.Quaternion()
        : getJointWorldQuaternion(result, chain[i - 1].id);
      const parentInv = parentWorldQuatForRot.clone().invert();
      const localQuat = new THREE.Quaternion().multiplyQuaternions(parentInv, worldQuat);
      
      const newJoints = new Map(result.joints);
      let updatedJoint = { ...newJoints.get(joint.id)!, quaternion: localQuat };
      const euler = new THREE.Euler().setFromQuaternion(localQuat);
      updatedJoint.rotation = euler;
      newJoints.set(joint.id, updatedJoint);
      result = { ...result, joints: newJoints };
    }
  }
  
  return result;
}

export function solveJacobianTranspose(
  skeleton: Skeleton,
  targets: IKTarget[],
  config: IKConfig
): IKSolveResult {
  let resultSkeleton = skeleton;
  let converged = false;
  let iterations = 0;
  let totalError = 0;
  
  const activeTargets = targets.filter(t => t.enabled);
  
  if (activeTargets.length === 0) {
    return { skeleton: resultSkeleton, converged: true, iterations: 0, error: 0 };
  }
  
  const allJointIds = new Set<string>();
  activeTargets.forEach(target => {
    const chain = getJointChain(resultSkeleton, target.jointId);
    chain.forEach(j => allJointIds.add(j.id));
  });
  
  const jointIdList = Array.from(allJointIds);
  
  for (let iter = 0; iter < config.maxIterations; iter++) {
    iterations = iter + 1;
    let maxError = 0;
    
    for (const target of activeTargets) {
      const chain = getJointChain(resultSkeleton, target.jointId);
      if (chain.length < 2) continue;
      
      const endPos = getJointWorldPosition(resultSkeleton, target.jointId);
      const errorVec = new THREE.Vector3().subVectors(target.targetPosition, endPos);
      const error = errorVec.length();
      maxError = Math.max(maxError, error);
      
      if (error < config.convergenceThreshold) continue;
      
      const jacobian = computeJacobian(resultSkeleton, chain, target.jointId);
      
      const jt = transposeJacobian(jacobian, chain.length);
      const deltaTheta = multiplyJacobianVector(jt, errorVec, chain.length, config.stepSize);
      
      resultSkeleton = applyJointDeltas(resultSkeleton, chain, deltaTheta);
      
      if (target.poleTarget) {
        resultSkeleton = applyPoleTarget(resultSkeleton, target, chain);
      }
    }
    
    totalError = maxError;
    if (maxError < config.convergenceThreshold) {
      converged = true;
      break;
    }
  }
  
  return { skeleton: resultSkeleton, converged, iterations, error: totalError };
}

function computeJacobian(skeleton: Skeleton, chain: Joint[], endJointId: string): number[][] {
  const endPos = getJointWorldPosition(skeleton, endJointId);
  const jacobian: number[][] = [];
  
  for (let i = 0; i < chain.length; i++) {
    const joint = chain[i];
    const jointPos = getJointWorldPosition(skeleton, joint.id);
    const worldQuat = getJointWorldQuaternion(skeleton, joint.id);
    
    const axisX = new THREE.Vector3(1, 0, 0).applyQuaternion(worldQuat);
    const axisY = new THREE.Vector3(0, 1, 0).applyQuaternion(worldQuat);
    const axisZ = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuat);
    
    const toEnd = new THREE.Vector3().subVectors(endPos, jointPos);
    
    const jX = new THREE.Vector3().crossVectors(axisX, toEnd);
    const jY = new THREE.Vector3().crossVectors(axisY, toEnd);
    const jZ = new THREE.Vector3().crossVectors(axisZ, toEnd);
    
    jacobian.push([jX.x, jY.x, jZ.x]);
    jacobian.push([jX.y, jY.y, jZ.y]);
    jacobian.push([jX.z, jY.z, jZ.z]);
  }
  
  return jacobian;
}

function transposeJacobian(jacobian: number[][], numJoints: number): number[][] {
  const jt: number[][] = [];
  const cols = numJoints * 3;
  
  for (let j = 0; j < cols; j++) {
    jt.push([jacobian[0][j], jacobian[1][j], jacobian[2][j]]);
  }
  
  return jt;
}

function multiplyJacobianVector(jt: number[][], vector: THREE.Vector3, numJoints: number, stepSize: number): number[] {
  const result: number[] = new Array(numJoints * 3).fill(0);
  
  for (let i = 0; i < jt.length; i++) {
    result[i] = (jt[i][0] * vector.x + jt[i][1] * vector.y + jt[i][2] * vector.z) * stepSize;
  }
  
  return result;
}

function applyJointDeltas(skeleton: Skeleton, chain: Joint[], deltaTheta: number[]): Skeleton {
  let result = skeleton;
  
  for (let i = 0; i < chain.length; i++) {
    const joint = chain[i];
    const dX = deltaTheta[i * 3];
    const dY = deltaTheta[i * 3 + 1];
    const dZ = deltaTheta[i * 3 + 2];
    
    const currentQuat = joint.quaternion.clone();
    const deltaQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(dX, dY, dZ));
    const newQuat = new THREE.Quaternion().multiplyQuaternions(currentQuat, deltaQuat);
    
    const newJoints = new Map(result.joints);
    let updatedJoint = { ...newJoints.get(joint.id)!, quaternion: newQuat };
    const euler = new THREE.Euler().setFromQuaternion(newQuat);
    updatedJoint.rotation = euler;
    updatedJoint = clampJointRotation(updatedJoint);
    newJoints.set(joint.id, updatedJoint);
    result = { ...result, joints: newJoints };
  }
  
  return result;
}

export function solveDLS(
  skeleton: Skeleton,
  targets: IKTarget[],
  config: IKConfig
): IKSolveResult {
  let resultSkeleton = skeleton;
  let converged = false;
  let iterations = 0;
  let totalError = 0;
  
  const activeTargets = targets.filter(t => t.enabled);
  
  if (activeTargets.length === 0) {
    return { skeleton: resultSkeleton, converged: true, iterations: 0, error: 0 };
  }
  
  let lambda = config.dampingFactor;
  
  for (let iter = 0; iter < config.maxIterations; iter++) {
    iterations = iter + 1;
    let maxError = 0;
    
    for (const target of activeTargets) {
      const chain = getJointChain(resultSkeleton, target.jointId);
      if (chain.length < 2) continue;
      
      const endPos = getJointWorldPosition(resultSkeleton, target.jointId);
      const errorVec = new THREE.Vector3().subVectors(target.targetPosition, endPos);
      const error = errorVec.length();
      maxError = Math.max(maxError, error);
      
      if (error < config.convergenceThreshold) continue;
      
      const jacobian = computeJacobian(resultSkeleton, chain, target.jointId);
      
      if (config.adaptiveDamping) {
        const manipulability = computeManipulability(jacobian, chain.length);
        lambda = config.dampingFactor * (1 - Math.min(manipulability, 1));
        lambda = Math.max(lambda, 0.001);
      }
      
      const deltaTheta = solveDLSProblem(jacobian, errorVec, chain.length, lambda);
      
      resultSkeleton = applyJointDeltas(resultSkeleton, chain, deltaTheta);
      
      if (target.poleTarget) {
        resultSkeleton = applyPoleTarget(resultSkeleton, target, chain);
      }
    }
    
    totalError = maxError;
    if (maxError < config.convergenceThreshold) {
      converged = true;
      break;
    }
  }
  
  return { skeleton: resultSkeleton, converged, iterations, error: totalError };
}

function computeManipulability(jacobian: number[][], numJoints: number): number {
  const jtj = computeJTJ(jacobian, numJoints);
  const det = compute3x3Det(jtj);
  return Math.sqrt(Math.abs(det));
}

function computeJTJ(jacobian: number[][], numJoints: number): number[][] {
  const n = numJoints * 3;
  const jtj: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < n; k++) {
        jtj[i][j] += jacobian[i][k] * jacobian[j][k];
      }
    }
  }
  
  return jtj;
}

function compute3x3Det(m: number[][]): number {
  return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
       - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
       + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
}

function solveDLSProblem(jacobian: number[][], error: THREE.Vector3, numJoints: number, lambda: number): number[] {
  const n = numJoints * 3;
  
  const jt = transposeJacobian(jacobian, numJoints);
  
  const jtj = computeJTJ(jacobian, numJoints);
  
  const dampedJTJ = jtj.map((row, i) => row.map((val, j) => val + (i === j ? lambda * lambda : 0)));
  
  const errorArr = [error.x, error.y, error.z];
  const jte = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    for (let k = 0; k < n; k++) {
      jte[i] += jacobian[i][k] * 0;
    }
    jte[i] = errorArr[i];
  }
  
  const y = solve3x3(dampedJTJ, jte);
  
  const deltaTheta = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    deltaTheta[i] = jt[i][0] * y[0] + jt[i][1] * y[1] + jt[i][2] * y[2];
  }
  
  return deltaTheta;
}

function solve3x3(A: number[][], b: number[]): number[] {
  const det = compute3x3Det(A);
  if (Math.abs(det) < 1e-10) return [0, 0, 0];
  
  const invDet = 1 / det;
  
  const inv: number[][] = [
    [
      (A[1][1] * A[2][2] - A[1][2] * A[2][1]) * invDet,
      (A[0][2] * A[2][1] - A[0][1] * A[2][2]) * invDet,
      (A[0][1] * A[1][2] - A[0][2] * A[1][1]) * invDet,
    ],
    [
      (A[1][2] * A[2][0] - A[1][0] * A[2][2]) * invDet,
      (A[0][0] * A[2][2] - A[0][2] * A[2][0]) * invDet,
      (A[0][2] * A[1][0] - A[0][0] * A[1][2]) * invDet,
    ],
    [
      (A[1][0] * A[2][1] - A[1][1] * A[2][0]) * invDet,
      (A[0][1] * A[2][0] - A[0][0] * A[2][1]) * invDet,
      (A[0][0] * A[1][1] - A[0][1] * A[1][0]) * invDet,
    ],
  ];
  
  const result = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      result[i] += inv[i][j] * b[j];
    }
  }
  
  return result;
}

export function solveIK(
  skeleton: Skeleton,
  targets: IKTarget[],
  config: IKConfig
): IKSolveResult {
  switch (config.algorithm) {
    case 'ccd':
      return solveCCD(skeleton, targets, config);
    case 'fabrik':
      return solveFABRIK(skeleton, targets, config);
    case 'jacobian':
      return solveJacobianTranspose(skeleton, targets, config);
    case 'dls':
      return solveDLS(skeleton, targets, config);
    default:
      return solveCCD(skeleton, targets, config);
  }
}
