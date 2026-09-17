/**
 * Apply highlights to text — wraps matched words in <mark> tags.
 * @param {string} text
 * @param {string[]} highlights
 * @returns {string} HTML string
 */
export function applyHighlights(text, highlights) {
  if (!text) return '';
  if (!highlights || highlights.length === 0) return escapeHtml(text);

  const escaped = escapeHtml(text);
  const terms = highlights
    .map(h => h.trim())
    .filter(Boolean)
    .map(h => escapeRegex(h));

  if (terms.length === 0) return escaped;

  const pattern = new RegExp(`(${terms.join('|')})`, 'gi');
  return escaped.replace(pattern, '<mark>$1</mark>');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format a date string to a relative or absolute readable format.
 */
export function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

/**
 * Parse comma-separated highlights string to array.
 */
export function parseHighlights(str) {
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Generate a simple unique id.
 */
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** Note color palette */
export const NOTE_COLORS = [
  { value: '#ffffff', label: 'White' },
  { value: '#fef9c3', label: 'Yellow' },
  { value: '#dcfce7', label: 'Green' },
  { value: '#dbeafe', label: 'Blue' },
  { value: '#fce7f3', label: 'Pink' },
  { value: '#ede9fe', label: 'Purple' },
  { value: '#ffedd5', label: 'Orange' },
  { value: '#f1f5f9', label: 'Slate' },
];

/**
 * Debounce a function.
 */
export function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
