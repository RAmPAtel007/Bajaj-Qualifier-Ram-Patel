import React from 'react';
import Card from './Card.jsx';
import { STATUS_LABEL } from '../utils.js';

export default function Column({ status, tickets, onMove, onDelete }) {
  return (
    <section className="column">
      <header className="column-head">
        <h2>{STATUS_LABEL[status]}</h2>
        <span className="count">{tickets.length}</span>
      </header>
      <div className="column-body">
        {tickets.length === 0 ? (
          <p className="empty">No tickets</p>
        ) : (
          tickets.map((t) => (
            <Card key={t._id} ticket={t} onMove={onMove} onDelete={onDelete} />
          ))
        )}
      </div>
    </section>
  );
}
