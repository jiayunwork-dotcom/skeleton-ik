import * as THREE from 'three';
import { Skeleton, SkinData, VertexWeight } from '../types';
import { getJointWorldPosition, getJointWorldMatrix } from './skeleton';
import { generateId } from '../utils/math';

export function createSkinData(
  vertices: THREE.Vector3[],
  indices?: number[],
  normals?: THREE.Vector3[]
): SkinData {
  const weights: VertexWeight[][] = vertices.map(() => []);
  return {
    vertices: vertices.map(v => v.clone()),
    indices: indices ? [...indices] : undefined,
    normals: normals?.map(n => n.clone()),
    weights,
    bindPose: new Map(),
  };
}

export function computeHeatDiffusionWeights(
  skeleton: Skeleton,
  vertices: THREE.Vector3[],
  maxInfluences: number = 4
): VertexWeight[][] {
  const jointIds = Array.from(skeleton.joints.keys());
  const weights: VertexWeight[][] = [];
  
  for (const vertex of vertices) {
    const distances: { jointId: string; distance: number }[] = [];
    
    for (const jointId of jointIds) {
      const jointPos = getJointWorldPosition(skeleton, jointId);
      const distance = vertex.distanceTo(jointPos);
      distances.push({ jointId, distance });
    }
    
    distances.sort((a, b) => a.distance - b.distance);
    
    const topN = distances.slice(0, maxInfluences);
    const maxDist = topN[topN.length - 1].distance;
    
    const vertexWeights: VertexWeight[] = topN.map(({ jointId, distance }) => {
      const weight = 1.0 - (distance / maxDist);
      const smoothWeight = weight * weight * (3 - 2 * weight);
      return { jointId, weight: Math.max(0.01, smoothWeight) };
    });
    
    const totalWeight = vertexWeights.reduce((sum, w) => sum + w.weight, 0);
    const normalized = vertexWeights.map(w => ({
      ...w,
      weight: w.weight / totalWeight,
    }));
    
    weights.push(normalized);
  }
  
  return weights;
}

export function normalizeVertexWeights(weights: VertexWeight[]): VertexWeight[] {
  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  if (total === 0) return weights;
  return weights.map(w => ({ ...w, weight: w.weight / total }));
}

export function setVertexWeight(
  skinData: SkinData,
  vertexIndex: number,
  jointId: string,
  weight: number,
  maxInfluences: number = 4
): SkinData {
  if (vertexIndex < 0 || vertexIndex >= skinData.weights.length) return skinData;
  
  const vertexWeights = [...skinData.weights[vertexIndex]];
  
  let existingIndex = vertexWeights.findIndex(w => w.jointId === jointId);
  
  if (weight <= 0) {
    if (existingIndex >= 0) {
      vertexWeights.splice(existingIndex, 1);
    }
  } else {
    if (existingIndex >= 0) {
      vertexWeights[existingIndex] = { jointId, weight };
    } else {
      vertexWeights.push({ jointId, weight });
      if (vertexWeights.length > maxInfluences) {
        vertexWeights.sort((a, b) => b.weight - a.weight);
        vertexWeights.splice(maxInfluences);
      }
    }
  }
  
  const normalized = normalizeVertexWeights(vertexWeights);
  
  const newWeights = [...skinData.weights];
  newWeights[vertexIndex] = normalized;
  
  return { ...skinData, weights: newWeights };
}

export function paintWeights(
  skinData: SkinData,
  jointId: string,
  centerIndex: number,
  radius: number,
  strength: number,
  vertices: THREE.Vector3[]
): SkinData {
  let result = skinData;
  const centerPos = vertices[centerIndex];
  
  for (let i = 0; i < vertices.length; i++) {
    const distance = vertices[i].distanceTo(centerPos);
    if (distance <= radius) {
      const falloff = 1.0 - distance / radius;
      const smoothFalloff = falloff * falloff * (3 - 2 * falloff);
      const newWeight = strength * smoothFalloff;
      
      const currentWeight = result.weights[i].find(w => w.jointId === jointId)?.weight || 0;
      const blendedWeight = currentWeight + (newWeight - currentWeight) * smoothFalloff;
      
      result = setVertexWeight(result, i, jointId, blendedWeight);
    }
  }
  
  return result;
}

export function computeBindPose(skeleton: Skeleton): Map<string, THREE.Matrix4> {
  const bindPose = new Map<string, THREE.Matrix4>();
  
  skeleton.joints.forEach((_, jointId) => {
    const worldMatrix = getJointWorldMatrix(skeleton, jointId);
    const inverseBindMatrix = worldMatrix.clone().invert();
    bindPose.set(jointId, inverseBindMatrix);
  });
  
  return bindPose;
}

export function linearBlendSkinning(
  skinData: SkinData,
  skeleton: Skeleton
): THREE.Vector3[] {
  const deformMatrices = new Map<string, THREE.Matrix4>();
  
  skeleton.joints.forEach((_, jointId) => {
    const worldMatrix = getJointWorldMatrix(skeleton, jointId);
    const inverseBindMatrix = skinData.bindPose.get(jointId);
    
    if (inverseBindMatrix) {
      const deformMatrix = worldMatrix.clone().multiply(inverseBindMatrix);
      deformMatrices.set(jointId, deformMatrix);
    }
  });
  
  const deformedVertices: THREE.Vector3[] = [];
  
  for (let i = 0; i < skinData.vertices.length; i++) {
    const originalPos = skinData.vertices[i];
    const weights = skinData.weights[i];
    
    let deformedPos = new THREE.Vector3(0, 0, 0);
    
    for (const { jointId, weight } of weights) {
      const deformMatrix = deformMatrices.get(jointId);
      if (deformMatrix) {
        const transformed = originalPos.clone().applyMatrix4(deformMatrix);
        deformedPos.add(transformed.multiplyScalar(weight));
      }
    }
    
    deformedVertices.push(deformedPos);
  }
  
  return deformedVertices;
}

export function createMeshFromSkinData(skinData: SkinData): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  
  const positions = new Float32Array(skinData.vertices.length * 3);
  skinData.vertices.forEach((v, i) => {
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
  });
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  if (skinData.indices) {
    geometry.setIndex(skinData.indices);
  }
  
  if (skinData.normals) {
    const normals = new Float32Array(skinData.normals.length * 3);
    skinData.normals.forEach((n, i) => {
      normals[i * 3] = n.x;
      normals[i * 3 + 1] = n.y;
      normals[i * 3 + 2] = n.z;
    });
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  
  const material = new THREE.MeshStandardMaterial({
    color: 0x888888,
    side: THREE.DoubleSide,
  });
  
  return new THREE.Mesh(geometry, material);
}

export function updateMeshWithSkinning(
  mesh: THREE.Mesh,
  skinData: SkinData,
  skeleton: Skeleton
): void {
  const deformedVertices = linearBlendSkinning(skinData, skeleton);
  
  const positions = mesh.geometry.attributes.position.array as Float32Array;
  deformedVertices.forEach((v, i) => {
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
  });
  mesh.geometry.attributes.position.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}
