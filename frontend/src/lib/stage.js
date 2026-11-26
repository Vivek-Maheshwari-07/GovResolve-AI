// Stage mode (?stage=1): a presenter's preflight strip and three pinned questions, answered once before the talk
// and kept in this browser session, so keys 1 2 3 open real answers instantly. Nothing here invents an answer:
// a pin shows the server's own response with the time it was answered, or the error it got.

// Chosen from docs/DEMO_VERIFIED_QUERIES.md (the 36-query verification run).
export const STAGE_PINS = [];

const KEY = 'govresolve.stage.v1';

export function isStage(search) {
  try {
    return new URLSearchParams(search || '').get('stage') === '1';
  } catch {
    return false;
  }
}

/** Read the cached pins: { [pinId]: { at, response } | { at, error } }. Never throws. */
export function loadCache(storage) {
  try {
    const v = JSON.parse(storage?.getItem(KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function saveCache(storage, cache) {
  try {
    storage?.setItem(KEY, JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
}

/** What a pin's chip shows: 'ready' (answered or refused as expected), 'error', or 'pending'. */
export function pinState(entry) {
  if (!entry) return 'pending';
  if (entry.error) return 'error';
  return entry.response ? 'ready' : 'pending';
}

/** "answered 10:42" in the presenter's local time; '' for a missing or bad timestamp. */
export function answeredAt(at, locale = 'en-IN') {
  const d = new Date(at);
  if (!at || Number.isNaN(d.getTime())) return '';
  return `answered ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

/** The preflight checks shown in the strip, from GET /health. Each is { label, ok, detail }. */
export function preflight(health) {
  if (!health) return [{ label: 'Server', ok: false, detail: 'not reachable' }];
  return [
    { label: 'Server', ok: health.status === 'ok', detail: health.status || 'no status' },
    { label: 'Resolutions', ok: (health.gr_count || 0) > 0, detail: String(health.gr_count ?? 0) },
    { label: 'Lineage links', ok: (health.edge_count || 0) > 0, detail: String(health.edge_count ?? 0) },
    { label: 'Bad files', ok: !(health.bad_files || []).length, detail: String((health.bad_files || []).length) },
  ];
}
