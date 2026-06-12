import { useAppStore } from '../store/useAppStore';
import { exportSkeletonJSON, exportAnimationJSON, exportBVH, exportGLTF, downloadFile } from '../core/export';

export default function ExportPanel() {
  const {
    skeleton,
    animationClips,
    currentClipId,
    skinData,
  } = useAppStore();
  
  const currentClip = animationClips.find(c => c.id === currentClipId);
  
  const handleExportJSON = () => {
    if (currentClip) {
      const content = exportAnimationJSON(skeleton, currentClip);
      downloadFile(content, `${currentClip.name}.json`, 'application/json');
    } else {
      const content = exportSkeletonJSON(skeleton);
      downloadFile(content, `${skeleton.name}.json`, 'application/json');
    }
  };
  
  const handleExportBVH = () => {
    if (!currentClip) {
      alert('请先选择一个动画');
      return;
    }
    const content = exportBVH(skeleton, currentClip);
    downloadFile(content, `${currentClip.name}.bvh`, 'text/plain');
  };
  
  const handleExportGLTF = () => {
    if (!currentClip) {
      alert('请先选择一个动画');
      return;
    }
    const content = exportGLTF(skeleton, currentClip, skinData || undefined);
    downloadFile(content, 'skeleton.gltf', 'application/json');
  };
  
  return (
    <div className="export-panel">
      <h3>导出</h3>
      
      <div className="export-section">
        <button onClick={handleExportJSON}>
          导出 JSON
        </button>
        <p className="export-desc">
          {currentClip ? '导出骨架+动画数据' : '导出骨架定义'}
        </p>
      </div>
      
      <div className="export-section">
        <button onClick={handleExportBVH} disabled={!currentClip}>
          导出 BVH
        </button>
        <p className="export-desc">动捕数据格式</p>
      </div>
      
      <div className="export-section">
        <button onClick={handleExportGLTF}>
          导出 glTF
        </button>
        <p className="export-desc">带蒙皮信息 (glTF 2.0)</p>
      </div>
      
      {currentClip && (
        <div className="export-info">
          <p>当前动画: {currentClip.name}</p>
          <p>时长: {currentClip.duration.toFixed(2)}s</p>
          <p>帧率: {currentClip.fps}fps</p>
        </div>
      )}
    </div>
  );
}
