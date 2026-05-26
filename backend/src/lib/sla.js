// Response-time targets in minutes, keyed by priority.
// Numbers come straight from the spec.
const TARGET_MIN = {
  urgent: 60,
  high: 60 * 4,
  medium: 60 * 24,
  low: 60 * 72,
};

export function targetFor(priority) {
  return TARGET_MIN[priority];
}

function minutesBetween(a, b) {
  return Math.floor((b.getTime() - a.getTime()) / 60000);
}

// Returns { ageMinutes, slaBreached } for a ticket doc (or plain obj).
// - ageMinutes: minutes from createdAt to "end", where end = resolvedAt if resolved/closed, else now.
// - slaBreached: true if the relevant elapsed time exceeded the priority's target.
export function derive(ticket, now = new Date()) {
  const target = TARGET_MIN[ticket.priority];
  const created = ticket.createdAt instanceof Date ? ticket.createdAt : new Date(ticket.createdAt);

  // Once a ticket is resolved (and stays in resolved/closed), age is frozen
  // at the resolution moment per the spec.
  const end = ticket.resolvedAt
    ? (ticket.resolvedAt instanceof Date ? ticket.resolvedAt : new Date(ticket.resolvedAt))
    : now;

  const ageMinutes = Math.max(0, minutesBetween(created, end));

  // If we have a resolution time, breach is decided by whether resolution
  // happened after the target window. Otherwise it's "still ticking" vs target.
  let slaBreached;
  if (ticket.resolvedAt) {
    slaBreached = minutesBetween(created, ticket.resolvedAt instanceof Date ? ticket.resolvedAt : new Date(ticket.resolvedAt)) > target;
  } else {
    slaBreached = minutesBetween(created, now) > target;
  }

  return { ageMinutes, slaBreached };
}

export { TARGET_MIN };
