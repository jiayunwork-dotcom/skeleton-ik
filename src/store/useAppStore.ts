import { create } from 'zustand';
import * as THREE from 'three';
import { 
  Skeleton, IKTarget, IKConfig, Constraint, AnimationClip, 
  SkinData, ViewportConfig, IKAlgorithm, InterpolationType,
  ViewMode, Mode2D3D, Keyframe
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
import { computeHeatDiffusionWeights, computeBindPose } from '../core/skin';

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
  
  showGraphEditor: boolean;
  graphEditorChannels: ('x' | 'y' | 'z')[];
  graphEditorZoom: number;
  selectedKeyframe: { jointId: string; frame: number; channel: string } | null;
  
  onionSkinEnabled: boolean;
  onionSkinFramesBefore: number;
  onionSkinFramesAfter: number;
  onionSkinOpacity: number;
  
  skinningMode: boolean;
  paintBrushSize: number;
  paintBrushStrength: number;
  paintJointId: string | null;
  
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
  updateKeyframe: (jointId: string, kfIndex: number, updates: Partial<Keyframe>) => void;
  removeKeyframe: (jointId: string, kfIndex: number) => void;
  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setInterpolation: (type: InterpolationType) => void;
  
  setSkinData: (skinData: SkinData | null) => void;
  
  setViewMode: (mode: ViewMode) => void;
  setMode2D3D: (mode: Mode2D3D) => void;
  updateViewportConfig: (config: Partial<ViewportConfig>) => void;
  
  loadTemplate: (template: any) => void;
  
  setShowGraphEditor: (show: boolean) => void;
  toggleGraphEditorChannel: (channel: 'x' | 'y' | 'z') => void;
  setGraphEditorZoom: (zoom: number) => void;
  selectKeyframe: (kf: { jointId: string; frame: number; channel: string } | null) => void;
  moveKeyframe: (jointId: string, oldFrame: number, newFrame: number, newValue: number) => void;
  
  setOnionSkinEnabled: (enabled: boolean) => void;
  setOnionSkinFramesBefore: (n: number) => void;
  setOnionSkinFramesAfter: (n: number) => void;
  setOnionSkinOpacity: (opacity: number) => void;
  
  setSkinningMode: (enabled: boolean) => void;
  setPaintBrushSize: (size: number) => void;
  setPaintBrushStrength: (strength: number) => void;
  setPaintJointId: (jointId: string | null) => void;
  importMeshFromFile: (file: File) => Promise<void>;
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
  
  showGraphEditor: false,
  graphEditorChannels: ['x', 'y', 'z'],
  graphEditorZoom: 1,
  selectedKeyframe: null,
  
  onionSkinEnabled: false,
  onionSkinFramesBefore: 2,
  onionSkinFramesAfter: 2,
  onionSkinOpacity: 0.3,
  
  skinningMode: false,
  paintBrushSize: 0.1,
  paintBrushStrength: 0.5,
  paintJointId: null,
  
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
  
  updateKeyframe: (jointId, kfIndex, updates) => {
    const { animationClips, currentClipId } = get();
    const clip = animationClips.find(c => c.id === currentClipId);
    if (!clip) return;
    
    const jointAnim = clip.jointAnimations.get(jointId);
    if (!jointAnim || kfIndex < 0 || kfIndex >= jointAnim.keyframes.length) return;
    
    const newKeyframes = [...jointAnim.keyframes];
    newKeyframes[kfIndex] = { ...newKeyframes[kfIndex], ...updates };
    
    let maxFrame = 0;
    clip.jointAnimations.forEach((ja) => {
      ja.keyframes.forEach((kf) => {
        if (kf.frame > maxFrame) maxFrame = kf.frame;
      });
    });
    newKeyframes.forEach((kf) => {
      if (kf.frame > maxFrame) maxFrame = kf.frame;
    });
    const newDuration = Math.max(clip.duration, (maxFrame + 1) / clip.fps);
    
    const newJointAnimations = new Map(clip.jointAnimations);
    newJointAnimations.set(jointId, { ...jointAnim, keyframes: newKeyframes });
    
    const newClip: AnimationClip = {
      ...clip,
      duration: newDuration,
      jointAnimations: newJointAnimations,
    };
    
    set({
      animationClips: animationClips.map(c => c.id === currentClipId ? newClip : c),
    });
  },
  
  removeKeyframe: (jointId, kfIndex) => {
    const { animationClips, currentClipId } = get();
    const clip = animationClips.find(c => c.id === currentClipId);
    if (!clip) return;
    
    const jointAnim = clip.jointAnimations.get(jointId);
    if (!jointAnim || kfIndex < 0 || kfIndex >= jointAnim.keyframes.length) return;
    
    const newKeyframes = jointAnim.keyframes.filter((_, i) => i !== kfIndex);
    
    let maxFrame = 0;
    clip.jointAnimations.forEach((ja, jid) => {
      if (jid === jointId) {
        newKeyframes.forEach((kf) => {
          if (kf.frame > maxFrame) maxFrame = kf.frame;
        });
      } else {
        ja.keyframes.forEach((kf) => {
          if (kf.frame > maxFrame) maxFrame = kf.frame;
        });
      }
    });
    const newDuration = Math.max(0.1, (maxFrame + 1) / clip.fps);
    
    const newJointAnimations = new Map(clip.jointAnimations);
    if (newKeyframes.length > 0) {
      newJointAnimations.set(jointId, { ...jointAnim, keyframes: newKeyframes });
    } else {
      newJointAnimations.delete(jointId);
    }
    
    const newClip: AnimationClip = {
      ...clip,
      duration: newDuration,
      jointAnimations: newJointAnimations,
    };
    
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
  
  setShowGraphEditor: (show) => set({ showGraphEditor: show }),
  
  toggleGraphEditorChannel: (channel) => {
    set((state) => {
      const channels = state.graphEditorChannels.includes(channel)
        ? state.graphEditorChannels.filter(c => c !== channel)
        : [...state.graphEditorChannels, channel];
      return { graphEditorChannels: channels };
    });
  },
  
  setGraphEditorZoom: (zoom) => set({ graphEditorZoom: Math.max(0.1, Math.min(10, zoom)) }),
  
  selectKeyframe: (kf) => set({ selectedKeyframe: kf }),
  
  moveKeyframe: (jointId, oldFrame, newFrame, newValue) => {
    const { animationClips, currentClipId, skeleton } = get();
    const clip = animationClips.find(c => c.id === currentClipId);
    if (!clip) return;
    
    const jointAnim = clip.jointAnimations.get(jointId);
    if (!jointAnim) return;
    
    const oldKf = jointAnim.keyframes.find(k => k.frame === oldFrame);
    if (!oldKf) return;
    
    let newClip = removeKeyframe(clip, jointId, oldFrame);
    const euler = new THREE.Euler().setFromQuaternion(oldKf.rotation);
    const newEuler = euler.clone();
    const axisMap: Record<string, 'x' | 'y' | 'z'> = { x: 'x', y: 'y', z: 'z' };
    const channel = 'x';
    if (channel && !isNaN(newValue)) {
    }
    const newQuat = new THREE.Quaternion().setFromEuler(newEuler);
    newClip = addKeyframe(newClip, jointId, newFrame, newQuat);
    
    set({
      animationClips: animationClips.map(c => c.id === currentClipId ? newClip : c),
    });
  },
  
  setOnionSkinEnabled: (enabled) => set({ onionSkinEnabled: enabled }),
  setOnionSkinFramesBefore: (n) => set({ onionSkinFramesBefore: Math.max(0, Math.min(10, n)) }),
  setOnionSkinFramesAfter: (n) => set({ onionSkinFramesAfter: Math.max(0, Math.min(10, n)) }),
  setOnionSkinOpacity: (opacity) => set({ onionSkinOpacity: Math.max(0.05, Math.min(0.8, opacity)) }),
  
  setSkinningMode: (enabled) => set({ skinningMode: enabled }),
  setPaintBrushSize: (size) => set({ paintBrushSize: Math.max(0.01, Math.min(2, size)) }),
  setPaintBrushStrength: (strength) => set({ paintBrushStrength: Math.max(0, Math.min(1, strength)) }),
  setPaintJointId: (jointId) => set({ paintJointId: jointId }),
  
  importMeshFromFile: async (file) => {
    try {
      const text = await file.text();
      const ext = file.name.split('.').pop()?.toLowerCase();
      
      let vertices: THREE.Vector3[] = [];
      let indices: number[] | undefined;
      
      if (ext === 'obj') {
        const vRegex = /^v\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/gm;
        const fRegex = /^f\s+(\d+)(?:\/\d*)?\s+(\d+)(?:\/\d*)?\s+(\d+)(?:\/\d*)?/gm;
        let match;
        while ((match = vRegex.exec(text)) !== null) {
          vertices.push(new THREE.Vector3(
            parseFloat(match[1]),
            parseFloat(match[2]),
            parseFloat(match[3])
          ));
        }
        const faceIndices: number[] = [];
        while ((match = fRegex.exec(text)) !== null) {
          faceIndices.push(parseInt(match[1]) - 1);
          faceIndices.push(parseInt(match[2]) - 1);
          faceIndices.push(parseInt(match[3]) - 1);
        }
        if (faceIndices.length > 0) indices = faceIndices;
      }
      
      if (vertices.length === 0) {
        const size = 1.2;
        const segments = 16;
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          for (let j = 0; j <= segments; j++) {
            const phi = (j / segments) * Math.PI;
            vertices.push(new THREE.Vector3(
              size * Math.sin(phi) * Math.cos(theta),
              size * Math.cos(phi) + 1.5,
              size * Math.sin(phi) * Math.sin(theta)
            ));
          }
        }
      }
      
      const { skeleton } = get();
      const weights = computeHeatDiffusionWeights(skeleton, vertices, 4);
      const bindPose = computeBindPose(skeleton);
      
      const newSkinData: SkinData = {
        vertices,
        indices,
        weights,
        bindPose,
      };
      
      set({ skinData: newSkinData });
    } catch (error) {
      console.error('导入网格失败:', error);
    }
  },
}));
