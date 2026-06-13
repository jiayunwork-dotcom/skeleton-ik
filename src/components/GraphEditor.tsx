import { useRef, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import * as THREE from 'three';
import { radToDeg, degToRad } from '../utils/math';
import { getKeyframes } from '../core/animation';

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
  } = useAppStore();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingKf, setDraggingKf] = useState<{ frame: number; channel: string; startX: number; startY: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panOffsetStart, setPanOffsetStart] = useState({ x: 0, y: 0 });
  
  const clip = animationClips.find(c => c.id === currentClipId);
  const selectedJoint = selectedJointId ? skeleton.joints.get(selectedJointId) : null;
  
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
    
    if (!clip || !selectedJoint || !selectedJointId) {
      ctx.fillStyle = '#666';
      ctx.font = '12px sans-serif';
      ctx.fillText('请选择动画Clip和关节以编辑曲线', 20, height / 2);
      return;
    }
    
    const keyframes = getKeyframes(clip, selectedJointId);
    const fps = clip.fps;
    const durationFrames = Math.ceil(clip.duration * fps) || 100;
    
    const padding = { left: 50, right: 20, top: 20, bottom: 30 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    const scaleX = chartWidth / durationFrames * graphEditorZoom;
    const scaleY = chartHeight / 360 * graphEditorZoom;
    
    const centerX = offset.x + padding.left;
    const centerY = offset.y + padding.top + chartHeight / 2;
    
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
      x: '#ff5555',
      y: '#55ff55',
      z: '#5588ff',
    };
    
    graphEditorChannels.forEach(channel => {
      const color = channelColors[channel];
      const samples: { frame: number; value: number }[] = [];
      
      const sampleCount = Math.min(chartWidth * 2, durationFrames * 2);
      for (let i = 0; i <= sampleCount; i++) {
        const frame = (i / sampleCount) * durationFrames;
        const time = frame / fps;
        const rotations = (window as any).__evaluateAnim?.(time) || new Map();
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
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      
      samples.forEach((sample, i) => {
        const x = centerX + sample.frame * scaleX;
        const y = centerY - sample.value * scaleY;
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    });
    
    keyframes.forEach(kf => {
      const euler = new THREE.Euler().setFromQuaternion(kf.rotation);
      const x = centerX + kf.frame * scaleX;
      
      if (x < padding.left - 10 || x > width - padding.right + 10) return;
      
      graphEditorChannels.forEach(channel => {
        const color = channelColors[channel];
        const axis = channel as 'x' | 'y' | 'z';
        const y = centerY - radToDeg(euler[axis]) * scaleY;
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    });
    
    const currentFrame = clip ? currentTimeToFrame() : 0;
    const curX = centerX + currentFrame * scaleX;
    if (curX >= padding.left && curX <= width - padding.right) {
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(curX, padding.top);
      ctx.lineTo(curX, height - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    function currentTimeToFrame() {
      const { animationClips, currentClipId, currentTime } = useAppStore.getState();
      const c = animationClips.find(cc => cc.id === currentClipId);
      return c ? currentTime * c.fps : 0;
    }
  }, [
    showGraphEditor, clip, selectedJointId, selectedJoint,
    graphEditorChannels, graphEditorZoom, offset, currentClipId, animationClips,
    skeleton,
  ]);
  
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
    }
  }, [clip, selectedJointId, offset]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (panning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setOffset({ x: panOffsetStart.x + dx, y: panOffsetStart.y + dy });
    }
  }, [panning, panStart, panOffsetStart]);
  
  const handleMouseUp = useCallback(() => {
    setPanning(false);
    setDraggingKf(null);
  }, []);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setGraphEditorZoom(graphEditorZoom * delta);
  }, [graphEditorZoom, setGraphEditorZoom]);
  
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || !clip || !selectedJointId) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const height = rect.height;
    
    const padding = { left: 50, right: 20, top: 20, bottom: 30 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const durationFrames = Math.ceil(clip.duration * clip.fps) || 100;
    const scaleX = chartWidth / durationFrames * graphEditorZoom;
    const centerX = offset.x + padding.left;
    const chartHeight2 = chartHeight;
    const centerY = offset.y + padding.top + chartHeight2 / 2;
    
    const frame = Math.round((x - centerX) / scaleX);
    if (frame < 0) return;
    
    const joint = skeleton.joints.get(selectedJointId);
    if (joint) {
      addKeyframe(selectedJointId, frame);
    }
  }, [clip, selectedJointId, graphEditorZoom, offset, skeleton, addKeyframe]);
  
  if (!showGraphEditor) return null;
  
  return (
    <div className="graph-editor-panel">
      <div className="graph-editor-header">
        <div className="editor-title">曲线编辑器 (Graph Editor)</div>
        <div className="editor-controls">
          <label className="channel-toggle">
            <input 
              type="checkbox" 
              checked={graphEditorChannels.includes('x')}
              onChange={() => toggleGraphEditorChannel('x')}
            />
            <span style={{ color: '#ff5555' }}>X</span>
          </label>
          <label className="channel-toggle">
            <input 
              type="checkbox" 
              checked={graphEditorChannels.includes('y')}
              onChange={() => toggleGraphEditorChannel('y')}
            />
            <span style={{ color: '#55ff55' }}>Y</span>
          </label>
          <label className="channel-toggle">
            <input 
              type="checkbox" 
              checked={graphEditorChannels.includes('z')}
              onChange={() => toggleGraphEditorChannel('z')}
            />
            <span style={{ color: '#5588ff' }}>Z</span>
          </label>
          <span className="zoom-info">缩放: {(graphEditorZoom * 100).toFixed(0)}%</span>
          <button onClick={() => { setOffset({ x: 0, y: 0 }); setGraphEditorZoom(1); }}>
            重置视图
          </button>
          <button onClick={() => setShowGraphEditor(false)} className="close-btn">
            ×
          </button>
        </div>
      </div>
      <div className="editor-info">
        {selectedJoint 
          ? `编辑关节: ${selectedJoint.name} | ${clip ? `动画: ${clip.name} (${clip.duration.toFixed(2)}s)` : '请选择动画'}`
          : '请选择一个关节进行编辑'}
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#666' }}>
          Shift+拖拽: 平移视图 | 滚轮: 缩放 | 双击: 添加关键帧
        </span>
      </div>
      <div className="graph-canvas-container" ref={containerRef}>
        <canvas 
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
          style={{ cursor: panning ? 'grab' : 'crosshair' }}
        />
      </div>
    </div>
  );
}
