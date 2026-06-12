import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useAppStore } from '../store/useAppStore';
import { getJointWorldPosition, getChildJoints } from '../core/skeleton';
import { linearBlendSkinning } from '../core/skin';

interface ViewportProps {
  width?: number;
  height?: number;
}

export default function Viewport({ width = 800, height = 600 }: ViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const skeletonGroupRef = useRef<THREE.Group | null>(null);
  const ikTargetsGroupRef = useRef<THREE.Group | null>(null);
  const meshGroupRef = useRef<THREE.Group | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const isDraggingRef = useRef(false);
  const draggedTargetRef = useRef<string | null>(null);
  const animationFrameRef = useRef<number>(0);
  
  const {
    skeleton,
    selectedJointId,
    selectJoint,
    ikTargets,
    selectedIkTargetId,
    selectIkTarget,
    updateIkTargetPosition,
    ikMode,
    solveIk,
    viewportConfig,
    skinData,
  } = useAppStore();
  
  const initScene = useCallback(() => {
    if (!containerRef.current) return;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(5, 3, 5);
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    const pointLight = new THREE.PointLight(0xffffff, 0.3);
    pointLight.position.set(-5, 5, -5);
    scene.add(pointLight);
    
    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x333333);
    gridHelper.name = 'gridHelper';
    scene.add(gridHelper);
    
    const axesHelper = new THREE.AxesHelper(2);
    axesHelper.name = 'axesHelper';
    scene.add(axesHelper);
    
    const skeletonGroup = new THREE.Group();
    skeletonGroup.name = 'skeletonGroup';
    scene.add(skeletonGroup);
    skeletonGroupRef.current = skeletonGroup;
    
    const ikTargetsGroup = new THREE.Group();
    ikTargetsGroup.name = 'ikTargetsGroup';
    scene.add(ikTargetsGroup);
    ikTargetsGroupRef.current = ikTargetsGroup;
    
    const meshGroup = new THREE.Group();
    meshGroup.name = 'meshGroup';
    scene.add(meshGroup);
    meshGroupRef.current = meshGroup;
    
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameRef.current);
      renderer.dispose();
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);
  
  const renderSkeleton = useCallback(() => {
    if (!skeletonGroupRef.current || !sceneRef.current) return;
    
    const group = skeletonGroupRef.current;
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
    }
    
    const jointMap = new Map<string, THREE.Mesh>();
    
    skeleton.joints.forEach((joint, jointId) => {
      const worldPos = getJointWorldPosition(skeleton, jointId);
      
      const isSelected = selectedJointId === jointId;
      const jointGeometry = new THREE.SphereGeometry(isSelected ? 0.08 : 0.05, 16, 16);
      const jointMaterial = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xffaa00 : 0x00ff88,
        emissive: isSelected ? 0x332200 : 0x002211,
      });
      const jointMesh = new THREE.Mesh(jointGeometry, jointMaterial);
      jointMesh.position.copy(worldPos);
      jointMesh.userData.jointId = jointId;
      jointMesh.userData.isJoint = true;
      group.add(jointMesh);
      jointMap.set(jointId, jointMesh);
      
      if (joint.parentId) {
        const parentPos = getJointWorldPosition(skeleton, joint.parentId);
        const boneDirection = new THREE.Vector3().subVectors(worldPos, parentPos);
        const boneLength = boneDirection.length();
        
        if (boneLength > 0.001) {
          const boneGeometry = new THREE.CylinderGeometry(0.025, 0.025, boneLength, 8);
          const boneMaterial = new THREE.MeshStandardMaterial({
            color: 0x4488ff,
            emissive: 0x112244,
          });
          const boneMesh = new THREE.Mesh(boneGeometry, boneMaterial);
          
          const midPoint = new THREE.Vector3().addVectors(parentPos, worldPos).multiplyScalar(0.5);
          boneMesh.position.copy(midPoint);
          
          const up = new THREE.Vector3(0, 1, 0);
          const direction = boneDirection.clone().normalize();
          const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
          boneMesh.quaternion.copy(quaternion);
          
          boneMesh.userData.jointId = jointId;
          boneMesh.userData.isBone = true;
          group.add(boneMesh);
        }
      }
    });
  }, [skeleton, selectedJointId]);
  
  const renderIkTargets = useCallback(() => {
    if (!ikTargetsGroupRef.current) return;
    
    const group = ikTargetsGroupRef.current;
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
    }
    
    ikTargets.forEach(target => {
      if (!target.enabled) return;
      
      const isSelected = selectedIkTargetId === target.id;
      const geometry = new THREE.SphereGeometry(isSelected ? 0.1 : 0.08, 16, 16);
      const material = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xff00ff : 0xff6600,
        emissive: isSelected ? 0x330033 : 0x331100,
        transparent: true,
        opacity: 0.8,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(target.targetPosition);
      mesh.userData.ikTargetId = target.id;
      mesh.userData.isIkTarget = true;
      group.add(mesh);
      
      const ringGeometry = new THREE.RingGeometry(0.12, 0.15, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: isSelected ? 0xff00ff : 0xff6600,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.copy(target.targetPosition);
      ring.userData.ikTargetId = target.id;
      ring.userData.isIkTarget = true;
      group.add(ring);
      
      const joint = skeleton.joints.get(target.jointId);
      if (joint) {
        const endPos = getJointWorldPosition(skeleton, target.jointId);
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
          endPos,
          target.targetPosition,
        ]);
        const lineMaterial = new THREE.LineDashedMaterial({
          color: 0xff6600,
          dashSize: 0.1,
          gapSize: 0.05,
          transparent: true,
          opacity: 0.5,
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        line.computeLineDistances();
        group.add(line);
      }
    });
  }, [ikTargets, selectedIkTargetId, skeleton]);
  
  const renderMesh = useCallback(() => {
    if (!meshGroupRef.current || !skinData) return;
    
    const group = meshGroupRef.current;
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
    }
    
    const deformedVertices = linearBlendSkinning(skinData, skeleton);
    
    const positions = new Float32Array(deformedVertices.length * 3);
    deformedVertices.forEach((v, i) => {
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
    });
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    if (skinData.indices) {
      geometry.setIndex(skinData.indices);
    }
    
    geometry.computeVertexNormals();
    
    let material;
    switch (viewportConfig.viewMode) {
      case 'wireframe':
        material = new THREE.MeshBasicMaterial({
          color: 0x00ff00,
          wireframe: true,
          transparent: true,
          opacity: 0.7,
        });
        break;
      case 'xray':
        material = new THREE.MeshBasicMaterial({
          color: 0x4488ff,
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide,
        });
        break;
      default:
        material = new THREE.MeshStandardMaterial({
          color: 0x888888,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
        });
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }, [skinData, skeleton, viewportConfig.viewMode]);
  
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    
    if (ikMode && ikTargets.length > 0) {
      const targetMeshes: THREE.Object3D[] = [];
      ikTargetsGroupRef.current?.traverse(child => {
        if (child.userData.isIkTarget) {
          targetMeshes.push(child);
        }
      });
      
      const intersects = raycasterRef.current.intersectObjects(targetMeshes);
      
      if (intersects.length > 0) {
        const targetId = intersects[0].object.userData.ikTargetId;
        selectIkTarget(targetId);
        draggedTargetRef.current = targetId;
        isDraggingRef.current = true;
        if (controlsRef.current) {
          controlsRef.current.enabled = false;
        }
        return;
      }
    }
    
    const jointMeshes: THREE.Object3D[] = [];
    skeletonGroupRef.current?.traverse(child => {
      if (child.userData.isJoint) {
        jointMeshes.push(child);
      }
    });
    
    const intersects = raycasterRef.current.intersectObjects(jointMeshes);
    
    if (intersects.length > 0) {
      const jointId = intersects[0].object.userData.jointId;
      selectJoint(jointId);
    } else {
      selectJoint(null);
    }
  }, [ikMode, ikTargets, selectJoint, selectIkTarget]);
  
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !isDraggingRef.current || !draggedTargetRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectPoint = new THREE.Vector3();
    raycasterRef.current.ray.intersectPlane(plane, intersectPoint);
    
    if (viewportConfig.mode2D3D === '2d') {
      intersectPoint.z = 0;
    }
    
    updateIkTargetPosition(draggedTargetRef.current, intersectPoint);
    solveIk();
  }, [updateIkTargetPosition, solveIk, viewportConfig.mode2D3D]);
  
  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    draggedTargetRef.current = null;
    if (controlsRef.current) {
      controlsRef.current.enabled = true;
    }
  }, []);
  
  const updateGridAndAxes = useCallback(() => {
    if (!sceneRef.current) return;
    
    const grid = sceneRef.current.getObjectByName('gridHelper');
    if (grid) {
      grid.visible = viewportConfig.showGrid;
    }
    
    const axes = sceneRef.current.getObjectByName('axesHelper');
    if (axes) {
      axes.visible = viewportConfig.showAxes;
    }
  }, [viewportConfig.showGrid, viewportConfig.showAxes]);
  
  const updateCameraMode = useCallback(() => {
    if (!controlsRef.current || !cameraRef.current) return;
    
    if (viewportConfig.mode2D3D === '2d') {
      controlsRef.current.enableRotate = false;
      cameraRef.current.position.z = 10;
      cameraRef.current.position.x = 0;
      cameraRef.current.position.y = 0;
    } else {
      controlsRef.current.enableRotate = true;
    }
  }, [viewportConfig.mode2D3D]);
  
  useEffect(() => {
    const cleanup = initScene();
    return cleanup;
  }, [initScene]);
  
  useEffect(() => {
    renderSkeleton();
  }, [renderSkeleton]);
  
  useEffect(() => {
    renderIkTargets();
  }, [renderIkTargets]);
  
  useEffect(() => {
    renderMesh();
  }, [renderMesh]);
  
  useEffect(() => {
    updateGridAndAxes();
  }, [updateGridAndAxes]);
  
  useEffect(() => {
    updateCameraMode();
  }, [updateCameraMode]);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const canvas = containerRef.current.querySelector('canvas');
    if (!canvas) return;
    
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp]);
  
  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        position: 'relative',
      }} 
    />
  );
}
