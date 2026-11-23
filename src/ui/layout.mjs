/**
 * App shell: sidebar navigation (top bar + bottom tabs on small screens),
 * active-language selector, online/offline + sync indicator.
 */

import { icon, esc } from './components.mjs';
import { getState, setState, subscribe, setActiveLanguage } from '../core/store.mjs';
import { navigate } from '../core/router.mjs';
import { flushQueue, refreshQueueCount } from '../core/sync.mjs';

const NAV_GROUPS = [
  {
    label: 'Learn',
    items: [
      { hash: '#/', icon: 'dashboard', label: 'Dashboard' },
      { hash: '#/discover', icon: 'compass', label: 'Discover' },
      { hash: '#/reading', icon: 'book', label: 'Reading' },
      { hash: '#/listening', icon: 'headphones', label: 'Listening' },
    ],
  },
  {
    label: 'Practice',
    items: [
      { hash: '#/review', icon: 'review', label: 'Review' },
      { hash: '#/practice', icon: 'pencil', label: 'Writing' },
      { hash: '#/grammar', icon: 'brain', label: 'Grammar' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { hash: '#/knowledge', icon: 'globe', label: 'Knowledge' },
      { hash: '#/collections', icon: 'library', label: 'Collections' },
    ],
  },
  {
    label: 'System',
    items: [{ hash: '#/settings', icon: 'settings', label: 'Settings' }],
  },
];

export function renderLayout(root) {
  root.innerHTML =
    `<div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">${icon('globe').toString()}</span>
          <div class="brand-text"><strong>Linguarium</strong><small>universal language learning</small></div>
        </div>
        <nav id="side-nav">${navHtml()}</nav>
        <div class="sidebar-footer">
          <div class="lang-select">
            <label for="active-language">Language</label>
            <select id="active-language" aria-label="Active language"></select>
          </div>
          <div class="sync-status" id="sync-status"></div>
        </div>
      </aside>
      <div class="main-col">
        <header class="topbar">
          <div class="topbar-title" id="topbar-title">Dashboard</div>
          <div class="topbar-actions">
            <span id="offline-pill"></span>
            <button class="btn subtle" id="btn-sync" title="Flush the offline queue now">${icon('download')}<span>Sync</span></button>
            <div class="user-chip" id="user-chip"></div>
          </div>
        </header>
        <main id="view" class="view"></main>
      </div>
    </div>`;

  // Navigation clicks
  root.querySelector('#side-nav').addEventListener('click', (e) => {
    const a = e.target.closest('[data-nav]');
    if (a) navigate(a.dataset.nav);
  });

  // Language selector
  const select = root.querySelector('#active-language');
  select.addEventListener('change', () => {
    setActiveLanguage(select.value);
  });

  // Sync button
  root.querySelector('#btn-sync').addEventListener('click', async () => {
    await flushQueue();
    await refreshQueueCount();
  });

  const unsub = subscribe(() => updateChrome(root));
  updateChrome(root);

  window.addEventListener('online', () => {
    setState({ online: true });
    flushQueue({ silent: false }).then(() => refreshQueueCount());
  });
  window.addEventListener('offline', () => setState({ online: false }));

  return { unsubscribe: unsub };
}

function navHtml() {
  const current = location.hash || '#/';
  return NAV_GROUPS.map((group) => {
    const items = group.items
      .map((item) => {
        const active = item.hash === current || (item.hash !== '#/' && current.startsWith(item.hash));
        return (
          `<a href="${item.hash}" data-nav="${item.hash}" class="nav-item ${active ? 'active' : ''} ${item.soon ? 'soon' : ''}">` +
          `${icon(item.icon).toString()}<span>${esc(item.label)}</span>${item.soon ? '<em class="phase-tag">phase 2</em>' : ''}` +
          `</a>`
        );
      })
      .join('');
    return `<div class="nav-group"><div class="nav-group-label">${esc(group.label)}</div>${items}</div>`;
  }).join('');
}

function updateChrome(root) {
  const state = getState();

  // Active nav highlight (cheap: re-render the nav)
  const nav = root.querySelector('#side-nav');
  if (nav) nav.innerHTML = navHtml();

  // Language selector options
  const select = root.querySelector('#active-language');
  if (select) {
    const { languages, profiles, activeLanguage } = state;
    const profileCodes = new Set((profiles ?? []).map((p) => p.language_code));
    if (languages.length > 0 && profileCodes.size > 0) {
      const options = languages
        .filter((l) => profileCodes.has(l.code) || l.code === activeLanguage)
        .map((l) => `<option value="${esc(l.code)}" ${l.code === activeLanguage ? 'selected' : ''}>${esc(l.name)}</option>`)
        .join('');
      if (select.dataset.rendered !== options) {
        select.innerHTML = options;
        select.dataset.rendered = options;
      }
      select.disabled = false;
    } else if (profileCodes.size === 0) {
      select.innerHTML = '<option value="">Add a language in Settings</option>';
      select.disabled = true;
    }
  }

  // Sync / offline indicator
  const pill = root.querySelector('#offline-pill');
  if (pill) {
    if (!state.online) {
      pill.innerHTML = `<span class="badge warn">${icon('offline').toString()}offline</span>`;
    } else if (state.queueCount > 0) {
      pill.innerHTML = `<span class="badge info">${icon('clock').toString()}${state.queueCount} queued</span>`;
    } else {
      pill.innerHTML = '';
    }
  }

  // User chip
  const chip = root.querySelector('#user-chip');
  if (chip) {
    const name = state.user?.name || state.user?.email || 'signed in';
    chip.innerHTML = `<span class="avatar">${esc((name || '?').slice(0, 1).toUpperCase())}</span><span class="user-name">${esc(name)}</span>`;
  }
}
