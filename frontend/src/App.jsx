import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Activity, Map, LayoutDashboard, LogIn } from 'lucide-react';

import CitizenRoute from './pages/CitizenRoute';
import GraphView from './pages/GraphView';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

import { API_BASE_URL } from './config';

// Create a singleton socket connection
export const socket = io(API_BASE_URL);

function Navigation() {
  const location = useLocation();
  const token = localStorage.getItem('token');
  
  return (
    <nav className="navbar">
      <div className="flex items-center gap-2">
        <Activity className="text-blue" />
        <h1 className="text-xl">MA-TRSN</h1>
      </div>
      <div className="nav-links">
        <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''} flex items-center gap-2`}>
          <Map size={18} /> Citizen Route
        </Link>
        <Link to="/graph" className={`nav-link ${location.pathname === '/graph' ? 'active' : ''} flex items-center gap-2`}>
          <Activity size={18} /> Live City Graph
        </Link>
        {token ? (
          <Link to="/dashboard" className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''} flex items-center gap-2`}>
            <LayoutDashboard size={18} /> Control Room
          </Link>
        ) : (
          <Link to="/login" className={`nav-link ${location.pathname === '/login' ? 'active' : ''} flex items-center gap-2`}>
            <LogIn size={18} /> Operator Login
          </Link>
        )}
      </div>
    </nav>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  
  useEffect(() => {
    const handleStorage = () => {
      setToken(localStorage.getItem('token'));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <Router>
      <div className="app-container">
        <Navigation />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<CitizenRoute />} />
            <Route path="/graph" element={<GraphView />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
