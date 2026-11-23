/**
 * Application entry point: boot authentication, load shared data
 * (falling back to the offline cache), register routes, render the shell,
 * and register the service worker (installable, offline-capable PWA).
 */

import './styles.css';
import { bootAuth } from './core/auth.mjs';
import { setState, getState, restoreActiveLanguage } from './core/store.mjs';
import { route, startRouter } from './core/router.mjs';
import { renderLayout } from './ui/layout.mjs';
import { refreshAll } from './core/data.mjs';
import { refreshQueueCount, flushQueue } from './core/sync.mjs';
import { initTheme } from './core/theme.mjs';
import { configureWeights } from './shared/fsrs.mjs';

/** Restored the fitted FSRS parameters saved on this device, if any (phase 3). */
function bootFsrsWeights() {
  try {
    const raw = localStorage.getItem('linguarium.fsrsWeights');
    if (raw) {
      const parsed = JSON.parse(raw);
      configureWeights(Array.isArray(parsed) ? parsed : parsed?.weights);
    }
  } catch {
    /* malformed local value: keep the defaults */
  }
}

async function main() {
  // Theme mode + accent skin (system / light / dark x teal/ocean/...).
  initTheme();

  // Fitted FSRS-5 parameters (phase 3 personalization): applied at boot so
  // every scheduler call in the app uses them, including offline sessions.
  bootFsrsWeights();

  const shell = document.getElementById('app');
  renderLayout(shell);

  // Register routes. Views are imported lazily by the router.
  const { renderDashboard } = await import('./views/dashboard.mjs');
  const { renderAuth } = await import('./views/auth.mjs');
  route('#/', renderDashboard);
  route('#/auth', renderAuth, { public: true });
  route('#/discover', (await import('./views/discover.mjs')).renderDiscover);
  route('#/reading', (await import('./views/reading.mjs')).renderReading);
  route('#/read/:kind/:id', (await import('./views/reader.mjs')).renderReader);
  route('#/review', (await import('./views/review.mjs')).renderReview);
  route('#/practice', (await import('./views/practice.mjs')).renderPractice);
  route('#/listening', (await import('./views/listening.mjs')).renderListening);
  route('#/knowledge', (await import('./views/knowledge.mjs')).renderKnowledge);
  route('#/grammar', (await import('./views/grammar.mjs')).renderGrammar);
  route('#/collections', (await import('./views/collections.mjs')).renderCollections);
  route('#/collections/:id', (await import('./views/collections.mjs')).renderCollections);
  route('#/contribute', (await import('./views/contribute.mjs')).renderContribute);
  route('#/settings', (await import('./views/settings.mjs')).renderSettings);

  // Boot: restore session, then load data (cache-first when offline).
  const { user } = await bootAuth();
  restoreActiveLanguage();
  setState({ booting: false });

  if (user) {
    await refreshAll();
    await refreshQueueCount();
    // Default the active language to the first profile when none was saved.
    if (!getState().activeLanguage && (getState().profiles ?? []).length > 0) {
      const first = getState().profiles[0].language_code;
      localStorage.setItem('linguarium.activeLanguage', first);
      setState({ activeLanguage: first });
    }
    if (getState().online && getState().queueCount > 0) {
      flushQueue({ silent: true }).then(() => refreshQueueCount());
    }
    // Fitted FSRS parameters: pick up the server copy on a device that has
    // none saved locally (the user explicitly chose to use them at some point).
    if (!localStorage.getItem('linguarium.fsrsWeights') && getState().online) {
      try {
        const data = await (await import('./core/api.mjs')).api('/api/fsrs-optimize');
        if (data?.weights) {
          configureWeights(data.weights);
          localStorage.setItem('linguarium.fsrsWeights', JSON.stringify(data.weights));
        }
      } catch {
        /* offline or not fitted: defaults stay in effect */
      }
    }
  }

  startRouter();

  // Service worker: installable app shell, offline reading/review.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[pwa] service worker registration failed', err);
    });
    // Background Sync wake-up (phase 2): the SW tells us connectivity is back
    // even when the window 'online' event was missed (e.g. tab backgrounded).
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'flush-queue') {
        setState({ online: navigator.onLine });
        if (navigator.onLine) {
          flushQueue({ silent: true }).then(() => refreshQueueCount());
        }
      }
    });
  }
}

main().catch((err) => {
  console.error('boot failed', err);
  const el = document.getElementById('view');
  if (el) el.innerHTML = '<section class="panel error-panel"><h2>The app failed to start</h2><p class="muted">Please reload the page.</p></section>';
});
