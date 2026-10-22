const KEY = 'runner.bestScore';
const MAX_SCORE = 1e9;

// If localStorage is unavailable, the best score still works for this page load.
let memoryBest = 0;

export function loadBest() {
  try {
    const raw = localStorage.getItem(KEY);
    const n = Number(raw);
    // A readable but missing or malformed value counts as "no best yet".
    memoryBest = raw !== null && raw !== '' && Number.isInteger(n) && n >= 0 && n <= MAX_SCORE ? n : 0;
  } catch {
    // blocked or unavailable: fall through to the in-memory value
  }
  return memoryBest;
}

export function saveBest(score) {
  memoryBest = score;
  try {
    localStorage.setItem(KEY, String(score));
  } catch {
    // ignore: quota, private mode, or blocked storage
  }
}

const THEME_KEY = 'runner.theme';

// The saved theme name, or null if missing or unreadable. The caller validates it.
export function loadTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

export function saveTheme(name) {
  try {
    localStorage.setItem(THEME_KEY, name);
  } catch {
    // ignore: quota, private mode, or blocked storage
  }
}
