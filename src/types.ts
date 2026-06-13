import * as THREE from 'three';

export type DOFType = 'spherical' | 'hinge' | 'saddle';

export interface JointConstraint {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  dofType: DOFType;
}

export interface Joint {
  id: string;
  name: string;
  parentId: string | null;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  quaternion: THREE.Quaternion;
  constraint: JointConstraint;
  length: number;
}

export interface Skeleton {
  id: string;
  name: string;
  joints: Map<string, Joint>;
  rootJointId: string | null;
}

export type IKAlgorithm = 'ccd' | 'fabrik' | 'jacobian' | 'dls';

export interface IKTarget {
  id: string;
  jointId: string;
  targetPosition: THREE.Vector3;
  priority: number;
  poleTarget?: THREE.Vector3;
  enabled: boolean;
}

export interface IKConfig {
  algorithm: IKAlgorithm;
  maxIterations: number;
  convergenceThreshold: number;
  stepSize: number;
  dampingFactor: number;
  adaptiveDamping: boolean;
}

export type ConstraintType = 'pole' | 'lookAt' | 'distance' | 'parent' | 'position';

export interface Constraint {
  id: string;
  type: ConstraintType;
  jointId: string;
  targetId?: string;
  targetPosition?: THREE.Vector3;
  priority: number;
  enabled: boolean;
}

export interface Keyframe {
  frame: number;
  rotation: THREE.Quaternion;
  position?: THREE.Vector3;
  tangentIn?: { x: number; y: number; z: number; w: number };
  tangentOut?: { x: number; y: number; z: number; w: number };
}

export interface JointAnimation {
  jointId: string;
  keyframes: Keyframe[];
}

export type InterpolationType = 'linear' | 'bezier' | 'hermite';

export interface AnimationClip {
  id: string;
  name: string;
  duration: number;
  fps: number;
  jointAnimations: Map<string, JointAnimation>;
  interpolationType: InterpolationType;
}

export interface VertexWeight {
  jointId: string;
  weight: number;
}

export interface SkinData {
  vertices: THREE.Vector3[];
  normals?: THREE.Vector3[];
  indices?: number[];
  weights: VertexWeight[][];
  bindPose: Map<string, THREE.Matrix4>;
}

export type ViewMode = 'wireframe' | 'solid' | 'xray';
export type Mode2D3D = '2d' | '3d';

export interface ViewportConfig {
  viewMode: ViewMode;
  mode2D3D: Mode2D3D;
  showGrid: boolean;
  showAxes: boolean;
}
