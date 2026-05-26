import React, { useCallback, useEffect, useState } from 'react';
import Board from './components/Board.jsx';
import Filters from './components/Filters.jsx';
import Stats from './components/Stats.jsx';
import CreateForm from './components/CreateForm.jsx';
import * as api from './api.js';

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({ priority: null, breached: false });
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, s] = await Promise.all([
        api.listTickets({ priority: filters.priority, breached: filters.breached }),
        api.getStats(),
      ]);
      setTickets(list);
      setStats(s);
    } catch (e) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filters.priority, filters.breached]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Re-tick every 30s so age + breach state stay fresh without a manual refresh.
  useEffect(() => {
    const id = setInterval(reload, 30000);
    return () => clearInterval(id);
  }, [reload]);

  async function handleMove(ticket, toStatus) {
    try {
      await api.patchTicket(ticket._id, { status: toStatus });
      reload();
    } catch (e) {
      // Show a transient error — keep the UI alive.
      setError(e.message || 'Move failed');
      setTimeout(() => setError(null), 4000);
    }
  }

  async function handleDelete(ticket) {
    if (!confirm(`Delete ticket "${ticket.subject}"?`)) return;
    try {
      await api.deleteTicket(ticket._id);
      reload();
    } catch (e) {
      setError(e.message || 'Delete failed');
    }
  }

  async function handleCreate(payload) {
    await api.createTicket(payload);
    reload();
  }

  return (
    <div className="app">
      <header className="app-head">
        <div>
          <h1>DeskFlow</h1>
          <p className="tagline">Support ticket triage board</p>
        </div>
        <Stats stats={stats} />
      </header>

      <Filters filters={filters} onChange={setFilters} onNew={() => setShowCreate(true)} />

      {error && <div className="banner banner-error">{error}</div>}
      {loading && tickets.length === 0 && <div className="banner">Loading…</div>}

      <Board tickets={tickets} onMove={handleMove} onDelete={handleDelete} />

      {showCreate && (
        <CreateForm onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}
