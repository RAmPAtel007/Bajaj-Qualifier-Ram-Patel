// Linear status pipeline. Forward moves are one step along this chain;
// backward moves are also one step (and only the immediate previous).
const PIPELINE = ['open', 'in_progress', 'resolved', 'closed'];

export function isKnownStatus(s) {
  return PIPELINE.includes(s);
}

// Returns null if the transition is illegal, otherwise an object describing it.
// shape: { direction: 'forward' | 'backward', clearResolvedAt: boolean, setResolvedAt: boolean }
export function planTransition(from, to) {
  if (from === to) return { direction: 'noop', clearResolvedAt: false, setResolvedAt: false };

  const fromIdx = PIPELINE.indexOf(from);
  const toIdx = PIPELINE.indexOf(to);

  if (fromIdx === -1 || toIdx === -1) return null;

  const diff = toIdx - fromIdx;
  if (diff === 1) {
    return {
      direction: 'forward',
      // entering 'resolved' for the first time stamps resolvedAt
      setResolvedAt: to === 'resolved',
      clearResolvedAt: false,
    };
  }
  if (diff === -1) {
    return {
      direction: 'backward',
      setResolvedAt: false,
      // leaving 'resolved' clears the stamp
      clearResolvedAt: from === 'resolved',
    };
  }
  return null;
}

export { PIPELINE };
