import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import * as THREE from 'three';
import { radToDeg, degToRad } from '../utils/math';
import { getKeyframes, evaluateAnimation } from '../core/animation';
import type { Keyframe } from '../types';

type DraggableType = 'keyframe' | 'tangentIn' | 'tangentOut' | null;
interface DragState {
  type: DraggableType;
  keyframeIndex: number;
  channel: string;
  startMouseX: number;
  startMouseY: number;
  startFrame: number;
  startValue: number;
  startTangentX: number;
  startTangentY: number;
}

export default function GraphEditor() {
  const {
    showGraphEditor,
    setShowGraphEditor,
    currentClipId,
    selectedJointId,
    graphEditorChannels,
    toggleGraphEditorChannel,
    graphEditorZoom,
    setGraphEditorZoom,
    animationClips,
    skeleton,
    addKeyframe,
    updateKeyframe,
    removeKeyframe,
    currentTime,
  } = useAppStore();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOffsetStart, setPanOffsetStart] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const clip = animationClips.find(c => c.id === currentClipId);
  const selectedJoint = selectedJointId ? skeleton.joints.get(selectedJointId) : null;
  
  const getChartTransforms = useCallback(() => {
    if (!containerRef.current || !clip) return null;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const padding = { left: 50, right: 20, top: 20, bottom: 30 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const fps = clip.fps;
    const durationFrames = Math.ceil(clip.duration * fps) || 100;
    const scaleX = chartWidth / durationFrames * graphEditorZoom;
    const scaleY = chartHeight / 360 * graphEditorZoom;
    const centerX = offset.x + padding.left;
    const centerY = offset.y + padding.top + chartHeight / 2;
    
    return { width, height, padding, chartWidth, chartHeight, fps, durationFrames, scaleX, scaleY, centerX, centerY };
  }, [clip, graphEditorZoom, offset]);
  
  const worldToScreen = useCallback((frame: number, valueDeg: number, transforms: NonNullable<ReturnType<typeof getChartTransforms>>) => {
    return {
      x: transforms.centerX + frame * transforms.scaleX,
      y: transforms.centerY - valueDeg * transforms.scaleY,
    };
  }, []);
  
  const screenToWorld = useCallback((x: number, y: number, transforms: NonNullable<ReturnType<typeof getChartTransforms>>) => {
    return {
      frame: (x - transforms.centerX) / transforms.scaleX,
      valueDeg: (transforms.centerY - y) / transforms.scaleY,
    };
  }, []);
  
  const getDefaultTangent = (kf: Keyframe, channel: string, isIn: boolean) => {
    const euler = new THREE.Euler().setFromQuaternion(kf.rotation);
    const axis = channel as 'x' | 'y' | 'z';
    const val = radToDeg(euler[axis]);
    return {
      x: isIn ? -1 : 1,
      y: 0,
      frameOffset: isIn ? -5 : 5,
      valueOffset: 0,
    };
  };
  
  const getKeyframeTangent = (kf: Keyframe, channel: string, isIn: boolean, transforms: NonNullable<ReturnType<typeof getChartTransforms>>) => {
    const tangentData = isIn ? kf.tangentIn : kf.tangentOut;
    const euler = new THREE.Euler().setFromQuaternion(kf.rotation);
    const axis = channel as 'x' | 'y' | 'z';
    const val = radToDeg(euler[axis]);
    
    let frameOffset, valueOffset;
    
    if (tangentData) {
      const t = tangentData as any;
      if (t.frameOffset !== undefined) {
        frameOffset = t.frameOffset;
        valueOffset = t.valueOffset || 0;
      } else {
        const slope = tangentData[channel as keyof typeof tangentData] || 0;
        frameOffset = isIn ? -10 : 10;
        valueOffset = slope * frameOffset;
      }
    } else {
      frameOffset = isIn ? -10 : 10;
      valueOffset = 0;
    }
    
    return worldToScreen(kf.frame + frameOffset, val + valueOffset, transforms);
  };
  
  useEffect(() => {
    if (!showGraphEditor || !canvasRef.current || !containerRef.current) return;
    
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, width, height);
    
    const transforms = getChartTransforms();
    if (!transforms) {
      ctx.fillStyle = '#666';
      ctx.font = '12px sans-serif';
      ctx.fillText('请选择动画Clip和关节以编辑曲线', 20, height / 2);
      return;
    }
    
    const { padding, chartWidth, chartHeight, durationFrames, scaleX, scaleY, centerX, centerY } = transforms;
    
    if (!clip || !selectedJoint || !selectedJointId) {
      ctx.fillStyle = '#666';
      ctx.font = '12px sans-serif';
      ctx.fillText('请选择动画Clip和关节以编辑曲线', 20, height / 2);
      return;
    }
    
    ctx.strokeStyle = '#1a3a5a';
    ctx.lineWidth = 1;
    
    for (let frame = 0; frame <= durationFrames; frame += Math.max(1, Math.floor(10 / graphEditorZoom))) {
      const x = centerX + frame * scaleX;
      if (x < padding.left || x > width - padding.right) continue;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }
    
    for (let angle = -180; angle <= 180; angle += 30) {
      const y = centerY - angle * scaleY;
      if (y < padding.top || y > height - padding.bottom) continue;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      
      ctx.fillStyle = '#556';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${angle}°`, padding.left - 5, y + 3);
    }
    
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, centerY);
    ctx.lineTo(width - padding.right, centerY);
    ctx.stroke();
    
    ctx.strokeStyle = '#335';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding.left, padding.top, chartWidth, chartHeight);
    
    const channelColors: Record<string, string> = {
      x: '#ff6b6b',
      y: '#4ecdc4',
      z: '#ffe66d',
    };
    
    const keyframes = getKeyframes(clip, selectedJointId);
    
    graphEditorChannels.forEach(channel => {
      const color = channelColors[channel];
      const samples: { frame: number; value: number }[] = [];
      
      const sampleCount = Math.min(chartWidth * 4, durationFrames * 4);
      for (let i = 0; i <= sampleCount; i++) {
        const frame = (i / sampleCount) * durationFrames;
        const time = frame / clip.fps;
        const rotations = evaluateAnimation(clip, time);
        let q = rotations.get(selectedJointId);
        if (!q) {
          const joint = skeleton.joints.get(selectedJointId);
          q = joint?.quaternion;
        }
        if (q) {
          const euler = new THREE.Euler().setFromQuaternion(q);
          const axis = channel as 'x' | 'y' | 'z';
          samples.push({ frame, value: radToDeg(euler[axis]) });
        }
      }
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      
      samples.forEach((sample) => {
        const { x, y } = worldToScreen(sample.frame, sample.value, transforms);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    });
    
    keyframes.forEach((kf, kfIndex) => {
      const euler = new THREE.Euler().setFromQuaternion(kf.rotation);
      const kfScreen = worldToScreen(kf.frame, 0, transforms);
      
      if (kfScreen.x < padding.left - 20 || kfScreen.x > width - padding.right + 20) return;
      
      graphEditorChannels.forEach(channel => {
        const color = channelColors[channel];
        const axis = channel as 'x' | 'y' | 'z';
        const valueDeg = radToDeg(euler[axis]);
        const kfPt = worldToScreen(kf.frame, valueDeg, transforms);
        
        if (kfIndex > 0) {
          const tanIn = getKeyframeTangent(kf, channel, true, transforms);
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.4;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(kfPt.x, kfPt.y);
          ctx.lineTo(tanIn.x, tanIn.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(tanIn.x, tanIn.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        
        if (kfIndex < keyframes.length - 1) {
          const tanOut = getKeyframeTangent(kf, channel, false, transforms);
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.4;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(kfPt.x, kfPt.y);
          ctx.lineTo(tanOut.x, tanOut.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.arc(tanOut.x, tanOut.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(kfPt.x, kfPt.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(kfPt.x, kfPt.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    
    const currentFrame = currentTime * clip.fps;
    const curX = centerX + currentFrame * scaleX;
    if (curX >= padding.left && curX <= width - padding.right) {
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(curX, padding.top);
      ctx.lineTo(curX, height - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.moveTo(curX, padding.top);
      ctx.lineTo(curX - 6, padding.top - 8);
      ctx.lineTo(curX + 6, padding.top - 8);
      ctx.closePath();
      ctx.fill();
    }
    
    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    const fpsLabel = `FPS: ${clip.fps} | 时长: ${clip.duration.toFixed(2)}s | 帧: ${durationFrames}`;
    ctx.fillText(fpsLabel, padding.left, height - 8);
  }, [
    showGraphEditor, clip, selectedJointId, selectedJoint,
    graphEditorChannels, graphEditorZoom, offset, currentClipId, animationClips,
    skeleton, currentTime, refreshTrigger, getChartTransforms, worldToScreen,
  ]);
  
  const hitTestTangent = useCallback((mouseX: number, mouseY: number) => {
    const transforms = getChartTransforms();
    if (!transforms || !clip || !selectedJointId) return null;
    
    const keyframes = getKeyframes(clip, selectedJointId);
    const hitRadius = 10;
    
    for (let kfIndex = 0; kfIndex < keyframes.length; kfIndex++) {
      const kf = keyframes[kfIndex];
      
      for (const channel of graphEditorChannels) {
        if (kfIndex > 0) {
          const tanIn = getKeyframeTangent(kf, channel, true, transforms);
          const dx = mouseX - tanIn.x;
          const dy = mouseY - tanIn.y;
          if (Math.sqrt(dx * dx + dy * dy) < hitRadius) {
            return { type: 'tangentIn' as DraggableType, kfIndex, channel };
          }
        }
        
        if (kfIndex < keyframes.length - 1) {
          const tanOut = getKeyframeTangent(kf, channel, false, transforms);
          const dx = mouseX - tanOut.x;
          const dy = mouseY - tanOut.y;
          if (Math.sqrt(dx * dx + dy * dy) < hitRadius) {
            return { type: 'tangentOut' as DraggableType, kfIndex, channel };
          }
        }
      }
    }
    return null;
  }, [getChartTransforms, clip, selectedJointId, graphEditorChannels]);
  
  const hitTestKeyframe = useCallback((mouseX: number, mouseY: number) => {
    const transforms = getChartTransforms();
    if (!transforms || !clip || !selectedJointId) return null;
    
    const keyframes = getKeyframes(clip, selectedJointId);
    const hitRadius = 9;
    
    for (let kfIndex = 0; kfIndex < keyframes.length; kfIndex++) {
      const kf = keyframes[kfIndex];
      const euler = new THREE.Euler().setFromQuaternion(kf.rotation);
      
      for (const channel of graphEditorChannels) {
        const axis = channel as 'x' | 'y' | 'z';
        const val = radToDeg(euler[axis]);
        const pt = worldToScreen(kf.frame, val, transforms);
        const dx = mouseX - pt.x;
        const dy = mouseY - pt.y;
        if (Math.sqrt(dx * dx + dy * dy) < hitRadius) {
          return { type: 'keyframe' as DraggableType, kfIndex, channel };
        }
      }
    }
    return null;
  }, [getChartTransforms, clip, selectedJointId, graphEditorChannels, worldToScreen]);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || !containerRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (!clip || !selectedJointId) {
      setPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setPanOffsetStart({ ...offset });
      return;
    }
    
    if (e.button === 1 || e.shiftKey) {
      setPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setPanOffsetStart({ ...offset });
      return;
    }
    
    const tangentHit = hitTestTangent(x, y);
    if (tangentHit) {
      const transforms = getChartTransforms();
      if (!transforms) return;
      const keyframes = getKeyframes(clip, selectedJointId);
      const kf = keyframes[tangentHit.kfIndex];
      const isIn = tangentHit.type === 'tangentIn';
      const tangent = getKeyframeTangent(kf, tangentHit.channel, isIn, transforms);
      
      setDragState({
        type: tangentHit.type,
        keyframeIndex: tangentHit.kfIndex,
        channel: tangentHit.channel,
        startMouseX: x,
        startMouseY: y,
        startFrame: kf.frame,
        startValue: 0,
        startTangentX: tangent.x,
        startTangentY: tangent.y,
      });
      return;
    }
    
    const kfHit = hitTestKeyframe(x, y);
    if (kfHit) {
      const transforms = getChartTransforms();
      if (!transforms) return;
      const keyframes = getKeyframes(clip, selectedJointId);
      const kf = keyframes[kfHit.kfIndex];
      const euler = new THREE.Euler().setFromQuaternion(kf.rotation);
      const axis = kfHit.channel as 'x' | 'y' | 'z';
      
      setDragState({
        type: 'keyframe',
        keyframeIndex: kfHit.kfIndex,
        channel: kfHit.channel,
        startMouseX: x,
        startMouseY: y,
        startFrame: kf.frame,
        startValue: radToDeg(euler[axis]),
        startTangentX: 0,
        startTangentY: 0,
      });
      return;
    }
  }, [clip, selectedJointId, offset, hitTestTangent, hitTestKeyframe, getChartTransforms]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (panning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setOffset({ x: panOffsetStart.x + dx, y: panOffsetStart.y + dy });
      return;
    }
    
    if (!dragState || !canvasRef.current || !clip || !selectedJointId) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const transforms = getChartTransforms();
    if (!transforms) return;
    
    const keyframes = getKeyframes(clip, selectedJointId);
    const kf = keyframes[dragState.keyframeIndex];
    if (!kf) return;
    
    if (dragState.type === 'keyframe') {
      const deltaMouseX = mouseX - dragState.startMouseX;
      const deltaMouseY = mouseY - dragState.startMouseY;
      const worldDelta = screenToWorld(deltaMouseX, deltaMouseY, {
        ...transforms,
        centerX: 0,
        centerY: 0,
      });
      
      let newFrame = Math.round(dragState.startFrame + worldDelta.frame);
      newFrame = Math.max(0, newFrame);
      
      const newValueDeg = dragState.startValue - worldDelta.valueDeg;
      const axis = dragState.channel as 'x' | 'y' | 'z';
      
      const euler = new THREE.Euler().setFromQuaternion(kf.rotation);
      euler[axis] = degToRad(newValueDeg);
      const newRotation = new THREE.Quaternion().setFromEuler(euler);
      
      updateKeyframe(selectedJointId, dragState.keyframeIndex, {
        frame: newFrame,
        rotation: newRotation,
      });
      setRefreshTrigger(t => t + 1);
      
    } else if (dragState.type === 'tangentIn' || dragState.type === 'tangentOut') {
      const isIn = dragState.type === 'tangentIn';
      const euler = new THREE.Euler().setFromQuaternion(kf.rotation);
      const axis = dragState.channel as 'x' | 'y' | 'z';
      const kfValueDeg = radToDeg(euler[axis]);
      
      const kfScreen = worldToScreen(kf.frame, kfValueDeg, transforms);
      const tangentWorld = screenToWorld(mouseX, mouseY, transforms);
      
      let frameOffset = tangentWorld.frame - kf.frame;
      if (isIn && frameOffset > 0) frameOffset = -Math.abs(frameOffset);
      if (!isIn && frameOffset < 0) frameOffset = Math.abs(frameOffset);
      if (Math.abs(frameOffset) < 0.1) frameOffset = isIn ? -0.1 : 0.1;
      
      const valueOffset = tangentWorld.valueDeg - kfValueDeg;
      
      const existingTangent = isIn ? kf.tangentIn : kf.tangentOut;
      const newTangentData: any = {
        ...(existingTangent || { x: 0, y: 0, z: 0, w: 0 }),
        frameOffset,
        valueOffset,
      };
      
      if (isIn) {
        updateKeyframe(selectedJointId, dragState.keyframeIndex, {
          tangentIn: newTangentData,
        });
      } else {
        updateKeyframe(selectedJointId, dragState.keyframeIndex, {
          tangentOut: newTangentData,
        });
      }
      setRefreshTrigger(t => t + 1);
    }
  }, [panning, panStart, panOffsetStart, dragState, clip, selectedJointId, getChartTransforms, screenToWorld, worldToScreen, updateKeyframe]);
  
  const handleMouseUp = useCallback(() => {
    setPanning(false);
    setDragState(null);
  }, []);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setGraphEditorZoom(Math.max(0.1, Math.min(10, graphEditorZoom * delta)));
  }, [graphEditorZoom, setGraphEditorZoom]);
  
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || !clip || !selectedJointId) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const transforms = getChartTransforms();
    if (!transforms) return;
    
    const world = screenToWorld(x, 0, transforms);
    const frame = Math.round(world.frame);
    if (frame < 0) return;
    
    const joint = skeleton.joints.get(selectedJointId);
    if (joint) {
      addKeyframe(selectedJointId, frame);
      setRefreshTrigger(t => t + 1);
    }
  }, [clip, selectedJointId, getChartTransforms, screenToWorld, skeleton, addKeyframe]);
  
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!canvasRef.current || !clip || !selectedJointId) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const kfHit = hitTestKeyframe(x, y);
    if (kfHit) {
      if (confirm(`删除第 ${keyframes[kfHit.kfIndex].frame} 帧的关键帧？`)) {
        removeKeyframe(selectedJointId, kfHit.kfIndex);
        setRefreshTrigger(t => t + 1);
      }
    }
  }, [clip, selectedJointId, hitTestKeyframe, removeKeyframe]);
  
  const keyframes = clip && selectedJointId ? getKeyframes(clip, selectedJointId) : [];
  let cursorStyle = 'crosshair';
  if (panning) cursorStyle = 'grab';
  else if (dragState?.type === 'keyframe') cursorStyle = 'move';
  else if (dragState?.type === 'tangentIn' || dragState?.type === 'tangentOut') cursorStyle = 'pointer';
  
  return (
    <div className={`graph-editor ${showGraphEditor ? 'visible' : ''}`}>
      <div className="graph-editor-header">
        <div className="graph-editor-title">曲线编辑器 (Graph Editor)</div>
        <div className="graph-editor-controls">
          <div className="channel-selector">
            <label className="channel-x">
              <input 
                type="checkbox" 
                checked={graphEditorChannels.includes('x')}
                onChange={() => toggleGraphEditorChannel('x')}
              />
              <span>X</span>
            </label>
            <label className="channel-y">
              <input 
                type="checkbox" 
                checked={graphEditorChannels.includes('y')}
                onChange={() => toggleGraphEditorChannel('y')}
              />
              <span>Y</span>
            </label>
            <label className="channel-z">
              <input 
                type="checkbox" 
                checked={graphEditorChannels.includes('z')}
                onChange={() => toggleGraphEditorChannel('z')}
              />
              <span>Z</span>
            </label>
          </div>
          <span className="value-label">缩放: {(graphEditorZoom * 100).toFixed(0)}%</span>
          <button className="tool-btn" onClick={() => { setOffset({ x: 0, y: 0 }); setGraphEditorZoom(1); setRefreshTrigger(t => t + 1); }}>
            重置视图
          </button>
          <button className="tool-btn" onClick={() => setShowGraphEditor(false)}>
            ×
          </button>
        </div>
      </div>
      {showGraphEditor && (
        <>
          <div style={{ 
            padding: '4px 12px', 
            fontSize: '0.75rem', 
            color: '#8892b0', 
            background: '#0f3460',
            borderBottom: '1px solid #0a2040',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            {selectedJoint 
              ? `编辑关节: ${selectedJoint.name} | ${clip ? `动画: ${clip.name} (${clip.duration.toFixed(2)}s, ${keyframes.length}个关键帧)` : '请选择动画'}`
              : '请选择一个关节进行编辑'}
            <span style={{ marginLeft: 'auto' }}>
              Shift+拖拽: 平移 | 滚轮: 缩放 | 双击: 添加 | 右键: 删除关键帧 | 拖拽圆点/切线: 编辑
            </span>
          </div>
          <div className="graph-canvas-container" ref={containerRef}>
            <canvas 
              ref={canvasRef}
              className="graph-canvas"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              onDoubleClick={handleDoubleClick}
              onContextMenu={handleContextMenu}
              style={{ cursor: cursorStyle }}
            />
          </div>
        </>
      )}
    </div>
  );
}
