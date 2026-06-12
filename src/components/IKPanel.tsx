import { useAppStore } from '../store/useAppStore';
import { IKAlgorithm, IKTarget } from '../types';
import { getJointChain } from '../core/skeleton';

export default function IKPanel() {
  const {
    ikMode,
    toggleIkMode,
    ikConfig,
    updateIkConfig,
    ikTargets,
    addIkTarget,
    removeIkTarget,
    selectedJointId,
    skeleton,
    selectIkTarget,
    selectedIkTargetId,
    solveIk,
  } = useAppStore();
  
  const canAddTarget = selectedJointId && 
    getJointChain(skeleton, selectedJointId).length >= 2;
  
  const algorithms: { value: IKAlgorithm; label: string; desc: string }[] = [
    { value: 'ccd', label: 'CCD', desc: '循环坐标下降法' },
    { value: 'fabrik', label: 'FABRIK', desc: '前向后向到达法' },
    { value: 'jacobian', label: '雅可比转置', desc: '雅可比转置法' },
    { value: 'dls', label: 'DLS', desc: '阻尼最小二乘法' },
  ];
  
  return (
    <div className="ik-panel">
      <h3>IK 求解器</h3>
      
      <div className="ik-toggle">
        <button 
          className={ikMode ? 'active' : ''}
          onClick={toggleIkMode}
        >
          {ikMode ? '✓ IK模式已启用' : '启用IK模式'}
        </button>
      </div>
      
      <div className="ik-section">
        <label>求解算法</label>
        <div className="algorithm-list">
          {algorithms.map(algo => (
            <button
              key={algo.value}
              className={`algo-btn ${ikConfig.algorithm === algo.value ? 'active' : ''}`}
              onClick={() => updateIkConfig({ algorithm: algo.value })}
            >
              <div className="algo-name">{algo.label}</div>
              <div className="algo-desc">{algo.desc}</div>
            </button>
          ))}
        </div>
      </div>
      
      <div className="ik-section">
        <label>求解参数</label>
        
        <div className="param-row">
          <span>最大迭代次数</span>
          <input 
            type="number" 
            value={ikConfig.maxIterations}
            onChange={(e) => updateIkConfig({ maxIterations: parseInt(e.target.value) })}
            min={1}
            max={100}
          />
        </div>
        
        <div className="param-row">
          <span>收敛阈值</span>
          <input 
            type="number" 
            value={ikConfig.convergenceThreshold}
            onChange={(e) => updateIkConfig({ convergenceThreshold: parseFloat(e.target.value) })}
            step="0.001"
            min="0.0001"
          />
        </div>
        
        {ikConfig.algorithm === 'jacobian' && (
          <div className="param-row">
            <span>步长因子 α</span>
            <input 
              type="number" 
              value={ikConfig.stepSize}
              onChange={(e) => updateIkConfig({ stepSize: parseFloat(e.target.value) })}
              step="0.01"
              min="0.001"
              max="1"
            />
          </div>
        )}
        
        {ikConfig.algorithm === 'dls' && (
          <>
            <div className="param-row">
              <span>阻尼因子 λ</span>
              <input 
                type="number" 
                value={ikConfig.dampingFactor}
                onChange={(e) => updateIkConfig({ dampingFactor: parseFloat(e.target.value) })}
                step="0.001"
                min="0.001"
              />
            </div>
            <div className="param-row">
              <span>自适应阻尼</span>
              <input 
                type="checkbox" 
                checked={ikConfig.adaptiveDamping}
                onChange={(e) => updateIkConfig({ adaptiveDamping: e.target.checked })}
              />
            </div>
          </>
        )}
      </div>
      
      <div className="ik-section">
        <label>IK目标点</label>
        
        <button 
          className="add-target-btn"
          onClick={() => canAddTarget && addIkTarget(selectedJointId!)}
          disabled={!canAddTarget}
        >
          + 添加IK目标
        </button>
        {!canAddTarget && selectedJointId && (
          <p className="hint">选择末端关节添加IK目标</p>
        )}
        
        <div className="target-list">
          {ikTargets.map(target => {
            const joint = skeleton.joints.get(target.jointId);
            const isSelected = selectedIkTargetId === target.id;
            return (
              <div 
                key={target.id}
                className={`target-item ${isSelected ? 'selected' : ''}`}
                onClick={() => selectIkTarget(target.id)}
              >
                <div className="target-info">
                  <span className="target-name">{joint?.name || '未知'}</span>
                  <span className="target-priority">优先级: {target.priority}</span>
                </div>
                <button 
                  className="remove-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeIkTarget(target.id);
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
        
        {ikTargets.length === 0 && (
          <p className="hint">暂无IK目标点</p>
        )}
      </div>
      
      {ikTargets.length > 0 && (
        <button className="solve-btn" onClick={solveIk}>
          求解IK
        </button>
      )}
    </div>
  );
}
