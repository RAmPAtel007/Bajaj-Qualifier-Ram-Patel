import React from 'react';
import { PRIORITIES } from '../utils.js';

export default function Filters({ filters, onChange, onNew }) {
  return (
    <div className="filters">
      <label className="field">
        <span>Priority</span>
        <select
          value={filters.priority || ''}
          onChange={(e) => onChange({ ...filters, priority: e.target.value || null })}
        >
          <option value="">All</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </label>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={!!filters.breached}
          onChange={(e) => onChange({ ...filters, breached: e.target.checked })}
        />
        <span>SLA-breached only</span>
      </label>

      <button className="btn btn-primary new-btn" onClick={onNew}>
        + New ticket
      </button>
    </div>
  );
}
