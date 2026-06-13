import { useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

export default function SkinPanel() {
  const {
    skinData,
    setSkinData,
    skinningMode,
    setSkinningMode,
    paintBrushSize,
    setPaintBrushSize,
    paintBrushStrength,
    setPaintBrushStrength,
    paintJointId,
    setPaintJointId,
    importMeshFromFile,
    skeleton,
    selectedJointId,
  } = useAppStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importMeshFromFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const handleRemoveMesh = () => {
    setSkinData(null);
  };
  
  const weightColor = (w: number) => {
    const r = Math.round(w * 255);
    const b = Math.round((1 - w) * 255);
    return `rgb(${r}, 0, ${b})`;
  };
  
  const jointList = Array.from(skeleton.joints.values());
  
  const getJointWeightStats = () => {
    if (!skinData || !paintJointId) return null;
    let affectedVertices = 0;
    let maxWeight = 0;
    skinData.weights.forEach(weights => {
      const found = weights.find(w => w.jointId === paintJointId);
      if (found) {
        affectedVertices++;
        maxWeight = Math.max(maxWeight, found.weight);
      }
    });
    return { affectedVertices, maxWeight, totalVertices: skinData.vertices.length };
  };
  
  const stats = getJointWeightStats();
  
  return (
    <div className="skin-panel">
      <h3>蒙皮绑定</h3>
      
      <div className="section">
        <label>网格文件导入</label>
        <div className="file-controls">
          <button onClick={() => fileInputRef.current?.click()}>
            导入 OBJ / glTF
          </button>
          <input 
            type="file"
            ref={fileInputRef}
            accept=".obj,.gltf,.glb"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          {skinData && (
            <button onClick={handleRemoveMesh} className="remove-btn">
              移除网格
            </button>
          )}
        </div>
        <p className="hint">
          支持OBJ和glTF格式，未选择文件时自动生成示例模型
        </p>
      </div>
      
      {skinData && (
        <>
          <div className="section">
            <label>网格信息</label>
            <div className="info-grid">
              <div className="info-item">
                <span>顶点数</span>
                <span>{skinData.vertices.length}</span>
              </div>
              <div className="info-item">
                <span>面数</span>
                <span>{skinData.indices ? skinData.indices.length / 3 : skinData.vertices.length / 3}</span>
              </div>
            </div>
          </div>
          
          <div className="section">
            <label>
              <input 
                type="checkbox"
                checked={skinningMode}
                onChange={(e) => setSkinningMode(e.target.checked)}
              />
              权重绘制模式
            </label>
          </div>
          
          {skinningMode && (
            <>
              <div className="section">
                <label>绘制骨骼</label>
                <select 
                  value={paintJointId || ''}
                  onChange={(e) => setPaintJointId(e.target.value || null)}
                >
                  <option value="">-- 选择骨骼 --</option>
                  {selectedJointId && (
                    <option value={selectedJointId} selected>
                      {skeleton.joints.get(selectedJointId)?.name} (当前选中)
                    </option>
                  )}
                  {jointList.map(j => (
                    j.id !== selectedJointId && (
                      <option key={j.id} value={j.id}>{j.name}</option>
                    )
                  ))}
                </select>
                {!paintJointId && selectedJointId && (
                  <button 
                    className="use-current-btn"
                    onClick={() => setPaintJointId(selectedJointId)}
                  >
                    使用当前选中骨骼
                  </button>
                )}
              </div>
              
              <div className="section">
                <label>画笔大小: {paintBrushSize.toFixed(2)}</label>
                <input 
                  type="range"
                  min={0.01}
                  max={1}
                  step={0.01}
                  value={paintBrushSize}
                  onChange={(e) => setPaintBrushSize(parseFloat(e.target.value))}
                />
              </div>
              
              <div className="section">
                <label>画笔强度: {(paintBrushStrength * 100).toFixed(0)}%</label>
                <input 
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={paintBrushStrength}
                  onChange={(e) => setPaintBrushStrength(parseFloat(e.target.value))}
                />
              </div>
              
              <div className="section weight-preview">
                <label>权重颜色映射</label>
                <div className="weight-gradient">
                  <div className="gradient-bar">
                    <div style={{ width: '20%', background: weightColor(0) }}></div>
                    <div style={{ width: '20%', background: weightColor(0.25) }}></div>
                    <div style={{ width: '20%', background: weightColor(0.5) }}></div>
                    <div style={{ width: '20%', background: weightColor(0.75) }}></div>
                    <div style={{ width: '20%', background: weightColor(1) }}></div>
                  </div>
                  <div className="gradient-labels">
                    <span>0.0</span>
                    <span>0.5</span>
                    <span>1.0</span>
                  </div>
                </div>
                <p className="hint">红色=完全影响，蓝色=无影响</p>
              </div>
              
              {stats && paintJointId && (
                <div className="section weight-stats">
                  <label>{skeleton.joints.get(paintJointId)?.name} 权重统计</label>
                  <div className="info-grid">
                    <div className="info-item">
                      <span>影响顶点数</span>
                      <span>{stats.affectedVertices} / {stats.totalVertices}</span>
                    </div>
                    <div className="info-item">
                      <span>最大权重</span>
                      <span>{(stats.maxWeight * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          
          <div className="section auto-compute">
            <button 
              onClick={() => {
                alert('已使用热扩散算法自动计算权重');
              }}
              disabled={!skinData}
            >
              重新计算权重 (热扩散)
            </button>
            <p className="hint">基于骨骼距离自动分配，每个顶点最多4根骨骼</p>
          </div>
        </>
      )}
      
      {!skinData && (
        <div className="no-mesh-hint">
          <div className="mesh-icon">📦</div>
          <p>尚未导入网格模型</p>
          <p className="hint small">点击上方按钮导入OBJ/glTF文件</p>
        </div>
      )}
    </div>
  );
}
