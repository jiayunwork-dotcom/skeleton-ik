import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { radToDeg, degToRad, matrixToEuler, matrix4ToFlatArray, detectGimbalLock } from '../utils/math';
import { getJointWorldMatrix, getJointWorldPosition, getJointWorldQuaternion } from '../core/skeleton';

export default function PropertiesPanel() {
  const {
    skeleton,
    selectedJointId,
    updateJointName,
    updateJointLength,
    updateJointConstraint,
    setSelectedJointRotation,
  } = useAppStore();
  
  const [rotationMode, setRotationMode] = useState<'euler' | 'quaternion'>('euler');
  
  const selectedJoint = selectedJointId ? skeleton.joints.get(selectedJointId) : null;
  
  if (!selectedJoint) {
    return (
      <div className="properties-panel">
        <h3>属性面板</h3>
        <p style={{ color: '#888', fontSize: '0.9em' }}>选择一个关节查看属性</p>
      </div>
    );
  }
  
  const worldPos = getJointWorldPosition(skeleton, selectedJointId!);
  const worldMatrix = getJointWorldMatrix(skeleton, selectedJointId!);
  const worldMatrixFlat = matrix4ToFlatArray(worldMatrix);
  const hasGimbalLock = detectGimbalLock(selectedJoint.rotation);
  
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateJointName(selectedJointId!, e.target.value);
  };
  
  const handleLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const length = parseFloat(e.target.value);
    if (!isNaN(length) && length > 0.01) {
      updateJointLength(selectedJointId!, length);
    }
  };
  
  const handleRotationChange = (axis: 'x' | 'y' | 'z', valueDeg: number) => {
    const newRotation = selectedJoint.rotation.clone();
    newRotation[axis] = degToRad(valueDeg);
    setSelectedJointRotation(newRotation);
  };
  
  const handleConstraintChange = (axis: 'minX' | 'maxX' | 'minY' | 'maxY' | 'minZ' | 'maxZ', valueDeg: number) => {
    const newConstraint = { ...selectedJoint.constraint };
    newConstraint[axis] = degToRad(valueDeg);
    updateJointConstraint(selectedJointId!, newConstraint);
  };
  
  const handleDofTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newConstraint = { 
      ...selectedJoint.constraint, 
      dofType: e.target.value as 'spherical' | 'hinge' | 'saddle' 
    };
    updateJointConstraint(selectedJointId!, newConstraint);
  };
  
  return (
    <div className="properties-panel">
      <h3>属性面板</h3>
      
      <div className="property-section">
        <label>名称</label>
        <input 
          type="text" 
          value={selectedJoint.name} 
          onChange={handleNameChange}
        />
      </div>
      
      <div className="property-section">
        <label>骨骼长度</label>
        <input 
          type="number" 
          value={selectedJoint.length.toFixed(3)} 
          onChange={handleLengthChange}
          step="0.1"
          min="0.01"
        />
      </div>
      
      <div className="property-section">
        <label>旋转模式</label>
        <div className="mode-toggle">
          <button 
            className={rotationMode === 'euler' ? 'active' : ''}
            onClick={() => setRotationMode('euler')}
          >
            欧拉角
          </button>
          <button 
            className={rotationMode === 'quaternion' ? 'active' : ''}
            onClick={() => setRotationMode('quaternion')}
          >
            四元数
          </button>
        </div>
      </div>
      
      {rotationMode === 'euler' && (
        <div className="property-section">
          <label>旋转 (度)</label>
          {hasGimbalLock && (
            <div className="warning" style={{ color: '#ff6600', fontSize: '0.8em', marginBottom: '5px' }}>
              ⚠ 万向锁警告
            </div>
          )}
          <div className="vector-input">
            <span>X</span>
            <input 
              type="number" 
              value={radToDeg(selectedJoint.rotation.x).toFixed(1)} 
              onChange={(e) => handleRotationChange('x', parseFloat(e.target.value))}
              step="1"
            />
          </div>
          <div className="vector-input">
            <span>Y</span>
            <input 
              type="number" 
              value={radToDeg(selectedJoint.rotation.y).toFixed(1)} 
              onChange={(e) => handleRotationChange('y', parseFloat(e.target.value))}
              step="1"
            />
          </div>
          <div className="vector-input">
            <span>Z</span>
            <input 
              type="number" 
              value={radToDeg(selectedJoint.rotation.z).toFixed(1)} 
              onChange={(e) => handleRotationChange('z', parseFloat(e.target.value))}
              step="1"
            />
          </div>
        </div>
      )}
      
      {rotationMode === 'quaternion' && (
        <div className="property-section">
          <label>四元数</label>
          <div className="vector-input">
            <span>X</span>
            <input type="number" value={selectedJoint.quaternion.x.toFixed(4)} readOnly />
          </div>
          <div className="vector-input">
            <span>Y</span>
            <input type="number" value={selectedJoint.quaternion.y.toFixed(4)} readOnly />
          </div>
          <div className="vector-input">
            <span>Z</span>
            <input type="number" value={selectedJoint.quaternion.z.toFixed(4)} readOnly />
          </div>
          <div className="vector-input">
            <span>W</span>
            <input type="number" value={selectedJoint.quaternion.w.toFixed(4)} readOnly />
          </div>
        </div>
      )}
      
      <div className="property-section">
        <label>世界位置</label>
        <div className="vector-input">
          <span>X</span>
          <input type="number" value={worldPos.x.toFixed(3)} readOnly />
        </div>
        <div className="vector-input">
          <span>Y</span>
          <input type="number" value={worldPos.y.toFixed(3)} readOnly />
        </div>
        <div className="vector-input">
          <span>Z</span>
          <input type="number" value={worldPos.z.toFixed(3)} readOnly />
        </div>
      </div>
      
      <div className="property-section">
        <label>自由度类型</label>
        <select value={selectedJoint.constraint.dofType} onChange={handleDofTypeChange}>
          <option value="spherical">球形关节 (3DOF)</option>
          <option value="hinge">铰链关节 (1DOF)</option>
          <option value="saddle">鞍形关节 (2DOF)</option>
        </select>
      </div>
      
      <div className="property-section">
        <label>旋转约束 (度)</label>
        <div className="constraint-row">
          <span>X轴</span>
          <input 
            type="number" 
            value={radToDeg(selectedJoint.constraint.minX).toFixed(0)} 
            onChange={(e) => handleConstraintChange('minX', parseFloat(e.target.value))}
          />
          <span>~</span>
          <input 
            type="number" 
            value={radToDeg(selectedJoint.constraint.maxX).toFixed(0)} 
            onChange={(e) => handleConstraintChange('maxX', parseFloat(e.target.value))}
          />
        </div>
        <div className="constraint-row">
          <span>Y轴</span>
          <input 
            type="number" 
            value={radToDeg(selectedJoint.constraint.minY).toFixed(0)} 
            onChange={(e) => handleConstraintChange('minY', parseFloat(e.target.value))}
          />
          <span>~</span>
          <input 
            type="number" 
            value={radToDeg(selectedJoint.constraint.maxY).toFixed(0)} 
            onChange={(e) => handleConstraintChange('maxY', parseFloat(e.target.value))}
          />
        </div>
        <div className="constraint-row">
          <span>Z轴</span>
          <input 
            type="number" 
            value={radToDeg(selectedJoint.constraint.minZ).toFixed(0)} 
            onChange={(e) => handleConstraintChange('minZ', parseFloat(e.target.value))}
          />
          <span>~</span>
          <input 
            type="number" 
            value={radToDeg(selectedJoint.constraint.maxZ).toFixed(0)} 
            onChange={(e) => handleConstraintChange('maxZ', parseFloat(e.target.value))}
          />
        </div>
      </div>
      
      <div className="property-section">
        <details>
          <summary>变换矩阵 (4x4)</summary>
          <div className="matrix-display">
            {worldMatrixFlat.map((row, i) => (
              <div key={i} className="matrix-row">
                {row.map((val, j) => (
                  <span key={j} className="matrix-cell">
                    {val.toFixed(2)}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
