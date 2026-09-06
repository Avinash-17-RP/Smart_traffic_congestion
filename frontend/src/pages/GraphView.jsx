import { useEffect, useState } from 'react';
import { socket } from '../App';
import { Network, Activity, Zap, ShieldAlert, Split } from 'lucide-react';

export default function GraphView() {
  const [graph, setGraph] = useState({ junctions: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [scenarioPath, setScenarioPath] = useState(null);
  const [scenarioDetails, setScenarioDetails] = useState(null);
  const [scenarioFrom, setScenarioFrom] = useState(localStorage.getItem('citizen_from') || 'j1');
  const [scenarioTo, setScenarioTo] = useState(localStorage.getItem('citizen_to') || 'j11');
  
  useEffect(() => {
    fetchGraph();
    
    socket.on('graph:update', fetchGraph);
    socket.on('junction:update', (updatedJunction) => {
      setGraph(prev => ({
        ...prev,
        junctions: prev.junctions.map(j => j.id === updatedJunction.id ? updatedJunction : j)
      }));
      if (selectedNode && selectedNode.id === updatedJunction.id) {
        setSelectedNode(updatedJunction);
      }
    });

    socket.on('emergency:started', (data) => {
      setScenarioPath(data.path.map(p => p.id));
      setScenarioDetails({ type: 'Emergency Broadcast Active' });
    });
    
    socket.on('emergency:cleared', () => {
      setScenarioPath(null);
      setScenarioDetails(null);
    });

    return () => {
      socket.off('graph:update');
      socket.off('junction:update');
      socket.off('emergency:started');
      socket.off('emergency:cleared');
    };
  }, [selectedNode]);

  const fetchGraph = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/graph');
      const data = await res.json();
      setGraph(data);
      // update selected node if open
      if (selectedNode) {
         const updated = data.junctions.find(j => j.id === selectedNode.id);
         if (updated) setSelectedNode(updated);
      }
    } catch(err) {
      console.error(err);
    }
  };

  const toggleMode = async (id, currentMode) => {
    const token = localStorage.getItem('token');
    if (!token) return alert('Operator login required');
    const newMode = currentMode === 'fixed' ? 'adaptive' : 'fixed';
    await fetch(`http://localhost:5000/api/junctions/${id}/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ mode: newMode })
    });
  };

  const runScenario = async (type) => {
    // Always use the from/to the user selected in the dropdowns
    const from = scenarioFrom || 'j1';
    const to   = scenarioTo   || 'j11';
    
    setScenarioPath(null);
    setScenarioDetails(null);
    
    let endpoint = '';
    const headers = { 'Content-Type': 'application/json' };
    
    if (type === 'shortest')     endpoint = '/api/route/shortest';
    else if (type === 'emergency')  endpoint = '/api/route/emergency';
    else if (type === 'loadbalance') endpoint = '/api/route/loadbalance';

    try {
      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ from, to })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Scenario error:', res.status, err);
        alert(`Error ${res.status}: ${err.error || 'Request failed'}`);
        return;
      }

      const data = await res.json();
      
      if (type === 'loadbalance') {
        setScenarioDetails({ type: 'Load Balancing', data });
      } else if (type === 'emergency') {
        // greenCorridorJunctions is an array of junction IDs
        setScenarioPath(data.greenCorridorJunctions);
        setScenarioDetails({ type: 'Emergency Corridor', data });
      } else {
        setScenarioPath(data.path.map(p => p.id));
        setScenarioDetails({ type: 'Shortest Path', data });
      }
    } catch(err) {
      console.error('Network error:', err);
      alert('Could not connect to backend. Is it running on port 5000?');
    }
  };

  // SVG Scaling and Coordinates mapping
  const renderGraph = () => {
    const scale = 5; // adjust for visual size
    const offsetX = 50;
    const offsetY = 50;

    return (
      <svg width="100%" height="600px" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="25" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.2)" />
          </marker>
        </defs>

        {/* Render Edges */}
        {graph.edges.map(e => {
          const source = graph.junctions.find(j => j.id === e.source);
          const target = graph.junctions.find(j => j.id === e.target);
          if (!source || !target) return null;
          
          const x1 = source.x * scale + offsetX;
          const y1 = source.y * scale + offsetY;
          const x2 = target.x * scale + offsetX;
          const y2 = target.y * scale + offsetY;
          
          let stroke = 'rgba(255,255,255,0.1)';
          let strokeWidth = 2;
          let isHighlighted = false;
          let isEmergency = false;

          if (scenarioPath) {
            const idx1 = scenarioPath.indexOf(source.id);
            const idx2 = scenarioPath.indexOf(target.id);
            if (idx1 !== -1 && idx2 !== -1 && Math.abs(idx1 - idx2) === 1) {
              isHighlighted = true;
              stroke = scenarioDetails?.type === 'Emergency Corridor' ? 'var(--status-green)' : 'var(--accent-blue)';
              strokeWidth = 4;
              isEmergency = scenarioDetails?.type === 'Emergency Corridor';
            }
          }

          // Congestion coloring if not highlighted
          if (!isHighlighted) {
            if (e.congestion_weight > 8) stroke = 'var(--status-red)';
            else if (e.congestion_weight > 3) stroke = 'var(--status-amber)';
          }

          return (
             <g key={`${e.source}-${e.target}`}>
               <line 
                 x1={x1} y1={y1} x2={x2} y2={y2} 
                 stroke={stroke} 
                 strokeWidth={strokeWidth}
                 className={isHighlighted ? 'edge-path' : ''}
                 markerEnd="url(#arrow)"
               />
               {!isHighlighted && e.congestion_weight > 0 && (
                 <text 
                   x={(x1+x2)/2} y={(y1+y2)/2 - 5} 
                   fill="var(--text-muted)" 
                   fontSize="10" 
                   textAnchor="middle"
                 >
                   +{e.congestion_weight.toFixed(1)}
                 </text>
               )}
             </g>
          );
        })}

        {/* Render Nodes */}
        {graph.junctions.map(j => {
          const cx = j.x * scale + offsetX;
          const cy = j.y * scale + offsetY;
          const isSelected = selectedNode?.id === j.id;
          let inPath = scenarioPath?.includes(j.id);
          
          let fill = 'var(--bg-panel)';
          let stroke = 'var(--border-color)';
          
          if (j.queue_length > 15) stroke = 'var(--status-red)';
          else if (j.queue_length > 5) stroke = 'var(--status-amber)';
          
          if (inPath) {
             fill = scenarioDetails?.type === 'Emergency Corridor' ? 'var(--status-green)' : 'var(--accent-blue)';
             stroke = '#fff';
          }

          return (
            <g key={j.id} onClick={() => setSelectedNode(j)} style={{ cursor: 'pointer' }}>
              {isSelected && (
                <circle cx={cx} cy={cy} r="25" fill="none" stroke="var(--accent-blue)" strokeWidth="1" strokeDasharray="4" className="node-pulse" />
              )}
              <circle cx={cx} cy={cy} r="15" fill={fill} stroke={stroke} strokeWidth="3" />
              <text x={cx} y={cy + 25} fill="var(--text-main)" fontSize="12" textAnchor="middle" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                {j.name}
              </text>
              <text x={cx} y={cy + 4} fill={inPath ? '#fff' : 'var(--text-muted)'} fontSize="10" textAnchor="middle" className="mono">
                {j.queue_length}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div>
      <h2 className="mb-6 flex items-center gap-2"><Network size={24} /> Live City Graph & Scenarios</h2>
      
      <div className="grid grid-3 gap-6" style={{ gridTemplateColumns: '1fr 300px' }}>
        
        {/* Left Side: Graph and Scenarios */}
        <div className="flex flex-col gap-6">
          <div className="panel p-0 overflow-hidden">
            {renderGraph()}
          </div>
          
          <div className="panel">
            <h3 className="mb-4">Algorithm Scenarios</h3>

            {/* From / To selectors */}
            <div className="flex gap-4 mb-4 items-end" style={{ flexWrap: 'wrap' }}>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted uppercase">From</label>
                <select
                  value={scenarioFrom}
                  onChange={e => { setScenarioFrom(e.target.value); setScenarioPath(null); setScenarioDetails(null); }}
                  style={{ padding: '0.4rem 0.6rem', minWidth: '160px' }}
                >
                  {graph.junctions.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              </div>
              <div style={{ paddingBottom: '0.4rem', color: 'var(--text-muted)' }}>→</div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted uppercase">To</label>
                <select
                  value={scenarioTo}
                  onChange={e => { setScenarioTo(e.target.value); setScenarioPath(null); setScenarioDetails(null); }}
                  style={{ padding: '0.4rem 0.6rem', minWidth: '160px' }}
                >
                  {graph.junctions.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-4" style={{ flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => runScenario('shortest')}><Activity size={16} /> Shortest Path</button>
              <button className="btn btn-emergency" onClick={() => runScenario('emergency')}><ShieldAlert size={16} /> Emergency Corridor</button>
              <button className="btn" onClick={() => runScenario('loadbalance')}><Split size={16} /> Load Balancing</button>
            </div>
            
            {scenarioDetails && (
              <div className="mt-4 p-4 rounded-md" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)' }}>

                {/* ── Emergency Corridor ── */}
                {scenarioDetails.type === 'Emergency Corridor' && (
                  <div>
                    <h4 className="mb-3 flex items-center gap-2" style={{ color: 'var(--status-green)' }}>
                      🚨 Emergency Green Corridor Active
                    </h4>
                    <div className="flex gap-6 mb-3">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted uppercase">With Corridor</span>
                        <span className="text-2xl font-bold mono text-green">
                          {scenarioDetails.data.etaWithCorridor ?? '—'} <span className="text-sm text-muted font-normal">mins</span>
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted uppercase">Without Corridor</span>
                        <span className="text-2xl font-bold mono text-muted line-through">
                          {scenarioDetails.data.etaWithoutCorridor >= 100 ? '∞' : scenarioDetails.data.etaWithoutCorridor} <span className="text-sm font-normal">mins</span>
                        </span>
                      </div>
                      <div className="flex flex-col justify-end">
                        <span className="badge badge-green" style={{ fontSize: '0.85rem', padding: '0.3rem 0.7rem' }}>
                          ⚡ Faster by {scenarioDetails.data.etaWithoutCorridor >= 100 ? '∞' : (scenarioDetails.data.etaWithoutCorridor - scenarioDetails.data.etaWithCorridor)} mins
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-muted">
                      Path: {scenarioDetails.data.path?.map(j => j.name).join(' → ')}
                    </div>
                    <div className="mt-2 text-xs" style={{ color: 'var(--status-green)' }}>
                      ✅ Junctions turning green: {scenarioDetails.data.greenCorridorJunctions?.join(' → ')}
                    </div>
                  </div>
                )}

                {/* ── Shortest Path ── */}
                {scenarioDetails.type === 'Shortest Path' && (
                  <div>
                    <h4 className="mb-3 text-blue">⚡ Dijkstra Shortest Path</h4>
                    <div className="flex gap-6 mb-3">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted uppercase">ETA</span>
                        <span className="text-2xl font-bold mono">
                          {scenarioDetails.data.etaMinutes} <span className="text-sm text-muted font-normal">mins</span>
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted uppercase">Cost Metric</span>
                        <span className="text-2xl font-bold mono text-blue">{scenarioDetails.data.totalCost}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted uppercase">Stops</span>
                        <span className="text-2xl font-bold mono">{scenarioDetails.data.path?.length}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted">
                      Route: {scenarioDetails.data.path?.map(j => j.name).join(' → ')}
                    </div>
                  </div>
                )}

                {/* ── Load Balancing ── */}
                {scenarioDetails.type === 'Load Balancing' && (
                  <div>
                    <h4 className="mb-3" style={{ color: 'var(--status-amber)' }}>⚖️ Load Balancing — Traffic Split</h4>
                    <p className="text-sm text-muted mb-3">Vehicles distributed across {scenarioDetails.data.length} alternative paths:</p>
                    {scenarioDetails.data.map((p, i) => (
                      <div key={i} className="mb-2 p-2 rounded-md" style={{ background: 'rgba(0,0,0,0.2)' }}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-semibold">Path {i + 1}</span>
                          <span className="badge badge-amber">{p.percentage}% — {p.vehicles} vehicles</span>
                          <span className="mono text-xs text-muted">Cost: {p.cost}</span>
                        </div>
                        <div className="text-xs text-muted">{p.path?.map(j => j.name).join(' → ')}</div>
                        <div style={{ marginTop: '0.4rem', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                          <div style={{ width: `${p.percentage}%`, height: '100%', background: 'var(--status-amber)', borderRadius: '2px', transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}
          </div>
        </div>

        {/* Right Side: Sidebar */}
        <div className="flex flex-col gap-6">
          {selectedNode ? (
            <div className="panel">
              <h3 className="mb-4 text-blue">{selectedNode.name}</h3>
              
              <div className="flex flex-col gap-4">
                <div>
                  <div className="text-xs text-muted uppercase">Current Queue</div>
                  <div className="text-2xl mono mt-1">{selectedNode.queue_length} <span className="text-sm text-muted">vehicles</span></div>
                </div>
                
                <div>
                  <div className="text-xs text-muted uppercase">Signal Mode</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`badge ${selectedNode.mode === 'adaptive' ? 'badge-green' : 'badge-amber'}`}>
                      {selectedNode.mode.toUpperCase()}
                    </span>
                    <button 
                      className="btn text-sm p-1 ml-auto" 
                      onClick={() => toggleMode(selectedNode.id, selectedNode.mode)}
                      title="Requires Operator Login"
                    >
                      Toggle Mode
                    </button>
                  </div>
                </div>
                
                {selectedNode.mode === 'adaptive' && (
                  <div className="p-3 mt-2 rounded-md" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <div className="text-sm text-green flex items-center gap-2">
                      <Zap size={16} /> Adaptive timing active. Green time dynamically scaling based on {selectedNode.queue_length} queue length.
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="panel flex items-center justify-center text-muted" style={{ height: '200px' }}>
              Click a junction to view details
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
