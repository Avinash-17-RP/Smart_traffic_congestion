import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Clock, Car, BarChart3, AlertTriangle, LayoutDashboard } from 'lucide-react';
import { socket } from '../App';

export default function Dashboard() {
  const [stats, setStats] = useState({
    avgCityWaitTime: 0,
    activeHotspots: 0,
    vehiclesSimulated: 0,
    comparisonFixedVsAdaptive: ''
  });
  const [logs, setLogs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchStats = async () => {
      const res = await fetch('http://localhost:5000/api/dashboard/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setStats(await res.json());
      else if (res.status === 401 || res.status === 403) navigate('/login');
    };

    const fetchLogs = async () => {
      const res = await fetch('http://localhost:5000/api/dispatch/log', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setLogs(await res.json());
    };

    fetchStats();
    fetchLogs();

    socket.on('dashboard:update', (data) => {
      setStats(prev => ({ ...prev, ...data }));
    });
    
    socket.on('emergency:started', () => {
      fetchLogs(); // refresh logs when new emergency happens
    });

    return () => {
      socket.off('dashboard:update');
      socket.off('emergency:started');
    };
  }, [navigate]);

  return (
    <div>
      <h2 className="mb-6 flex items-center gap-2"><LayoutDashboard size={24} /> System Dashboard</h2>
      
      <div className="grid-4 mb-6">
        <div className="panel flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted text-sm uppercase font-semibold">
            <Clock size={16} /> Avg Wait Time
          </div>
          <div className="text-3xl mono font-bold text-amber">{stats.avgCityWaitTime}s</div>
        </div>
        
        <div className="panel flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted text-sm uppercase font-semibold">
            <AlertTriangle size={16} /> Active Hotspots
          </div>
          <div className="text-3xl mono font-bold text-red">{stats.activeHotspots}</div>
        </div>
        
        <div className="panel flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted text-sm uppercase font-semibold">
            <Car size={16} /> Vehicles Simulated
          </div>
          <div className="text-3xl mono font-bold text-blue">{stats.vehiclesSimulated}</div>
        </div>
        
        <div className="panel flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted text-sm uppercase font-semibold">
            <BarChart3 size={16} /> Signal Modes
          </div>
          <div className="text-lg font-bold">{stats.comparisonFixedVsAdaptive || 'Loading...'}</div>
        </div>
      </div>

      <div className="panel">
        <h3 className="mb-4">Recent Emergency Dispatches</h3>
        {logs.length === 0 ? (
          <p className="text-muted text-sm">No dispatches recorded.</p>
        ) : (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="text-muted text-sm uppercase" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th className="py-2">Time</th>
                <th>Route</th>
                <th>Corridor ETA</th>
                <th>Normal ETA</th>
                <th>Saved</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td className="py-2 mono text-sm">{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td>{log.source_id} &rarr; {log.target_id}</td>
                  <td className="text-green font-bold">{log.eta_corridor} mins</td>
                  <td className="text-muted">{log.eta_normal} mins</td>
                  <td className="text-amber">+{log.eta_normal - log.eta_corridor} mins</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
