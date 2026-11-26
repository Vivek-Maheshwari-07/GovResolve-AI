const HISTORY_KEY = 'govresolve.history';
export const HISTORY_MAX = 8;

function browserStorage(name) {
  try {
    return window[name];
  } catch {
    return null;
  }
}

function decodeHistory(raw) {
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry.id === 'string' && typeof entry.question === 'string' && entry.response && typeof entry.response === 'object')
      .slice(0, HISTORY_MAX);
  } catch {
    return null;
  }
}

function readStorage(storage) {
  try {
    return decodeHistory(storage?.getItem(HISTORY_KEY));
  } catch {
    return null;
  }
}

export function loadHistory(primaryStorage = browserStorage('localStorage'), legacyStorage = browserStorage('sessionStorage')) {
  const saved = readStorage(primaryStorage);
  if (saved !== null) return saved;
  return readStorage(legacyStorage) || [];
}

export function saveHistory(history, storage = browserStorage('localStorage')) {
  try {
    const saved = Array.isArray(history)
      ? history.filter((entry) => entry && typeof entry.id === 'string' && typeof entry.question === 'string' && entry.response && typeof entry.response === 'object').slice(0, HISTORY_MAX)
      : [];
    storage?.setItem(HISTORY_KEY, JSON.stringify(saved));
  } catch {
    // Keep the current chat usable if persistent storage is unavailable or full.
  }
}
