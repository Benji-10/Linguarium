/**
 * UI primitives: safe HTML templating, badges, icons, toasts, modals.
 * No emoji anywhere; icons are inline SVG. All user content is escaped
 * by default through the html`` tagged template.
 */

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Tagged template: interpolations are HTML-escaped. Use raw${} to inject trusted markup. */
export function html(strings, ...values) {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) {
      const v = values[i];
      out += v && v.__raw ? v.toString() : esc(v);
    }
  }
  return out;
}

/** Mark a string as trusted pre-rendered HTML. */
export function raw(s) {
  return { __raw: true, toString: () => String(s) };
}

/** Convert trusted strings to raw for use inside html``. */
export function rawList(items, fn) {
  return raw(items.map(fn).join(''));
}

// ------------------------------------------------------------------ icons

const ICONS = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  compass: 'M12 2a10 10 0 100 20 10 10 0 000-20zm7.9 9h-5.4l3.7-3.7.1.1a7.9 7.9 0 00-4.4-3.5L12 10.6 10.1 4a7.9 7.9 0 00-4.4 3.5L9.5 11H4.1a8 8 0 000 2h5.4l-3.8 3.8A7.9 7.9 0 0010.1 20l1.9-6.6 1.9 6.6a7.9 7.9 0 004.4-3.5L14.5 13h5.4a8 8 0 000-2z',
  book: 'M4 4a2 2 0 012-2h9a3 3 0 013 3v14a1 1 0 01-1 1H6a2 2 0 01-2-2V4zm2 14h10V5a1 1 0 00-1-1H6v14z M8 7h7v2H8V7z M8 11h7v2H8v-2z',
  headphones: 'M12 3a9 9 0 00-9 9v6a2 2 0 002 2h1a1 1 0 001-1v-5a1 1 0 00-1-1H5v-1a7 7 0 0114 0v1h-1a1 1 0 00-1 1v5a1 1 0 001 1h1a2 2 0 002-2v-6a9 9 0 00-9-9z',
  review: 'M4 4h16v2H4V4zm0 5h16v2H4V9zm0 5h10v2H4v-2zm0 5h13v2H4v-2z',
  pencil: 'M3 17.2V21h3.8L17.9 9.9l-3.8-3.8L3 17.2zM20.7 7.1a1 1 0 000-1.4l-2.4-2.4a1 1 0 00-1.4 0l-1.8 1.8 3.8 3.8 1.8-1.8z',
  brain: 'M9 3a4 4 0 00-4 4 3 3 0 00-1 5.8V15a4 4 0 004 4h1a1 1 0 001-1V4a1 1 0 00-1-1zm6 0a4 4 0 014 4 3 3 0 011 5.8V15a4 4 0 01-4 4h-1a1 1 0 01-1-1V4a1 1 0 011-1z',
  library: 'M4 3h3v18H4V3zm5 0h3v18H9V3zm5.6.5l3 17.6 2.9-.5-3-17.6-2.9.5z',
  layers: 'M12 2L1 7l11 5 11-5-11-5zM1 12l11 5 11-5-11 5-11-5zm0 5l11 5 11-5-11 5-11-5z',
  settings: 'M12 8a4 4 0 100 8 4 4 0 000-8zm9.4 4a8 8 0 01-.1 1.3l2 1.6-2 3.4-2.4-1a8 8 0 01-2.3 1.3l-.4 2.6h-4l-.4-2.6a8 8 0 01-2.3-1.3l-2.4 1-2-3.4 2-1.6a8 8 0 010-2.6l-2-1.6 2-3.4 2.4 1a8 8 0 012.3-1.3l.4-2.6h4l.4 2.6a8 8 0 012.3 1.3l2.4-1 2 3.4-2 1.6a8 8 0 01.1 1.3z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z',
  check: 'M9 16.2L4.8 12l-1.4 1.4L9 19 20.6 7.4 19.2 6 9 16.2z',
  x: 'M6.4 5l-1.4 1.4L10.6 12l-5.6 5.6L6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6 5.6-5.6L18.4 5 12.8 10.6 6.4 5z',
  alert: 'M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-8h-2v6h2V8z',
  info: 'M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
  download: 'M12 3v10.6l3.3-3.3 1.4 1.4-5.7 5.7-5.7-5.7 1.4-1.4L10 13.6V3h2zM4 19h16v2H4v-2z',
  upload: 'M12 21V10.4l3.3 3.3 1.4-1.4L11 6.6l-5.7 5.7 1.4 1.4 3.3-3.3V21h2zM4 3h16v2H4V3z',
  trash: 'M6 7h12v13a2 2 0 01-2 2H8a2 2 0 01-2-2V7zm3-4h6l1 2h4v2H2V5h4l1-2z',
  clock: 'M12 2a10 10 0 100 20 10 10 0 000-20zm1 11h5v-2h-3V6h-2v7z',
  offline: 'M12 4a9 9 0 00-6.3 2.6l1.4 1.4A7 7 0 1012 18v-2a5 5 0 110-10 5 5 0 013.5 1.5l1.4-1.4A9 9 0 0012 4zM2.8 4.2l1.4-1.4 17.4 17.4-1.4 1.4L2.8 4.2z',
  flash: 'M7 2h10l-4 7h4l-8 13 2-9H7l2-11h-2z',
  chevron: 'M9 6l6 6-6 6',
  eye: 'M12 5c-5 0-9 4-10 7 1 3 5 7 10 7s9-4 10-7c-1-3-5-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8z',
  globe: 'M12 2a10 10 0 100 20 10 10 0 000-20zm6.9 6h-2.6a15 15 0 00-1.6-3.7A8 8 0 0118.9 8zM12 4a13 13 0 013 4H9a13 13 0 013-4zM4.3 14a8 8 0 010-4h3a17 17 0 000 4h-3zm.8 2h2.6a15 15 0 001.6 3.7A8 8 0 015.1 16zm2.6-8H5.1a8 8 0 014.2-3.7A15 15 0 007.7 8zM12 20a13 13 0 01-3-4h6a13 13 0 01-3 4zm3.4-6h-6.8a15 15 0 010-4h6.8a15 15 0 010 4zm.3 5.7a15 15 0 001.6-3.7h2.6a8 8 0 01-4.2 3.7zM16.7 14a17 17 0 000-4h3a8 8 0 010 4h-3z',
};

export function icon(name, cls = '') {
  const path = ICONS[name] ?? ICONS.info;
  return raw(
    `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${path}"/></svg>`,
  );
}

// ------------------------------------------------------------------ badges

import { PROVENANCE_LEVELS, ENTRY_STATUSES, DIMENSIONS } from '../shared/constants.mjs';

const TONE_CLASS = { pos: 'pos', info: 'info', warn: 'warn', neg: 'neg', neutral: 'neutral' };

export function provenanceBadge(level, { withLabel = true } = {}) {
  const def = PROVENANCE_LEVELS[level] ?? { label: level, tone: 'neutral', description: '' };
  const label = def.label ?? level;
  return raw(
    `<span class="badge ${TONE_CLASS[def.tone] ?? 'neutral'} provenance-badge" title="${esc(def.description ?? '')}">` +
    `${icon(level === 'ai' ? 'flash' : 'info').toString()}${withLabel ? esc(label) : ''}</span>`,
  );
}

export function statusBadge(status) {
  const def = ENTRY_STATUSES[status] ?? { label: status, tone: 'neutral' };
  return raw(`<span class="badge ${TONE_CLASS[def.tone] ?? 'neutral'}">${esc(def.label)}</span>`);
}

export function dimensionBadge(dim) {
  const def = DIMENSIONS[dim] ?? { short: dim };
  return raw(`<span class="badge outline">${esc(def.short)}</span>`);
}

export function bandBadge(band) {
  const labels = { comfortable: 'Comfortable', stretch: 'Stretch', challenge: 'Challenge' };
  const tone = { comfortable: 'pos', stretch: 'info', challenge: 'warn' };
  return raw(`<span class="badge ${tone[band] ?? 'neutral'}">${esc(labels[band] ?? band)}</span>`);
}

// ------------------------------------------------------------------ toast

let toastHost = null;

export function toast(message, tone = 'info', ms = 4200) {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toast-host';
    document.body.appendChild(toastHost);
  }
  const el = document.createElement('div');
  el.className = `toast ${TONE_CLASS[tone] ?? 'info'}`;
  el.innerHTML = `<span class="toast-icon">${icon(tone === 'pos' ? 'check' : tone === 'warn' || tone === 'neg' ? 'alert' : 'info').toString()}</span><span>${esc(message)}</span>`;
  toastHost.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

// ------------------------------------------------------------------ modal

export function modal({ title, bodyHtml, actionsHtml = '', onClose = null }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML =
    `<div class="modal" role="dialog" aria-modal="true">` +
    `<header><h3>${esc(title)}</h3><button class="icon-btn modal-close" aria-label="Close">${icon('x').toString()}</button></header>` +
    `<div class="modal-body">${bodyHtml}</div>` +
    (actionsHtml ? `<footer class="modal-actions">${actionsHtml}</footer>` : '') +
    `</div>`;
  const close = () => {
    overlay.classList.remove('in');
    setTimeout(() => overlay.remove(), 200);
    if (onClose) onClose();
  };
  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('in'));
  return { el: overlay, close };
}

// ------------------------------------------------------------------ misc

export function emptyState({ iconName = 'info', title, message, actionHtml = '' }) {
  return raw(
    `<div class="empty-state">${icon(iconName, 'large')}<h3>${esc(title)}</h3><p>${esc(message)}</p>${actionHtml}</div>`,
  );
}

export function spinner(label = 'Loading') {
  return raw(`<div class="spinner-row"><span class="spinner"></span><span class="muted">${esc(label)}...</span></div>`);
}

export function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function timeAgo(v) {
  if (!v) return '';
  const t = new Date(v).getTime();
  if (Number.isNaN(t)) return '';
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  return fmtDate(v);
}

export function fmtCount(n) {
  const v = Number(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}
