import * as THREE from 'three';
import { Skeleton, AnimationClip, SkinData, Joint } from '../types';
import { bakeAnimationToFrames, getKeyframes } from './animation';

export function exportSkeletonJSON(skeleton: Skeleton): string {
  const joints = Array.from(skeleton.joints.values()).map(joint => ({
    id: joint.id,
    name: joint.name,
    parentId: joint.parentId,
    position: { x: joint.position.x, y: joint.position.y, z: joint.position.z },
    rotation: { x: joint.rotation.x, y: joint.rotation.y, z: joint.rotation.z },
    quaternion: { 
      x: joint.quaternion.x, 
      y: joint.quaternion.y, 
      z: joint.quaternion.z, 
      w: joint.quaternion.w 
    },
    constraint: {
      minX: joint.constraint.minX,
      maxX: joint.constraint.maxX,
      minY: joint.constraint.minY,
      maxY: joint.constraint.maxY,
      minZ: joint.constraint.minZ,
      maxZ: joint.constraint.maxZ,
      dofType: joint.constraint.dofType,
    },
    length: joint.length,
  }));
  
  const data = {
    version: '1.0',
    skeleton: {
      id: skeleton.id,
      name: skeleton.name,
      rootJointId: skeleton.rootJointId,
      joints,
    },
  };
  
  return JSON.stringify(data, null, 2);
}

export function exportAnimationJSON(skeleton: Skeleton, clip: AnimationClip): string {
  const skeletonData = JSON.parse(exportSkeletonJSON(skeleton));
  
  const jointAnimations: Record<string, any[]> = {};
  clip.jointAnimations.forEach((jointAnim, jointId) => {
    jointAnimations[jointId] = jointAnim.keyframes.map(kf => ({
      frame: kf.frame,
      quaternion: {
        x: kf.rotation.x,
        y: kf.rotation.y,
        z: kf.rotation.z,
        w: kf.rotation.w,
      },
      position: kf.position ? { x: kf.position.x, y: kf.position.y, z: kf.position.z } : undefined,
    }));
  });
  
  const data = {
    version: '1.0',
    ...skeletonData,
    animation: {
      id: clip.id,
      name: clip.name,
      duration: clip.duration,
      fps: clip.fps,
      interpolationType: clip.interpolationType,
      jointAnimations,
    },
  };
  
  return JSON.stringify(data, null, 2);
}

export function exportBVH(skeleton: Skeleton, clip: AnimationClip): string {
  const lines: string[] = [];
  
  const jointOrder = getJointHierarchyOrder(skeleton);
  
  lines.push('HIERARCHY');
  
  function writeJoint(jointId: string, depth: number) {
    const joint = skeleton.joints.get(jointId);
    if (!joint) return;
    
    const indent = '  '.repeat(depth);
    const isRoot = depth === 0;
    
    lines.push(`${indent}${isRoot ? 'ROOT' : 'JOINT'} ${joint.name}`);
    lines.push(`${indent}{`);
    
    lines.push(`${indent}  OFFSET ${joint.position.x.toFixed(6)} ${joint.position.y.toFixed(6)} ${joint.position.z.toFixed(6)}`);
    
    lines.push(`${indent}  CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation`);
    
    const children = getChildren(skeleton, jointId);
    if (children.length > 0) {
      children.forEach(child => writeJoint(child.id, depth + 1));
    } else {
      lines.push(`${indent}  End Site`);
      lines.push(`${indent}  {`);
      lines.push(`${indent}    OFFSET 0 ${joint.length.toFixed(6)} 0`);
      lines.push(`${indent}  }`);
    }
    
    lines.push(`${indent}}`);
  }
  
  if (skeleton.rootJointId) {
    writeJoint(skeleton.rootJointId, 0);
  }
  
  lines.push('MOTION');
  
  const bakedFrames = bakeAnimationToFrames(clip, 30);
  const numFrames = bakedFrames.length;
  
  lines.push(`Frames: ${numFrames}`);
  lines.push(`Frame Time: ${(1 / 30).toFixed(6)}`);
  
  const orderedJoints = jointOrder;
  
  for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
    const frameData: string[] = [];
    
    orderedJoints.forEach(jointId => {
      const joint = skeleton.joints.get(jointId);
      if (!joint) return;
      
      const rotations = bakedFrames[frameIdx];
      const quat = rotations.get(jointId) || joint.quaternion;
      
      const euler = new THREE.Euler().setFromQuaternion(quat, 'ZXY');
      
      const posX = frameIdx === 0 ? joint.position.x : 0;
      const posY = frameIdx === 0 ? joint.position.y : 0;
      const posZ = frameIdx === 0 ? joint.position.z : 0;
      
      frameData.push(posX.toFixed(6));
      frameData.push(posY.toFixed(6));
      frameData.push(posZ.toFixed(6));
      frameData.push(((euler.z * 180) / Math.PI).toFixed(6));
      frameData.push(((euler.x * 180) / Math.PI).toFixed(6));
      frameData.push(((euler.y * 180) / Math.PI).toFixed(6));
    });
    
    lines.push(frameData.join(' '));
  }
  
  return lines.join('\n');
}

function getChildren(skeleton: Skeleton, parentId: string): Joint[] {
  const children: Joint[] = [];
  skeleton.joints.forEach(joint => {
    if (joint.parentId === parentId) {
      children.push(joint);
    }
  });
  return children;
}

function getJointHierarchyOrder(skeleton: Skeleton): string[] {
  const order: string[] = [];
  
  function traverse(jointId: string) {
    order.push(jointId);
    const children = getChildren(skeleton, jointId);
    children.forEach(child => traverse(child.id));
  }
  
  if (skeleton.rootJointId) {
    traverse(skeleton.rootJointId);
  }
  
  return order;
}

export function exportGLTF(
  skeleton: Skeleton,
  clip: AnimationClip,
  skinData?: SkinData
): string {
  const gltf: any = {
    asset: {
      version: '2.0',
      generator: 'Skeleton IK Editor',
    },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [],
    skins: [],
    animations: [],
    meshes: skinData ? [{
      primitives: [{
        attributes: {
          POSITION: 0,
        },
      }],
    }] : undefined,
    accessors: [],
    bufferViews: [],
    buffers: [],
  };
  
  const jointOrder = getJointHierarchyOrder(skeleton);
  
  jointOrder.forEach((jointId, index) => {
    const joint = skeleton.joints.get(jointId);
    if (!joint) return;
    
    const node: any = {
      name: joint.name,
      translation: [joint.position.x, joint.position.y, joint.position.z],
      rotation: [joint.quaternion.x, joint.quaternion.y, joint.quaternion.z, joint.quaternion.w],
    };
    
    const children = getChildren(skeleton, jointId);
    if (children.length > 0) {
      node.children = children.map(c => jointOrder.indexOf(c.id));
    }
    
    gltf.nodes.push(node);
  });
  
  if (skinData) {
    gltf.skins.push({
      joints: jointOrder.map((_, i) => i),
      inverseBindMatrices: 0,
    });
    
    if (gltf.skins.length > 0 && gltf.nodes.length > 0) {
      gltf.nodes[0].skin = 0;
    }
  }
  
  const animationSamplers: any[] = [];
  const animationChannels: any[] = [];
  let accessorIndex = 0;
  
  jointOrder.forEach((jointId, nodeIndex) => {
    const keyframes = getKeyframes(clip, jointId);
    if (keyframes.length === 0) return;
    
    const times = keyframes.map(kf => kf.frame / clip.fps);
    const rotations = keyframes.flatMap(kf => [kf.rotation.x, kf.rotation.y, kf.rotation.z, kf.rotation.w]);
    
    const inputAccessor = {
      bufferView: accessorIndex * 2,
      componentType: 5126,
      count: times.length,
      type: 'SCALAR',
    };
    const outputAccessor = {
      bufferView: accessorIndex * 2 + 1,
      componentType: 5126,
      count: keyframes.length,
      type: 'VEC4',
    };
    
    gltf.accessors.push(inputAccessor, outputAccessor);
    
    const samplerIndex = animationSamplers.length;
    animationSamplers.push({
      input: accessorIndex * 2,
      interpolation: 'LINEAR',
      output: accessorIndex * 2 + 1,
    });
    
    animationChannels.push({
      sampler: samplerIndex,
      target: {
        node: nodeIndex,
        path: 'rotation',
      },
    });
    
    accessorIndex++;
  });
  
  if (animationChannels.length > 0) {
    gltf.animations.push({
      name: clip.name,
      samplers: animationSamplers,
      channels: animationChannels,
    });
  }
  
  return JSON.stringify(gltf, null, 2);
}

export function downloadFile(content: string, filename: string, type: string = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
