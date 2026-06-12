import * as THREE from 'three';
import { Skeleton, Joint } from '../types';
import { createJoint, addJoint, createSkeleton, setJointConstraint } from './skeleton';
import { degToRad } from '../utils/math';

export type SkeletonTemplateType = 'humanoid' | 'quadruped' | 'snake' | 'spider';

export function createHumanoidSkeleton(): Skeleton {
  let skeleton = createSkeleton('人形骨架');
  
  const root = createJoint('Root', new THREE.Vector3(0, 0, 0), null, 0.1);
  skeleton = addJoint(skeleton, root);
  
  const hip = createJoint('Hip', new THREE.Vector3(0, 1.0, 0), root.id, 0.1);
  skeleton = addJoint(skeleton, hip);
  
  const spine = createJoint('Spine', new THREE.Vector3(0, 0.4, 0), hip.id, 0.4);
  skeleton = addJoint(skeleton, spine);
  
  const chest = createJoint('Chest', new THREE.Vector3(0, 0.4, 0), spine.id, 0.4);
  skeleton = addJoint(skeleton, chest);
  
  const neck = createJoint('Neck', new THREE.Vector3(0, 0.3, 0), chest.id, 0.3);
  skeleton = addJoint(skeleton, neck);
  
  const head = createJoint('Head', new THREE.Vector3(0, 0.25, 0), neck.id, 0.25);
  skeleton = addJoint(skeleton, head);
  
  const leftShoulder = createJoint('LeftShoulder', new THREE.Vector3(0.25, 0.1, 0), chest.id, 0.1);
  skeleton = addJoint(skeleton, leftShoulder);
  
  const leftUpperArm = createJoint('LeftUpperArm', new THREE.Vector3(0.35, 0, 0), leftShoulder.id, 0.35);
  skeleton = addJoint(skeleton, leftUpperArm);
  
  const leftLowerArm = createJoint('LeftLowerArm', new THREE.Vector3(0.3, 0, 0), leftUpperArm.id, 0.3);
  skeleton = addJoint(skeleton, leftLowerArm);
  
  const leftHand = createJoint('LeftHand', new THREE.Vector3(0.25, 0, 0), leftLowerArm.id, 0.25);
  skeleton = addJoint(skeleton, leftHand);
  
  const rightShoulder = createJoint('RightShoulder', new THREE.Vector3(-0.25, 0.1, 0), chest.id, 0.1);
  skeleton = addJoint(skeleton, rightShoulder);
  
  const rightUpperArm = createJoint('RightUpperArm', new THREE.Vector3(-0.35, 0, 0), rightShoulder.id, 0.35);
  skeleton = addJoint(skeleton, rightUpperArm);
  
  const rightLowerArm = createJoint('RightLowerArm', new THREE.Vector3(-0.3, 0, 0), rightUpperArm.id, 0.3);
  skeleton = addJoint(skeleton, rightLowerArm);
  
  const rightHand = createJoint('RightHand', new THREE.Vector3(-0.25, 0, 0), rightLowerArm.id, 0.25);
  skeleton = addJoint(skeleton, rightHand);
  
  const leftHip = createJoint('LeftHip', new THREE.Vector3(0.15, -0.1, 0), hip.id, 0.1);
  skeleton = addJoint(skeleton, leftHip);
  
  const leftUpperLeg = createJoint('LeftUpperLeg', new THREE.Vector3(0, -0.5, 0), leftHip.id, 0.5);
  skeleton = addJoint(skeleton, leftUpperLeg);
  
  const leftLowerLeg = createJoint('LeftLowerLeg', new THREE.Vector3(0, -0.5, 0), leftUpperLeg.id, 0.5);
  skeleton = addJoint(skeleton, leftLowerLeg);
  
  const leftFoot = createJoint('LeftFoot', new THREE.Vector3(0, -0.2, 0.1), leftLowerLeg.id, 0.2);
  skeleton = addJoint(skeleton, leftFoot);
  
  const rightHip = createJoint('RightHip', new THREE.Vector3(-0.15, -0.1, 0), hip.id, 0.1);
  skeleton = addJoint(skeleton, rightHip);
  
  const rightUpperLeg = createJoint('RightUpperLeg', new THREE.Vector3(0, -0.5, 0), rightHip.id, 0.5);
  skeleton = addJoint(skeleton, rightUpperLeg);
  
  const rightLowerLeg = createJoint('RightLowerLeg', new THREE.Vector3(0, -0.5, 0), rightUpperLeg.id, 0.5);
  skeleton = addJoint(skeleton, rightLowerLeg);
  
  const rightFoot = createJoint('RightFoot', new THREE.Vector3(0, -0.2, 0.1), rightLowerLeg.id, 0.2);
  skeleton = addJoint(skeleton, rightFoot);
  
  skeleton = configureHumanoidConstraints(skeleton);
  
  return skeleton;
}

function configureHumanoidConstraints(skeleton: Skeleton): Skeleton {
  let s = skeleton;
  
  const joints: Array<{ name: string; minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number; dofType: 'spherical' | 'hinge' | 'saddle' }> = [
    { name: 'LeftUpperArm', minX: -90, maxX: 180, minY: -90, maxY: 90, minZ: -180, maxZ: 180, dofType: 'spherical' },
    { name: 'RightUpperArm', minX: -90, maxX: 180, minY: -90, maxY: 90, minZ: -180, maxZ: 180, dofType: 'spherical' },
    { name: 'LeftLowerArm', minX: 0, maxX: 160, minY: -1, maxY: 1, minZ: -1, maxZ: 1, dofType: 'hinge' },
    { name: 'RightLowerArm', minX: 0, maxX: 160, minY: -1, maxY: 1, minZ: -1, maxZ: 1, dofType: 'hinge' },
    { name: 'LeftUpperLeg', minX: -90, maxX: 90, minY: -45, maxY: 45, minZ: -45, maxZ: 45, dofType: 'spherical' },
    { name: 'RightUpperLeg', minX: -90, maxX: 90, minY: -45, maxY: 45, minZ: -45, maxZ: 45, dofType: 'spherical' },
    { name: 'LeftLowerLeg', minX: 0, maxX: 160, minY: -1, maxY: 1, minZ: -1, maxZ: 1, dofType: 'hinge' },
    { name: 'RightLowerLeg', minX: 0, maxX: 160, minY: -1, maxY: 1, minZ: -1, maxZ: 1, dofType: 'hinge' },
    { name: 'Neck', minX: -60, maxX: 60, minY: -80, maxY: 80, minZ: -45, maxZ: 45, dofType: 'spherical' },
    { name: 'Spine', minX: -30, maxX: 30, minY: -45, maxY: 45, minZ: -20, maxZ: 20, dofType: 'spherical' },
  ];
  
  joints.forEach(config => {
    const joint = Array.from(s.joints.values()).find((j: Joint) => j.name === config.name);
    if (joint) {
      s = setJointConstraint(s, joint.id, {
        minX: degToRad(config.minX),
        maxX: degToRad(config.maxX),
        minY: degToRad(config.minY),
        maxY: degToRad(config.maxY),
        minZ: degToRad(config.minZ),
        maxZ: degToRad(config.maxZ),
        dofType: config.dofType,
      });
    }
  });
  
  return s;
}

export function createQuadrupedSkeleton(): Skeleton {
  let skeleton = createSkeleton('四足骨架');
  
  const root = createJoint('Root', new THREE.Vector3(0, 0.5, 0), null, 0.1);
  skeleton = addJoint(skeleton, root);
  
  const spine1 = createJoint('Spine1', new THREE.Vector3(0, 0, 0.3), root.id, 0.3);
  skeleton = addJoint(skeleton, spine1);
  
  const spine2 = createJoint('Spine2', new THREE.Vector3(0, 0, 0.4), spine1.id, 0.4);
  skeleton = addJoint(skeleton, spine2);
  
  const neck = createJoint('Neck', new THREE.Vector3(0, 0.1, 0.35), spine2.id, 0.35);
  skeleton = addJoint(skeleton, neck);
  
  const head = createJoint('Head', new THREE.Vector3(0, 0.1, 0.25), neck.id, 0.25);
  skeleton = addJoint(skeleton, head);
  
  const leftFrontShoulder = createJoint('LeftFrontShoulder', new THREE.Vector3(0.15, -0.05, 0.3), spine2.id, 0.1);
  skeleton = addJoint(skeleton, leftFrontShoulder);
  
  const leftFrontUpperLeg = createJoint('LeftFrontUpperLeg', new THREE.Vector3(0, -0.35, 0), leftFrontShoulder.id, 0.35);
  skeleton = addJoint(skeleton, leftFrontUpperLeg);
  
  const leftFrontLowerLeg = createJoint('LeftFrontLowerLeg', new THREE.Vector3(0, -0.35, 0), leftFrontUpperLeg.id, 0.35);
  skeleton = addJoint(skeleton, leftFrontLowerLeg);
  
  const leftFrontFoot = createJoint('LeftFrontFoot', new THREE.Vector3(0, -0.15, 0), leftFrontLowerLeg.id, 0.15);
  skeleton = addJoint(skeleton, leftFrontFoot);
  
  const rightFrontShoulder = createJoint('RightFrontShoulder', new THREE.Vector3(-0.15, -0.05, 0.3), spine2.id, 0.1);
  skeleton = addJoint(skeleton, rightFrontShoulder);
  
  const rightFrontUpperLeg = createJoint('RightFrontUpperLeg', new THREE.Vector3(0, -0.35, 0), rightFrontShoulder.id, 0.35);
  skeleton = addJoint(skeleton, rightFrontUpperLeg);
  
  const rightFrontLowerLeg = createJoint('RightFrontLowerLeg', new THREE.Vector3(0, -0.35, 0), rightFrontUpperLeg.id, 0.35);
  skeleton = addJoint(skeleton, rightFrontLowerLeg);
  
  const rightFrontFoot = createJoint('RightFrontFoot', new THREE.Vector3(0, -0.15, 0), rightFrontLowerLeg.id, 0.15);
  skeleton = addJoint(skeleton, rightFrontFoot);
  
  const leftHip = createJoint('LeftHip', new THREE.Vector3(0.15, -0.05, -0.3), spine1.id, 0.1);
  skeleton = addJoint(skeleton, leftHip);
  
  const leftUpperLeg = createJoint('LeftUpperLeg', new THREE.Vector3(0, -0.4, 0), leftHip.id, 0.4);
  skeleton = addJoint(skeleton, leftUpperLeg);
  
  const leftLowerLeg = createJoint('LeftLowerLeg', new THREE.Vector3(0, -0.35, 0), leftUpperLeg.id, 0.35);
  skeleton = addJoint(skeleton, leftLowerLeg);
  
  const leftFoot = createJoint('LeftFoot', new THREE.Vector3(0, -0.15, 0), leftLowerLeg.id, 0.15);
  skeleton = addJoint(skeleton, leftFoot);
  
  const rightHip = createJoint('RightHip', new THREE.Vector3(-0.15, -0.05, -0.3), spine1.id, 0.1);
  skeleton = addJoint(skeleton, rightHip);
  
  const rightUpperLeg = createJoint('RightUpperLeg', new THREE.Vector3(0, -0.4, 0), rightHip.id, 0.4);
  skeleton = addJoint(skeleton, rightUpperLeg);
  
  const rightLowerLeg = createJoint('RightLowerLeg', new THREE.Vector3(0, -0.35, 0), rightUpperLeg.id, 0.35);
  skeleton = addJoint(skeleton, rightLowerLeg);
  
  const rightFoot = createJoint('RightFoot', new THREE.Vector3(0, -0.15, 0), rightLowerLeg.id, 0.15);
  skeleton = addJoint(skeleton, rightFoot);
  
  const tail1 = createJoint('Tail1', new THREE.Vector3(0, 0, -0.4), spine1.id, 0.2);
  skeleton = addJoint(skeleton, tail1);
  
  const tail2 = createJoint('Tail2', new THREE.Vector3(0, -0.05, -0.25), tail1.id, 0.25);
  skeleton = addJoint(skeleton, tail2);
  
  const tail3 = createJoint('Tail3', new THREE.Vector3(0, -0.05, -0.2), tail2.id, 0.2);
  skeleton = addJoint(skeleton, tail3);
  
  return skeleton;
}

export function createSnakeSkeleton(): Skeleton {
  let skeleton = createSkeleton('蛇形骨架');
  
  const root = createJoint('Root', new THREE.Vector3(0, 0.1, 1), null, 0.1);
  skeleton = addJoint(skeleton, root);
  
  const segmentCount = 12;
  let prevId = root.id;
  
  for (let i = 1; i <= segmentCount; i++) {
    const segment = createJoint(
      `Bone${i}`,
      new THREE.Vector3(0, 0, -0.25),
      prevId,
      0.25
    );
    skeleton = addJoint(skeleton, segment);
    prevId = segment.id;
  }
  
  const head = createJoint('Head', new THREE.Vector3(0, 0.05, -0.15), prevId, 0.15);
  skeleton = addJoint(skeleton, head);
  
  return skeleton;
}

export function createSpiderSkeleton(): Skeleton {
  let skeleton = createSkeleton('蜘蛛骨架');
  
  const body = createJoint('Body', new THREE.Vector3(0, 0.2, 0), null, 0.15);
  skeleton = addJoint(skeleton, body);
  
  const legConfigs = [
    { name: 'Leg1', angle: 60, side: 'left', front: true },
    { name: 'Leg2', angle: 30, side: 'left', front: true },
    { name: 'Leg3', angle: -30, side: 'left', front: false },
    { name: 'Leg4', angle: -60, side: 'left', front: false },
    { name: 'Leg5', angle: 60, side: 'right', front: true },
    { name: 'Leg6', angle: 30, side: 'right', front: true },
    { name: 'Leg7', angle: -30, side: 'right', front: false },
    { name: 'Leg8', angle: -60, side: 'right', front: false },
  ];
  
  legConfigs.forEach(config => {
    const rad = degToRad(config.angle);
    const sideMult = config.side === 'left' ? 1 : -1;
    const x = Math.cos(rad) * 0.15 * sideMult;
    const z = Math.sin(rad) * 0.15;
    
    const hip = createJoint(`${config.name}Hip`, new THREE.Vector3(x, 0, z), body.id, 0.05);
    skeleton = addJoint(skeleton, hip);
    
    const upperLeg = createJoint(
      `${config.name}Upper`,
      new THREE.Vector3(x * 0.8, -0.15, z * 0.8),
      hip.id,
      0.2
    );
    skeleton = addJoint(skeleton, upperLeg);
    
    const lowerLeg = createJoint(
      `${config.name}Lower`,
      new THREE.Vector3(x * 0.6, -0.2, z * 0.6),
      upperLeg.id,
      0.25
    );
    skeleton = addJoint(skeleton, lowerLeg);
    
    const foot = createJoint(
      `${config.name}Foot`,
      new THREE.Vector3(x * 0.4, -0.1, z * 0.4),
      lowerLeg.id,
      0.15
    );
    skeleton = addJoint(skeleton, foot);
  });
  
  return skeleton;
}

export function createSkeletonFromTemplate(type: SkeletonTemplateType): Skeleton {
  switch (type) {
    case 'humanoid':
      return createHumanoidSkeleton();
    case 'quadruped':
      return createQuadrupedSkeleton();
    case 'snake':
      return createSnakeSkeleton();
    case 'spider':
      return createSpiderSkeleton();
    default:
      return createHumanoidSkeleton();
  }
}
