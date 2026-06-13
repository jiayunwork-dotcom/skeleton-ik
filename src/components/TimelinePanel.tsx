import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { InterpolationType } from '../types';
import { getKeyframes } from '../core/animation';

export default function TimelinePanel() {
  const {
    animationClips,
    currentClipId,
    currentTime,
    isPlaying,
    selectAnimationClip,
    addAnimationClip,
    addKeyframe,
    setCurrentTime,
    setPlaying,
    setInterpolation,
    selectedJointId,
    skeleton,
    showGraphEditor,
    setShowGraphEditor,
    onionSkinEnabled,
    setOnionSkinEnabled,
    onionSkinFramesBefore,
    setOnionSkinFramesBefore,
    onionSkinFramesAfter,
    setOnionSkinFramesAfter,
    onionSkinOpacity,
    setOnionSkinOpacity,
  } = useAppStore();
  
  const [fps, setFps] = useState(30);
  const [newClipName, setNewClipName] = useState('');
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  
  const currentClip = animationClips.find(c => c.id === currentClipId);
  
  useEffect(() => {
    if (!isPlaying || !currentClip) return;
    
    const animate = (timestamp: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
      }
      
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;
      
      let newTime = currentTime + delta;
      if (newTime > currentClip.duration) {
        newTime = 0;
      }
      
      setCurrentTime(newTime);
      animationRef.current = requestAnimationFrame(animate);
    };
    
    lastTimeRef.current = 0;
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, currentClip, currentTime, setCurrentTime]);
  
  const handlePlayPause = () => {
    if (!currentClip) return;
    setPlaying(!isPlaying);
  };
  
  const handleAddClip = () => {
    if (newClipName.trim()) {
      addAnimationClip(newClipName.trim());
      setNewClipName('');
    }
  };
  
  const handleAddKeyframe = () => {
    if (!currentClip || !selectedJointId) return;
    const frame = Math.round(currentTime * fps);
    addKeyframe(selectedJointId, frame);
  };
  
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
  };
  
  const interpolationTypes: { value: InterpolationType; label: string }[] = [
    { value: 'linear', label: '线性' },
    { value: 'bezier', label: '三次Bezier' },
    { value: 'hermite', label: 'Hermite样条' },
  ];
  
  const currentFrame = currentClip ? Math.round(currentTime * fps) : 0;
  const totalFrames = currentClip ? Math.ceil(currentClip.duration * fps) : 0;
  
  const selectedKeyframes = selectedJointId && currentClip 
    ? getKeyframes(currentClip, selectedJointId) 
    : [];
  
  return (
    <div className="timeline-panel">
      <div className="timeline-toolbar">
        <div className="clip-controls">
          <select 
            value={currentClipId || ''}
            onChange={(e) => selectAnimationClip(e.target.value || null)}
          >
            <option value="">-- 选择动画 --</option>
            {animationClips.map(clip => (
              <option key={clip.id} value={clip.id}>{clip.name}</option>
            ))}
          </select>
          
          <input 
            type="text"
            placeholder="新动画名称"
            value={newClipName}
            onChange={(e) => setNewClipName(e.target.value)}
          />
          <button onClick={handleAddClip}>+ 新建</button>
        </div>
        
        <div className="playback-controls">
          <button onClick={() => setCurrentTime(0)}>⏮</button>
          <button onClick={handlePlayPause} disabled={!currentClip}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button onClick={() => setCurrentTime(currentClip?.duration || 0)}>⏭</button>
          
          <span className="time-display">
            {currentTime.toFixed(2)}s / {currentClip?.duration.toFixed(2) || '0.00'}s
          </span>
        </div>
        
        <div className="fps-control">
          <label>FPS:</label>
          <select value={fps} onChange={(e) => setFps(parseInt(e.target.value))}>
            <option value={24}>24</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </div>
        
        <div className="interpolation-control">
          <label>插值:</label>
          <select 
            value={currentClip?.interpolationType || 'bezier'}
            onChange={(e) => currentClip && setInterpolation(e.target.value as InterpolationType)}
            disabled={!currentClip}
          >
            {interpolationTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        
        <div className="divider" />
        
        <button 
          className={`tool-btn ${showGraphEditor ? 'active' : ''}`}
          onClick={() => setShowGraphEditor(!showGraphEditor)}
          title="曲线编辑器"
        >
          📈 曲线编辑器
        </button>
        
        <div className="onion-skin-controls">
          <label className="onion-toggle">
            <input 
              type="checkbox"
              checked={onionSkinEnabled}
              onChange={(e) => setOnionSkinEnabled(e.target.checked)}
            />
            <span title="洋葱皮">🧅 洋葱皮</span>
          </label>
          {onionSkinEnabled && (
            <>
              <div className="onion-subcontrol">
                <label>前:</label>
                <input 
                  type="number"
                  min={0}
                  max={10}
                  value={onionSkinFramesBefore}
                  onChange={(e) => setOnionSkinFramesBefore(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="onion-subcontrol">
                <label>后:</label>
                <input 
                  type="number"
                  min={0}
                  max={10}
                  value={onionSkinFramesAfter}
                  onChange={(e) => setOnionSkinFramesAfter(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="onion-subcontrol">
                <label>透明度:</label>
                <input 
                  type="range"
                  min={0.05}
                  max={0.8}
                  step={0.05}
                  value={onionSkinOpacity}
                  onChange={(e) => setOnionSkinOpacity(parseFloat(e.target.value))}
                />
                <span className="value-label">{(onionSkinOpacity * 100).toFixed(0)}%</span>
              </div>
            </>
          )}
        </div>
      </div>
      
      <div className="timeline-track">
        <input
          type="range"
          min={0}
          max={currentClip?.duration || 0}
          step={0.01}
          value={currentTime}
          onChange={handleTimeChange}
          className="time-slider"
          disabled={!currentClip}
        />
        
        <div className="keyframes-indicator">
          {selectedKeyframes.map((kf, i) => {
            const kfTime = kf.frame / fps;
            const position = currentClip ? (kfTime / currentClip.duration) * 100 : 0;
            return (
              <div 
                key={i}
                className="keyframe-marker"
                style={{ left: `${position}%` }}
                title={`帧 ${kf.frame}`}
              />
            );
          })}
        </div>
      </div>
      
      <div className="timeline-footer">
        <button 
          onClick={handleAddKeyframe}
          disabled={!selectedJointId || !currentClip}
        >
          + 添加关键帧
        </button>
        <span className="frame-info">
          帧: {currentFrame} / {totalFrames}
        </span>
        {selectedJointId && (
          <span className="selected-info">
            当前关节: {skeleton.joints.get(selectedJointId)?.name}
          </span>
        )}
      </div>
    </div>
  );
}
