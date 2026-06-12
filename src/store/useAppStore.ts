import { create } from 'zustand';
import * as THREE from 'three';
import { 
  Skeleton, IKTarget, IKConfig, Constraint, AnimationClip, 
  SkinData, ViewportConfig, IKAlgorithm, InterpolationType,
  ViewMode, Mode2D3D
} from '../types';
import { 
  createHumanoidSkeleton 
} from '../core/skeletonTemplates';
import { 
  createJoint, addJoint, removeJoint, updateJoint, setJointRotation,
  setJointQuaternion, setJointConstraint, setJointLength,
  getJointChain, getChildJoints, reparentJoint
} from '../core/skeleton';
import { solveIK } from '../core/ikSolver';
import { createAnimationClip, addKeyframe, removeKeyframe, evaluateAnimation, setInterpolationType } from '../core/animation';
import { createConstraint, applyConstraints } from '../core/constraints';

interface AppState {
  skeleton: Skeleton;
  ikTargets: IKTarget[];
  ikConfig: IKConfig;
  constraints: Constraint[];
  animationClips: AnimationClip[];
  currentClipId: string | null;
  currentTime: number;
  isPlaying: boolean;
  selectedJointId: string | null;
  selectedIkTargetId: string | null;
  skinData: SkinData | null;
  viewportConfig: ViewportConfig;
  ikMode: boolean;
  
  setSkeleton: (skeleton: Skeleton) => void;
  addJoint: (parentId: string | null, position: THREE.Vector3) => void;
  deleteJoint: (jointId: string) => void;
  selectJoint: (jointId: string | null) => void;
  setSelectedJointRotation: (rotation: THREE.Euler) => void;
  setSelectedJointQuaternion: (quaternion: THREE.Quaternion) => void;
  updateJointName: (jointId: string, name: string) => void;
  updateJointLength: (jointId: string, length: number) => void;
  updateJointConstraint: (jointId: string, constraint: any) => void;
  
  toggleIkMode: () => void;
  setIkAlgorithm: (algorithm: IKAlgorithm) => void;
  updateIkConfig: (config: Partial<IKConfig>) => void;
  addIkTarget: (jointId: string) => void;
  removeIkTarget: (targetId: string) => void;
  updateIkTargetPosition: (targetId: string, position: THREE.Vector3) => void;
  selectIkTarget: (targetId: string | null) => void;
  solveIk: () => void;
  
  addConstraint: (type: string, jointId: string) => void;
  removeConstraint: (constraintId: string) => void;
  
  addAnimationClip: (name: string) => void;
  selectAnimationClip: (clipId: string | null) => void;
  addKeyframe: (jointId: string, frame: number) => void;
  deleteKeyframe: (jointId: string, frame: number) => void;
  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setInterpolation: (type: InterpolationType) => void;
  
  setSkinData: (skinData: SkinData | null) => void;
  
  setViewMode: (mode: ViewMode) => void;
  setMode2D3D: (mode: Mode2D3D) => void;
  updateViewportConfig: (config: Partial<ViewportConfig>) => void;
  
  loadTemplate: (template: any) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  skeleton: createHumanoidSkeleton(),
  ikTargets: [],
  ikConfig: {
    algorithm: 'ccd',
    maxIterations: 20,
    convergenceThreshold: 0.001,
    stepSize: 0.1,
    dampingFactor: 0.01,
    adaptiveDamping: true,
  },
  constraints: [],
  animationClips: [],
  currentClipId: null,
  currentTime: 0,
  isPlaying: false,
  selectedJointId: null,
  selectedIkTargetId: null,
  skinData: null,
  viewportConfig: {
    viewMode: 'solid',
    mode2D3D: '3d',
    showGrid: true,
    showAxes: true,
  },
  ikMode: false,
  
  setSkeleton: (skeleton) => set({ skeleton }),
  
  addJoint: (parentId, position) => {
    const { skeleton } = get();
    const newJoint = createJoint(`Joint${skeleton.joints.size + 1}`, position, parentId || null);
    const newSkeleton = addJoint(skeleton, newJoint, parentId || undefined);
    set({ skeleton: newSkeleton, selectedJointId: newJoint.id });
  },
  
  deleteJoint: (jointId) => {
    const { skeleton, selectedJointId } = get();
    const newSkeleton = removeJoint(skeleton, jointId);
    set({ 
      skeleton: newSkeleton,
      selectedJointId: selectedJointId === jointId ? null : selectedJointId,
    });
  },
  
  selectJoint: (jointId) => set({ selectedJointId: jointId }),
  
  setSelectedJointRotation: (rotation) => {
    const { skeleton, selectedJointId } = get();
    if (!selectedJointId) return;
    const newSkeleton = setJointRotation(skeleton, selectedJointId, rotation);
    set({ skeleton: newSkeleton });
  },
  
  setSelectedJointQuaternion: (quaternion) => {
    const { skeleton, selectedJointId } = get();
    if (!selectedJointId) return;
    const newSkeleton = setJointQuaternion(skeleton, selectedJointId, quaternion);
    set({ skeleton: newSkeleton });
  },
  
  updateJointName: (jointId, name) => {
    const { skeleton } = get();
    const newSkeleton = updateJoint(skeleton, jointId, { name });
    set({ skeleton: newSkeleton });
  },
  
  updateJointLength: (jointId, length) => {
    const { skeleton } = get();
    const newSkeleton = setJointLength(skeleton, jointId, length);
    set({ skeleton: newSkeleton });
  },
  
  updateJointConstraint: (jointId, constraint) => {
    const { skeleton } = get();
    const newSkeleton = setJointConstraint(skeleton, jointId, constraint);
    set({ skeleton: newSkeleton });
  },
  
  toggleIkMode: () => set((state) => ({ ikMode: !state.ikMode })),
  
  setIkAlgorithm: (algorithm) => {
    set((state) => ({ ikConfig: { ...state.ikConfig, algorithm } }));
  },
  
  updateIkConfig: (config) => {
    set((state) => ({ ikConfig: { ...state.ikConfig, ...config } }));
  },
  
  addIkTarget: (jointId) => {
    const { skeleton, ikTargets } = get();
    const joint = skeleton.joints.get(jointId);
    if (!joint) return;
    
    const chain = getJointChain(skeleton, jointId);
    if (chain.length < 2) return;
    
    let maxPriority = 0;
    ikTargets.forEach(t => { if (t.priority > maxPriority) maxPriority = t.priority; });
    
    const newTarget: IKTarget = {
      id: `ik_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      jointId,
      targetPosition: new THREE.Vector3(0, 0, 0),
      priority: maxPriority + 1,
      enabled: true,
    };
    
    set({ 
      ikTargets: [...ikTargets, newTarget],
      selectedIkTargetId: newTarget.id,
    });
  },
  
  removeIkTarget: (targetId) => {
    const { ikTargets, selectedIkTargetId } = get();
    set({ 
      ikTargets: ikTargets.filter(t => t.id !== targetId),
      selectedIkTargetId: selectedIkTargetId === targetId ? null : selectedIkTargetId,
    });
  },
  
  updateIkTargetPosition: (targetId, position) => {
    set((state) => ({
      ikTargets: state.ikTargets.map(t =>
        t.id === targetId ? { ...t, targetPosition: position.clone() } : t
      ),
    }));
  },
  
  selectIkTarget: (targetId) => set({ selectedIkTargetId: targetId }),
  
  solveIk: () => {
    const { skeleton, ikTargets, ikConfig, constraints } = get();
    if (ikTargets.filter(t => t.enabled).length === 0) return;
    
    const result = solveIK(skeleton, ikTargets, ikConfig);
    const constrainedSkeleton = applyConstraints(result.skeleton, constraints);
    set({ skeleton: constrainedSkeleton });
  },
  
  addConstraint: (type, jointId) => {
    const { constraints } = get();
    const newConstraint = createConstraint(type as any, jointId);
    set({ constraints: [...constraints, newConstraint] });
  },
  
  removeConstraint: (constraintId) => {
    const { constraints } = get();
    set({ constraints: constraints.filter(c => c.id !== constraintId) });
  },
  
  addAnimationClip: (name) => {
    const { animationClips } = get();
    const newClip = createAnimationClip(name);
    set({ 
      animationClips: [...animationClips, newClip],
      currentClipId: newClip.id,
    });
  },
  
  selectAnimationClip: (clipId) => set({ currentClipId: clipId }),
  
  addKeyframe: (jointId, frame) => {
    const { skeleton, animationClips, currentClipId } = get();
    const clip = animationClips.find(c => c.id === currentClipId);
    if (!clip) return;
    
    const joint = skeleton.joints.get(jointId);
    if (!joint) return;
    
    const newClip = addKeyframe(clip, jointId, frame, joint.quaternion, joint.position);
    set({
      animationClips: animationClips.map(c => c.id === currentClipId ? newClip : c),
    });
  },
  
  deleteKeyframe: (jointId, frame) => {
    const { animationClips, currentClipId } = get();
    const clip = animationClips.find(c => c.id === currentClipId);
    if (!clip) return;
    
    const newClip = removeKeyframe(clip, jointId, frame);
    set({
      animationClips: animationClips.map(c => c.id === currentClipId ? newClip : c),
    });
  },
  
  setCurrentTime: (time) => {
    const { animationClips, currentClipId, skeleton } = get();
    const clip = animationClips.find(c => c.id === currentClipId);
    if (!clip) {
      set({ currentTime: time });
      return;
    }
    
    set({ currentTime: time });
    
    const rotations = evaluateAnimation(clip, time);
    let newSkeleton = skeleton;
    
    rotations.forEach((quat, jointId) => {
      const joint = newSkeleton.joints.get(jointId);
      if (joint) {
        const euler = new THREE.Euler().setFromQuaternion(quat);
        const newJoints = new Map(newSkeleton.joints);
        newJoints.set(jointId, { ...joint, quaternion: quat.clone(), rotation: euler });
        newSkeleton = { ...newSkeleton, joints: newJoints };
      }
    });
    
    set({ skeleton: newSkeleton });
  },
  
  setPlaying: (playing) => set({ isPlaying: playing }),
  
  setInterpolation: (type) => {
    const { animationClips, currentClipId } = get();
    const clip = animationClips.find(c => c.id === currentClipId);
    if (!clip) return;
    
    const newClip = setInterpolationType(clip, type);
    set({
      animationClips: animationClips.map(c => c.id === currentClipId ? newClip : c),
    });
  },
  
  setSkinData: (skinData) => set({ skinData }),
  
  setViewMode: (mode) => {
    set((state) => ({ viewportConfig: { ...state.viewportConfig, viewMode: mode } }));
  },
  
  setMode2D3D: (mode) => {
    set((state) => ({ viewportConfig: { ...state.viewportConfig, mode2D3D: mode } }));
  },
  
  updateViewportConfig: (config) => {
    set((state) => ({ viewportConfig: { ...state.viewportConfig, ...config } }));
  },
  
  loadTemplate: (template) => {
    const newSkeleton = template();
    set({ 
      skeleton: newSkeleton,
      selectedJointId: null,
      ikTargets: [],
    });
  },
}));
