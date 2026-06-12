import { useAppStore } from '../store/useAppStore';
import { getChildJoints } from '../core/skeleton';
import { Joint } from '../types';

interface JointNodeProps {
  joint: Joint;
  depth: number;
  onSelect: (id: string) => void;
  selectedId: string | null;
}

function JointNode({ joint, depth, onSelect, selectedId }: JointNodeProps) {
  const { skeleton } = useAppStore();
  const children = getChildJoints(skeleton, joint.id);
  const isSelected = selectedId === joint.id;
  
  return (
    <div className="joint-node">
      <div 
        className={`joint-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(joint.id)}
      >
        <span className="joint-icon">●</span>
        <span className="joint-name">{joint.name}</span>
      </div>
      {children.length > 0 && (
        <div className="joint-children">
          {children.map(child => (
            <JointNode 
              key={child.id} 
              joint={child} 
              depth={depth + 1}
              onSelect={onSelect}
              selectedId={selectedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HierarchyPanel() {
  const { 
    skeleton, 
    selectedJointId, 
    selectJoint,
    deleteJoint,
    addJoint,
  } = useAppStore();
  
  const rootJoint = skeleton.rootJointId ? skeleton.joints.get(skeleton.rootJointId) : null;
  
  const handleAddChild = () => {
    if (selectedJointId) {
      addJoint(selectedJointId, { x: 0, y: 1, z: 0 } as any);
    }
  };
  
  const handleDelete = () => {
    if (selectedJointId) {
      deleteJoint(selectedJointId);
    }
  };
  
  return (
    <div className="hierarchy-panel">
      <h3>骨架层级</h3>
      
      <div className="hierarchy-toolbar">
        <button onClick={handleAddChild} disabled={!selectedJointId}>
          + 添加子关节
        </button>
        <button onClick={handleDelete} disabled={!selectedJointId}>
          - 删除
        </button>
      </div>
      
      <div className="hierarchy-tree">
        {rootJoint ? (
          <JointNode 
            joint={rootJoint} 
            depth={0}
            onSelect={selectJoint}
            selectedId={selectedJointId}
          />
        ) : (
          <p style={{ color: '#888', fontSize: '0.9em' }}>无关节</p>
        )}
      </div>
      
      <div className="skeleton-info">
        <p>关节总数: {skeleton.joints.size}</p>
      </div>
    </div>
  );
}
