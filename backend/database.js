const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'matrsn.sqlite');
const db = new Database(dbPath);

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS junctions (
      id TEXT PRIMARY KEY,
      name TEXT,
      x REAL,
      y REAL,
      mode TEXT DEFAULT 'fixed',
      queue_length INTEGER DEFAULT 0,
      signal_phase TEXT DEFAULT 'red',
      green_time INTEGER DEFAULT 30
    );

    CREATE TABLE IF NOT EXISTS edges (
      source TEXT,
      target TEXT,
      base_weight REAL,
      congestion_weight REAL DEFAULT 0,
      PRIMARY KEY (source, target)
    );

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      avg_wait_time REAL,
      active_hotspots INTEGER,
      vehicles_simulated INTEGER
    );

    CREATE TABLE IF NOT EXISTS dispatch_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      source_id TEXT,
      target_id TEXT,
      eta_corridor REAL,
      eta_normal REAL
    );
  `);

  const count = db.prepare('SELECT COUNT(*) as c FROM junctions').get().c;
  if (count === 0) {
    seedData();
  }
}

function seedData() {
  const junctions = [
    { id: 'j1', name: 'Gandhipuram', x: 50, y: 30 },
    { id: 'j2', name: 'Town Hall', x: 30, y: 60 },
    { id: 'j3', name: 'RS Puram', x: 20, y: 40 },
    { id: 'j4', name: 'Ukkadam', x: 30, y: 80 },
    { id: 'j5', name: 'Race Course', x: 60, y: 60 },
    { id: 'j6', name: 'Avinashi Road', x: 80, y: 40 },
    { id: 'j7', name: 'Peelamedu', x: 100, y: 30 },
    { id: 'j8', name: 'Hopes College', x: 120, y: 20 },
    { id: 'j9', name: 'Lakshmi Mills', x: 70, y: 50 },
    { id: 'j10', name: 'Trichy Road Junction', x: 70, y: 70 },
    { id: 'j11', name: 'Singanallur', x: 100, y: 80 },
    { id: 'j12', name: 'Big Bazaar Street', x: 40, y: 65 }
  ];

  const edges = [
    { source: 'j1', target: 'j3', weight: 4 },
    { source: 'j3', target: 'j1', weight: 4 },
    { source: 'j1', target: 'j6', weight: 5 },
    { source: 'j6', target: 'j1', weight: 5 },
    { source: 'j6', target: 'j7', weight: 3 },
    { source: 'j7', target: 'j6', weight: 3 },
    { source: 'j7', target: 'j8', weight: 3 },
    { source: 'j8', target: 'j7', weight: 3 },
    { source: 'j1', target: 'j9', weight: 3 },
    { source: 'j9', target: 'j1', weight: 3 },
    { source: 'j9', target: 'j6', weight: 2 },
    { source: 'j6', target: 'j9', weight: 2 },
    { source: 'j9', target: 'j5', weight: 2 },
    { source: 'j5', target: 'j9', weight: 2 },
    { source: 'j5', target: 'j10', weight: 2 },
    { source: 'j10', target: 'j5', weight: 2 },
    { source: 'j10', target: 'j11', weight: 5 },
    { source: 'j11', target: 'j10', weight: 5 },
    { source: 'j5', target: 'j2', weight: 4 },
    { source: 'j2', target: 'j5', weight: 4 },
    { source: 'j3', target: 'j2', weight: 3 },
    { source: 'j2', target: 'j3', weight: 3 },
    { source: 'j2', target: 'j12', weight: 1 },
    { source: 'j12', target: 'j2', weight: 1 },
    { source: 'j12', target: 'j4', weight: 2 },
    { source: 'j4', target: 'j12', weight: 2 },
    { source: 'j2', target: 'j4', weight: 3 },
    { source: 'j4', target: 'j2', weight: 3 },
    { source: 'j10', target: 'j4', weight: 5 },
    { source: 'j4', target: 'j10', weight: 5 }
  ];

  const insertJunction = db.prepare('INSERT INTO junctions (id, name, x, y) VALUES (?, ?, ?, ?)');
  junctions.forEach(j => insertJunction.run(j.id, j.name, j.x, j.y));

  const insertEdge = db.prepare('INSERT INTO edges (source, target, base_weight) VALUES (?, ?, ?)');
  edges.forEach(e => insertEdge.run(e.source, e.target, e.weight));
}

initDB();

module.exports = db;
