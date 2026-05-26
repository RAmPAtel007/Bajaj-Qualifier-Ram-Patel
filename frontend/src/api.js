// Resolution order: explicit env var > localhost during local dev > production Render URL.
const PROD_API = 'https://bajaj-qualifier-ram-patel.onrender.com';
const BASE = (() => {
  const envVal = import.meta.env.VITE_API_URL;
  if (envVal) return envVal.replace(/\/$/, '');
  if (typeof window !== 'undefined' && /^(localhost|127\.)/.test(window.location.hostname)) {
    return 'http://localhost:4000';
  }
  return PROD_API;
})();

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (res.status === 204) return null;
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(payload.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.fields = payload.fields || null;
    throw err;
  }
  return payload;
}

export function listTickets({ priority, breached } = {}) {
  const qs = new URLSearchParams();
  if (priority) qs.set('priority', priority);
  if (breached) qs.set('breached', 'true');
  const tail = qs.toString();
  return request(`/tickets${tail ? `?${tail}` : ''}`);
}

export function getStats() {
  return request('/tickets/stats');
}

export function createTicket(data) {
  return request('/tickets', { method: 'POST', body: JSON.stringify(data) });
}

export function patchTicket(id, patch) {
  return request(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function deleteTicket(id) {
  return request(`/tickets/${id}`, { method: 'DELETE' });
}
