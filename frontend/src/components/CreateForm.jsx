import React, { useState } from 'react';
import { PRIORITIES } from '../utils.js';

const EMPTY = { subject: '', description: '', customerEmail: '', priority: 'medium' };

export default function CreateForm({ onClose, onCreate }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function set(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: undefined }));
  }

  function clientValidate() {
    const e = {};
    if (!form.subject.trim()) e.subject = 'Required';
    if (!form.description.trim()) e.description = 'Required';
    if (!form.customerEmail.trim()) e.customerEmail = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail)) e.customerEmail = 'Not a valid email';
    if (!PRIORITIES.includes(form.priority)) e.priority = 'Pick a priority';
    return e;
  }

  async function submit(ev) {
    ev.preventDefault();
    const clientErrs = clientValidate();
    if (Object.keys(clientErrs).length) {
      setErrors(clientErrs);
      return;
    }
    setSubmitting(true);
    try {
      await onCreate(form);
      setForm(EMPTY);
      onClose();
    } catch (err) {
      if (err.fields) {
        setErrors(err.fields);
      } else {
        setErrors({ _form: err.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>New ticket</h2>
          <button className="btn btn-ghost" onClick={onClose}>×</button>
        </header>

        <form onSubmit={submit} noValidate>
          <label className="field">
            <span>Subject</span>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => set('subject', e.target.value)}
            />
            {errors.subject && <small className="err">{errors.subject}</small>}
          </label>

          <label className="field">
            <span>Description</span>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
            {errors.description && <small className="err">{errors.description}</small>}
          </label>

          <label className="field">
            <span>Customer email</span>
            <input
              type="email"
              value={form.customerEmail}
              onChange={(e) => set('customerEmail', e.target.value)}
            />
            {errors.customerEmail && <small className="err">{errors.customerEmail}</small>}
          </label>

          <label className="field">
            <span>Priority</span>
            <select value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {errors.priority && <small className="err">{errors.priority}</small>}
          </label>

          {errors._form && <div className="err err-banner">{errors._form}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
