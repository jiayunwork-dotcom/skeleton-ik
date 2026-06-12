import * as THREE from 'three';
import { AnimationClip, JointAnimation, Keyframe, InterpolationType, Skeleton } from '../types';
import { generateId } from '../utils/math';

export function createAnimationClip(name: string, fps: number = 30): AnimationClip {
  return {
    id: generateId(),
    name,
    duration: 0,
    fps,
    jointAnimations: new Map(),
    interpolationType: 'bezier',
  };
}

export function addJointAnimation(clip: AnimationClip, jointId: string): AnimationClip {
  if (clip.jointAnimations.has(jointId)) return clip;
  
  const newJointAnimations = new Map(clip.jointAnimations);
  newJointAnimations.set(jointId, { jointId, keyframes: [] });
  return { ...clip, jointAnimations: newJointAnimations };
}

export function addKeyframe(
  clip: AnimationClip,
  jointId: string,
  frame: number,
  rotation: THREE.Quaternion,
  position?: THREE.Vector3
): AnimationClip {
  const newJointAnimations = new Map(clip.jointAnimations);
  let jointAnim = newJointAnimations.get(jointId);
  
  if (!jointAnim) {
    jointAnim = { jointId, keyframes: [] };
  }
  
  const keyframe: Keyframe = {
    frame,
    rotation: rotation.clone(),
    position: position ? position.clone() : undefined,
  };
  
  const newKeyframes = [...jointAnim.keyframes.filter(k => k.frame !== frame), keyframe];
  newKeyframes.sort((a, b) => a.frame - b.frame);
  
  newJointAnimations.set(jointId, { ...jointAnim, keyframes: newKeyframes });
  
  const maxFrame = Math.max(
    ...Array.from(newJointAnimations.values()).flatMap(ja => ja.keyframes.map(k => k.frame)),
    0
  );
  
  return {
    ...clip,
    jointAnimations: newJointAnimations,
    duration: maxFrame / clip.fps,
  };
}

export function removeKeyframe(clip: AnimationClip, jointId: string, frame: number): AnimationClip {
  const jointAnim = clip.jointAnimations.get(jointId);
  if (!jointAnim) return clip;
  
  const newJointAnimations = new Map(clip.jointAnimations);
  const newKeyframes = jointAnim.keyframes.filter(k => k.frame !== frame);
  newJointAnimations.set(jointId, { ...jointAnim, keyframes: newKeyframes });
  
  const maxFrame = Math.max(
    ...Array.from(newJointAnimations.values()).flatMap(ja => ja.keyframes.map(k => k.frame)),
    0
  );
  
  return {
    ...clip,
    jointAnimations: newJointAnimations,
    duration: maxFrame / clip.fps,
  };
}

export function getKeyframes(clip: AnimationClip, jointId: string): Keyframe[] {
  const jointAnim = clip.jointAnimations.get(jointId);
  return jointAnim?.keyframes || [];
}

function findNearestKeyframes(keyframes: Keyframe[], frame: number): { prev: Keyframe | null; next: Keyframe | null } {
  if (keyframes.length === 0) return { prev: null, next: null };
  
  let prev: Keyframe | null = null;
  let next: Keyframe | null = null;
  
  for (const kf of keyframes) {
    if (kf.frame <= frame) {
      prev = kf;
    } else {
      next = kf;
      break;
    }
  }
  
  if (!prev && keyframes.length > 0) {
    prev = keyframes[0];
  }
  
  return { prev, next };
}

export function interpolateRotation(
  keyframes: Keyframe[],
  frame: number,
  type: InterpolationType
): THREE.Quaternion {
  if (keyframes.length === 0) {
    return new THREE.Quaternion();
  }
  
  if (keyframes.length === 1) {
    return keyframes[0].rotation.clone();
  }
  
  const { prev, next } = findNearestKeyframes(keyframes, frame);
  
  if (!prev || !next || prev.frame === next.frame) {
    return (prev || next || keyframes[0]).rotation.clone();
  }
  
  const t = (frame - prev.frame) / (next.frame - prev.frame);
  
  switch (type) {
    case 'linear':
      return prev.rotation.clone().slerp(next.rotation, t);
    case 'bezier':
    case 'hermite':
    default:
      return slerpWithSmoothing(prev.rotation, next.rotation, t);
  }
}

function slerpWithSmoothing(a: THREE.Quaternion, b: THREE.Quaternion, t: number): THREE.Quaternion {
  const smoothT = t * t * (3 - 2 * t);
  return a.clone().slerp(b, smoothT);
}

export function evaluateAnimation(
  clip: AnimationClip,
  time: number
): Map<string, THREE.Quaternion> {
  const result = new Map<string, THREE.Quaternion>();
  const frame = time * clip.fps;
  
  clip.jointAnimations.forEach((jointAnim, jointId) => {
    const rotation = interpolateRotation(jointAnim.keyframes, frame, clip.interpolationType);
    result.set(jointId, rotation);
  });
  
  return result;
}

export function bakeAnimationToFrames(clip: AnimationClip, targetFps: number = 30): Map<string, THREE.Quaternion>[] {
  const totalFrames = Math.ceil(clip.duration * targetFps) + 1;
  const frames: Map<string, THREE.Quaternion>[] = [];
  
  for (let i = 0; i < totalFrames; i++) {
    const time = i / targetFps;
    frames.push(evaluateAnimation(clip, time));
  }
  
  return frames;
}

export function getSkeletonAtTime(skeleton: Skeleton, clip: AnimationClip, time: number): Skeleton {
  const rotations = evaluateAnimation(clip, time);
  let result = skeleton;
  
  rotations.forEach((quat, jointId) => {
    const joint = result.joints.get(jointId);
    if (joint) {
      const newJoints = new Map(result.joints);
      const euler = new THREE.Euler().setFromQuaternion(quat);
      newJoints.set(jointId, { ...joint, quaternion: quat.clone(), rotation: euler });
      result = { ...result, joints: newJoints };
    }
  });
  
  return result;
}

export function blendAnimations(
  clipA: AnimationClip,
  clipB: AnimationClip,
  timeA: number,
  timeB: number,
  blendWeight: number
): Map<string, THREE.Quaternion> {
  const rotA = evaluateAnimation(clipA, timeA);
  const rotB = evaluateAnimation(clipB, timeB);
  const result = new Map<string, THREE.Quaternion>();
  
  const allJointIds = new Set([...rotA.keys(), ...rotB.keys()]);
  
  allJointIds.forEach(jointId => {
    const quatA = rotA.get(jointId) || new THREE.Quaternion();
    const quatB = rotB.get(jointId) || new THREE.Quaternion();
    result.set(jointId, quatA.clone().slerp(quatB, blendWeight));
  });
  
  return result;
}

export function setInterpolationType(clip: AnimationClip, type: InterpolationType): AnimationClip {
  return { ...clip, interpolationType: type };
}

export function setFPS(clip: AnimationClip, fps: number): AnimationClip {
  return { ...clip, fps };
}
