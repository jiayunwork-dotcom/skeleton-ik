import { useAppStore } from '../store/useAppStore';
import { createHumanoidSkeleton, createQuadrupedSkeleton, createSnakeSkeleton, createSpiderSkeleton } from '../core/skeletonTemplates';
import { ViewMode, Mode2D3D } from '../types';

export default function Toolbar() {
  const {
    viewportConfig,
    setViewMode,
    setMode2D3D,
    updateViewportConfig,
    loadTemplate,
    ikMode,
    toggleIkMode,
  } = useAppStore();
  
  const templates = [
    { name: '人形', loader: createHumanoidSkeleton },
    { name: '四足', loader: createQuadrupedSkeleton },
    { name: '蛇形', loader: createSnakeSkeleton },
    { name: '蜘蛛', loader: createSpiderSkeleton },
  ];
  
  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <span className="toolbar-label">骨架模板:</span>
        {templates.map(t => (
          <button 
            key={t.name}
            onClick={() => loadTemplate(t.loader)}
          >
            {t.name}
          </button>
        ))}
      </div>
      
      <div className="toolbar-divider" />
      
      <div className="toolbar-section">
        <span className="toolbar-label">视图模式:</span>
        <button 
          className={viewportConfig.viewMode === 'solid' ? 'active' : ''}
          onClick={() => setViewMode('solid')}
        >
          实体
        </button>
        <button 
          className={viewportConfig.viewMode === 'wireframe' ? 'active' : ''}
          onClick={() => setViewMode('wireframe')}
        >
          线框
        </button>
        <button 
          className={viewportConfig.viewMode === 'xray' ? 'active' : ''}
          onClick={() => setViewMode('xray')}
        >
          X光
        </button>
      </div>
      
      <div className="toolbar-divider" />
      
      <div className="toolbar-section">
        <span className="toolbar-label">2D/3D:</span>
        <button 
          className={viewportConfig.mode2D3D === '3d' ? 'active' : ''}
          onClick={() => setMode2D3D('3d')}
        >
          3D
        </button>
        <button 
          className={viewportConfig.mode2D3D === '2d' ? 'active' : ''}
          onClick={() => setMode2D3D('2d')}
        >
          2D
        </button>
      </div>
      
      <div className="toolbar-divider" />
      
      <div className="toolbar-section">
        <button 
          className={ikMode ? 'active ik-btn' : 'ik-btn'}
          onClick={toggleIkMode}
        >
          {ikMode ? 'IK模式' : 'FK模式'}
        </button>
      </div>
      
      <div className="toolbar-divider" />
      
      <div className="toolbar-section">
        <label className="toolbar-checkbox">
          <input 
            type="checkbox" 
            checked={viewportConfig.showGrid}
            onChange={(e) => updateViewportConfig({ showGrid: e.target.checked })}
          />
          网格
        </label>
        <label className="toolbar-checkbox">
          <input 
            type="checkbox" 
            checked={viewportConfig.showAxes}
            onChange={(e) => updateViewportConfig({ showAxes: e.target.checked })}
          />
          坐标轴
        </label>
      </div>
    </div>
  );
}
