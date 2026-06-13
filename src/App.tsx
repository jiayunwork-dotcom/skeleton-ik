import { useState } from 'react';
import Viewport from './components/Viewport';
import Toolbar from './components/Toolbar';
import HierarchyPanel from './components/HierarchyPanel';
import PropertiesPanel from './components/PropertiesPanel';
import IKPanel from './components/IKPanel';
import TimelinePanel from './components/TimelinePanel';
import ExportPanel from './components/ExportPanel';
import GraphEditor from './components/GraphEditor';
import SkinPanel from './components/SkinPanel';
import './App.css';

type RightPanelTab = 'properties' | 'ik' | 'skin' | 'export';

function App() {
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('properties');
  
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>骨骼动画 IK 编辑器</h1>
      </header>
      
      <Toolbar />
      
      <div className="main-content">
        <aside className="left-panel">
          <HierarchyPanel />
        </aside>
        
        <main className="viewport-and-graph">
          <div className="viewport-container">
            <Viewport />
          </div>
          <GraphEditor />
        </main>
        
        <aside className="right-panel">
          <div className="panel-tabs">
            <button 
              className={rightPanelTab === 'properties' ? 'active' : ''}
              onClick={() => setRightPanelTab('properties')}
            >
              属性
            </button>
            <button 
              className={rightPanelTab === 'ik' ? 'active' : ''}
              onClick={() => setRightPanelTab('ik')}
            >
              IK
            </button>
            <button 
              className={rightPanelTab === 'skin' ? 'active' : ''}
              onClick={() => setRightPanelTab('skin')}
            >
              蒙皮
            </button>
            <button 
              className={rightPanelTab === 'export' ? 'active' : ''}
              onClick={() => setRightPanelTab('export')}
            >
              导出
            </button>
          </div>
          
          <div className="panel-content">
            {rightPanelTab === 'properties' && <PropertiesPanel />}
            {rightPanelTab === 'ik' && <IKPanel />}
            {rightPanelTab === 'skin' && <SkinPanel />}
            {rightPanelTab === 'export' && <ExportPanel />}
          </div>
        </aside>
      </div>
      
      <footer className="timeline-container">
        <TimelinePanel />
      </footer>
    </div>
  );
}

export default App;
