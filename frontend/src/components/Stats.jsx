import React from 'react';
import { PIPELINE, STATUS_LABEL } from '../utils.js';

export default function Stats({ stats }) {
  if (!stats) return <div className="stats stats-loading">Loading stats…</div>;

  return (
    <div className="stats">
      {PIPELINE.map((s) => (
        <div key={s} className="stat">
          <span className="stat-label">{STATUS_LABEL[s]}</span>
          <span className="stat-value">{stats.byStatus?.[s] ?? 0}</span>
        </div>
      ))}
      <div className="stat stat-breach">
        <span className="stat-label">Breached (open)</span>
        <span className="stat-value">{stats.breachedOpen ?? 0}</span>
      </div>
    </div>
  );
}
