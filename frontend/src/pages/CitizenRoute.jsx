import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation, Clock, Activity, Zap, Shield, BarChart2, ChevronRight, Radio } from 'lucide-react';
import { socket } from '../App';
import { API_BASE_URL } from '../config';

const ALGO_INFO = {
  shortest: {
    label: 'Dijkstra — Shortest Path',
    color: 'var(--accent-blue)',
    icon: '⚡',
    desc: 'Explores all reachable nodes outward from the source, always expanding the lowest-cost edge first. Guaranteed to find the globally optimal path given current congestion weights.',
  },
};

export default function CitizenRoute() {
  const [junctions, setJunctions] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [liveStats, setLiveStats] = useState({ vehicles: 0, hotspots: 0, avgWait: 0 });
  const [animStep, setAnimStep] = useState(-1);
  const navigate = useNavigate();

  useEffect(() => {
    const loadGraph = () =>
      fetch(`${API_BASE_URL}/api/graph`)
        .then(res => res.json())
        .then(data => {
          setJunctions(data.junctions);
          if (data.junctions.length > 1 && !from) {
            setFrom(data.junctions[0].id);
            setTo(data.junctions[5].id);
          }
        });

    loadGraph();

    socket.on('graph:update', loadGraph);

    socket.on('dashboard:update', (data) => {
      setLiveStats({
        vehicles: data.vehiclesSimulated || 0,
        hotspots: data.activeHotspots || 0,
        avgWait: data.avgCityWaitTime || 0,
      });
    });

    return () => {
      socket.off('graph:update');
      socket.off('dashboard:update');
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Animate path step by step
  useEffect(() => {
    if (!result) { setAnimStep(-1); return; }
    setAnimStep(0);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step >= result.path.length) { clearInterval(interval); return; }
      setAnimStep(step);
    }, 500);
    return () => clearInterval(interval);
  }, [result]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (from === to) return alert('Please select different locations');
    // Save selection so Graph View can use the same route
    localStorage.setItem('citizen_from', from);
    localStorage.setItem('citizen_to', to);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/route/shortest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      });
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const viewOnGraph = () => navigate('/graph');

  const congestionColor = (q) => {
    if (q > 15) return 'var(--status-red)';
    if (q > 5) return 'var(--status-amber)';
    return 'var(--status-green)';
  };

  return (
    <div className="citizen-page">

      {/* ── Hero ── */}
      <section className="hero-section">
        <div className="hero-badge"><Radio size={12} className="pulse-dot" /> LIVE — Coimbatore City Network</div>
        <h1 className="hero-title">
          MA-TRSN
          <span className="hero-subtitle">Multi-Algorithm Adaptive Traffic Routing &amp; Signal Network</span>
        </h1>
        <p className="hero-desc">
          A real-time smart city prototype modelling Coimbatore's road network using graph algorithms —
          Dijkstra shortest paths, A* emergency corridors, and adaptive signal control — all connected
          through a live WebSocket backend.
        </p>

        {/* Live stat pills */}
        <div className="hero-stats">
          <div className="stat-pill">
            <span className="stat-value mono text-amber">{liveStats.vehicles || '—'}</span>
            <span className="stat-label">Vehicles Active</span>
          </div>
          <div className="stat-pill">
            <span className="stat-value mono text-red">{liveStats.hotspots || '—'}</span>
            <span className="stat-label">Congestion Hotspots</span>
          </div>
          <div className="stat-pill">
            <span className="stat-value mono text-green">{liveStats.avgWait || '—'}s</span>
            <span className="stat-label">Avg Junction Wait</span>
          </div>
          <div className="stat-pill">
            <span className="stat-value mono text-blue">12</span>
            <span className="stat-label">Junctions Modelled</span>
          </div>
        </div>
      </section>

      {/* ── How Vehicles Are Tracked ── */}
      <section className="info-grid">
        <div className="info-card panel">
          <div className="info-icon" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--accent-blue)' }}>
            <BarChart2 size={24} />
          </div>
          <h3>Vehicle Simulation</h3>
          <p>
            The backend runs a <strong>5-second tick loop</strong>. Each tick randomly modifies edge
            congestion weights (±3 units) and junction queue lengths. The vehicle count you see is
            derived from <code>Σ queue_length × 3.5</code> across all junctions — a heuristic
            modelling average vehicles-per-slot. In a real deployment, inductive loop sensors or
            AI cameras would feed live counts over MQTT.
          </p>
        </div>
        <div className="info-card panel">
          <div className="info-icon" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--status-green)' }}>
            <Zap size={24} />
          </div>
          <h3>Adaptive Signal Control</h3>
          <p>
            Junctions can switch between <strong>Fixed</strong> (static 30-s green) and
            <strong> Adaptive</strong> mode. In adaptive mode, the backend scales green time
            proportionally to queue depth, draining congestion twice as fast as a fixed timer.
            Toggle it live from the City Graph view (requires operator login).
          </p>
        </div>
        <div className="info-card panel">
          <div className="info-icon" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--status-amber)' }}>
            <Shield size={24} />
          </div>
          <h3>Emergency Green Corridor</h3>
          <p>
            The A* algorithm finds the path with the lowest <em>distance + congestion heuristic</em>,
            then broadcasts a <code>emergency:started</code> WebSocket event. All junctions along the
            path turn green in sequence. The ETA improvement vs a normal route is shown in the
            dispatch log.
          </p>
        </div>
      </section>

      {/* ── Route Finder ── */}
      <section className="route-section">
        <div className="route-finder panel">
          <h2 className="flex items-center gap-2 mb-6">
            <MapPin size={22} className="text-blue" /> Plan Your Commute
          </h2>

          <form onSubmit={handleSearch} className="route-form">
            <div className="route-field">
              <label>From</label>
              <select value={from} onChange={e => setFrom(e.target.value)}>
                {junctions.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            <div className="route-swap-icon"><ChevronRight size={20} className="text-muted" /></div>
            <div className="route-field">
              <label>To</label>
              <select value={to} onChange={e => setTo(e.target.value)}>
                {junctions.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary route-go-btn">
              {loading ? <span className="spinner" /> : <><Navigation size={16} /> Go</>}
            </button>
          </form>

          <div className="algo-tag">
            <span style={{ color: 'var(--accent-blue)' }}>⚡</span>
            Algorithm: <strong>Dijkstra's Shortest Path</strong> — live congestion-weighted graph
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="route-result panel">
            <div className="result-header">
              <div>
                <div className="text-xs text-muted uppercase mb-1">Estimated Time</div>
                <div className="text-4xl mono font-bold">{result.etaMinutes}<span className="text-lg text-muted font-normal"> min</span></div>
              </div>
              <div>
                <div className="text-xs text-muted uppercase mb-1">Cost Metric</div>
                <div className="text-4xl mono font-bold text-blue">{result.totalCost}</div>
              </div>
              <div>
                <div className="text-xs text-muted uppercase mb-1">Junctions</div>
                <div className="text-4xl mono font-bold text-green">{result.path.length}</div>
              </div>
            </div>

            <div className="path-timeline">
              {result.path.map((j, i) => (
                <div key={i} className={`path-node ${i <= animStep ? 'path-node-active' : ''}`}>
                  <div className="path-dot" style={{ background: i <= animStep ? congestionColor(j.queue_length) : 'transparent', borderColor: congestionColor(j.queue_length) }}>
                    {i <= animStep && <span className="path-dot-inner" />}
                  </div>
                  <div className="path-label">
                    <span className="font-semibold">{j.name}</span>
                    <span className="text-xs text-muted mono">Queue: {j.queue_length}</span>
                  </div>
                  {i < result.path.length - 1 && <div className={`path-connector ${i < animStep ? 'path-connector-active' : ''}`} />}
                </div>
              ))}
            </div>

            <button
              onClick={viewOnGraph}
              className="btn btn-primary mt-4"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Activity size={16} /> View Route on City Graph →
            </button>
          </div>
        )}
      </section>

      {/* ── Junction Status Grid ── */}
      <section>
        <h2 className="mb-4 flex items-center gap-2"><Activity size={20} /> Live Junction Status</h2>
        <div className="junction-grid">
          {junctions.map(j => (
            <div key={j.id} className="junction-card panel">
              <div className="junction-indicator" style={{ background: congestionColor(j.queue_length) }} />
              <div className="junction-name">{j.name}</div>
              <div className="junction-stats">
                <span className="mono text-sm" style={{ color: congestionColor(j.queue_length) }}>
                  {j.queue_length} <span className="text-muted">vehicles</span>
                </span>
                <span className={`badge ${j.mode === 'adaptive' ? 'badge-green' : 'badge-amber'}`}>{j.mode}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
