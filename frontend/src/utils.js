// Pipeline order — duplicated on the client because it drives the UI buttons.
// Kept in sync with backend's lib/transitions.js.
export const PIPELINE = ['open', 'in_progress', 'resolved', 'closed'];

export const STATUS_LABEL = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export function nextStatus(s) {
  const i = PIPELINE.indexOf(s);
  return i >= 0 && i < PIPELINE.length - 1 ? PIPELINE[i + 1] : null;
}

export function prevStatus(s) {
  const i = PIPELINE.indexOf(s);
  return i > 0 ? PIPELINE[i - 1] : null;
}

// "3h 12m", "47m", "2d 3h" — keep it short.
export function formatAge(minutes) {
  if (minutes < 0) minutes = 0;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const m = minutes % 60;
    return m ? `${hours}h ${m}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return h ? `${days}d ${h}h` : `${days}d`;
}
