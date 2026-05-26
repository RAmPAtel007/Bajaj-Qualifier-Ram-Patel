import React from 'react';
import Column from './Column.jsx';
import { PIPELINE } from '../utils.js';

export default function Board({ tickets, onMove, onDelete }) {
  const grouped = PIPELINE.reduce((acc, s) => {
    acc[s] = tickets.filter((t) => t.status === s);
    return acc;
  }, {});

  return (
    <div className="board">
      {PIPELINE.map((s) => (
        <Column key={s} status={s} tickets={grouped[s]} onMove={onMove} onDelete={onDelete} />
      ))}
    </div>
  );
}
