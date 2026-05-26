import React from 'react';
import { nextStatus, prevStatus, formatAge, STATUS_LABEL } from '../utils.js';

export default function Card({ ticket, onMove, onDelete }) {
  const fwd = nextStatus(ticket.status);
  const back = prevStatus(ticket.status);

  return (
    <article className={`card prio-${ticket.priority}`}>
      <header className="card-head">
        <span className={`badge badge-${ticket.priority}`}>{ticket.priority}</span>
        {ticket.slaBreached && <span className="breach">SLA BREACH</span>}
      </header>

      <h3 className="card-subject">{ticket.subject}</h3>
      <p className="card-desc">{ticket.description}</p>

      <footer className="card-foot">
        <span className="age" title={`Created ${new Date(ticket.createdAt).toLocaleString()}`}>
          {formatAge(ticket.ageMinutes)}
        </span>

        <div className="actions">
          {back && (
            <button
              className="btn btn-ghost"
              onClick={() => onMove(ticket, back)}
              title={`Move back to ${STATUS_LABEL[back]}`}
            >
              ← {STATUS_LABEL[back]}
            </button>
          )}
          {fwd && (
            <button
              className="btn btn-primary"
              onClick={() => onMove(ticket, fwd)}
              title={`Move to ${STATUS_LABEL[fwd]}`}
            >
              {STATUS_LABEL[fwd]} →
            </button>
          )}
          <button className="btn btn-danger" onClick={() => onDelete(ticket)} title="Delete">
            ×
          </button>
        </div>
      </footer>
    </article>
  );
}
