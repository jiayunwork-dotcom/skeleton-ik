import * as THREE from 'three';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function vectorLerp(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  return new THREE.Vector3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
}

export function quaternionSlerp(a: THREE.Quaternion, b: THREE.Quaternion, t: number): THREE.Quaternion {
  const result = a.clone();
  result.slerp(b, t);
  return result;
}

export function eulerToQuaternion(euler: THREE.Euler): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(euler);
}

export function quaternionToEuler(quat: THREE.Quaternion, order: string = 'XYZ'): THREE.Euler {
  const euler = new THREE.Euler();
  euler.setFromQuaternion(quat, order as THREE.EulerOrder);
  return euler;
}

export function matrixToEuler(matrix: THREE.Matrix4): THREE.Euler {
  const euler = new THREE.Euler();
  euler.setFromRotationMatrix(matrix);
  return euler;
}

export function isClose(a: number, b: number, epsilon: number = 1e-6): boolean {
  return Math.abs(a - b) < epsilon;
}

export function vectorsEqual(a: THREE.Vector3, b: THREE.Vector3, epsilon: number = 1e-6): boolean {
  return isClose(a.x, b.x, epsilon) && isClose(a.y, b.y, epsilon) && isClose(a.z, b.z, epsilon);
}

export function normalizeWeights(weights: Map<string, number>): Map<string, number> {
  const sum = Array.from(weights.values()).reduce((acc, w) => acc + w, 0);
  if (sum === 0) return weights;
  const normalized = new Map<string, number>();
  weights.forEach((w, key) => {
    normalized.set(key, w / sum);
  });
  return normalized;
}

export function detectGimbalLock(euler: THREE.Euler, threshold: number = 0.01): boolean {
  const cosY = Math.cos(euler.y);
  return Math.abs(cosY) < threshold;
}

export function matrix4ToFlatArray(matrix: THREE.Matrix4): number[][] {
  const elements = matrix.elements;
  return [
    [elements[0], elements[4], elements[8], elements[12]],
    [elements[1], elements[5], elements[9], elements[13]],
    [elements[2], elements[6], elements[10], elements[14]],
    [elements[3], elements[7], elements[11], elements[15]],
  ];
}
