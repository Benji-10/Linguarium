/**
 * Settings: language profiles, difficulty modes, custom languages,
 * account, privacy, offline & sync, data export and deletion.
 */

import { icon, esc, toast, modal, spinner } from '../ui/components.mjs';
import { getState, setState } from '../core/store.mjs';
import { navigate } from '../core/router.mjs';
import { api } from '../core/api.mjs';
import { loadProfiles, loadLanguages, refreshAll } from '../core/data.mjs';
import { doLogout, doUpdateDisplayName, doPasswordChange, doRequestRecovery } from '../core/auth.mjs';
import { flushQueue, refreshQueueCount, lastSyncTime } from '../core/sync.mjs';
import { downloadExport } from '../core/api.mjs';
import { clearAll } from '../core/idb.mjs';
import { DIFFICULTY_MODES, DIMENSIONS, PROFICIENCY_LEVELS } from '../shared/constants.mjs';
import { currentMode, currentSkin, setMode, setSkin, SKINS } from '../core/theme.mjs';
import { configureWeights, resetWeights, usingCustomWeights } from '../shared/fsrs.mjs';

export async function renderSettings(container) {
  const state = getState();
  container.innerHTML = `${spinner('Loading settings')}`;
  await loadProfiles();

  const draw = () => {
    const s = getState();
    const glossOptions = ['en', 'zh', 'es', 'fr', 'de', 'ru', 'ja', 'pt', 'ar', 'hi', 'ko', 'it', 'nl', 'sv', 'tr', 'vi', 'eo', 'tok']
      .map((g) => `<option value="${g}">${esc(g)}</option>`)
      .join('');

    container.innerHTML = `
      <section class="page-head"><div><h1>${icon('settings')}Settings</h1>
      <p class="muted">Profiles, difficulty modes, custom languages, your data and your account.</p></div></section>

      <section class="panel">
        <div class="panel-head"><h2>${icon('globe')}Language profiles</h2></div>
        <p class="muted small">One profile per language you study. Declare your level per language (complete beginner in Korean, fluent in French - whatever is true for you); the difficulty mode steers recommendations, the gloss language is the language definitions are written in (never assumed to be English).</p>
        <div class="profile-rows">
          ${(s.profiles ?? []).map((p) => profileRowHtml(p, glossOptions)).join('') || '<p class="muted small">No profiles yet - add your first language below.</p>'}
        </div>
        <div class="profile-add">
          <select id="p-new-language">
            ${(s.languages ?? []).filter((l) => !(s.profiles ?? []).some((p) => p.language_code === l.code))
              .map((l) => `<option value="${esc(l.code)}">${esc(l.name)}</option>`)
              .join('')}
          </select>
          <button class="btn primary" id="p-add">${icon('plus')}Add language</button>
          <button class="btn subtle" id="p-custom">${icon('pencil')}Define a custom language</button>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>${icon('offline')}Offline &amp; sync</h2></div>
        <p class="muted small">Reading, review and lookup work offline from the local cache. Review events and edits queue and flush through /api/sync with conflict reporting - learning progress is never silently overwritten.</p>
        <div class="sync-row">
          <span class="muted" id="sync-info"></span>
          <button class="btn subtle" id="s-sync-now">${icon('download')}Sync now</button>
          <button class="btn subtle" id="s-clear-cache">Clear local cache</button>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>${icon('download')}Your data</h2></div>
        <p class="muted small">A full, portable backup: entries, FSRS states, review history, collections and texts - one documented JSON file (docs/OFFLINE-AND-SYNC.md).</p>
        <div class="sync-row">
          <button class="btn" id="s-export">${icon('download')}Export backup</button>
          <button class="btn subtle" id="s-import">${icon('upload')}Import backup</button>
          <input type="file" id="s-import-file" accept="application/json,.json" hidden>
          <button class="btn subtle danger" id="s-purge-data">Delete all my learning data</button>
          <button class="btn subtle danger" id="s-delete-account">Delete my account</button>
        </div>
        <p class="muted small">Import merges: unknown entries, collections and texts are restored; anything that already exists here keeps its CURRENT state (nothing newer is overwritten, skipped items are reported). Review history stays append-only and is not re-imported. Deletion is two-step (type DELETE to confirm) and only touches your own rows.</p>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>${icon('settings')}Account</h2></div>
        <div class="stack narrow">
          <label>Display name <input id="a-name" value="${esc(s.user?.name ?? '')}" maxlength="80"></label>
          <label>New password <input id="a-pass" type="password" minlength="8" placeholder="Leave empty to keep the current one"></label>
          <div class="sync-row">
            <button class="btn primary" id="a-save">Save</button>
            <button class="btn subtle" id="a-recovery">Send password reset email</button>
            <button class="btn subtle" id="a-logout">Sign out</button>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>${icon('info')}Privacy</h2></div>
        <p class="muted small">Only what is needed to run your learning is stored: your profile, languages, vocabulary, review history, texts and progress. No third-party trackers or analytics are loaded anywhere in the app. Data lives in your own Neon database. See docs/PRIVACY.md for the full statement, including the AI policy: enrichment requests are optional, rate-limited, cache-shared, and the model only ever sees a single term and a language name.</p>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>${icon('sliders')}Personalization</h2></div>
        <p class="muted small">Phase 3: scheduling is personal. Per language you choose the target retention of each ability dimension (how hard the scheduler pushes before a review), daily caps for review sessions and new cards, and - once your review history is long enough - FSRS parameters fitted to your own forgetting curve. Everything is labelled for what it is: an automated fit, never magic.</p>
        <div id="personalization-body">${spinner('Reading your scheduling preferences')}</div>
      </section>

      <section class="panel">
        <div class="panel-head"><h2>${icon('eye')}Appearance</h2></div>
        <div class="appearance-block">
          <div class="appearance-row">
            <div>
              <strong class="small">Mode</strong>
              <p class="muted small">Light, dark, or follow the system. The topbar button flips between them quickly.</p>
            </div>
            <select id="theme-select">
              <option value="auto" ${s.theme === 'auto' ? 'selected' : ''}>Follow the system</option>
              <option value="light" ${s.theme === 'light' ? 'selected' : ''}>Light</option>
              <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Dark</option>
            </select>
          </div>
          <div class="appearance-row skin-row">
            <div>
              <strong class="small">Accent</strong>
              <p class="muted small">Every accent works in both light and dark mode. ${icon('info')} System fonts only - nothing is loaded from third-party servers.</p>
            </div>
            <div class="skin-grid" id="skin-grid">
              ${SKINS.map(
                (skin) => `<button class="skin-swatch ${skin.id === currentSkin() ? 'active' : ''}" data-skin="${skin.id}" title="${esc(skin.label)} accent">`
                  + `<span class="skin-dot" style="--dot:${skin.light}"></span><span class="skin-dot dark" style="--dot:${skin.dark}"></span>`
                  + `<span class="skin-name">${esc(skin.label)}</span></button>`,
              ).join('')}
            </div>
          </div>
        </div>
      </section>
    `;

    bindProfileControls(container, draw);
    bindDataControls(container);
    bindAccountControls(container);
    bindTheme(container);
    bindPersonalization(container);
    updateSyncInfo();
  };

  const updateSyncInfo = async () => {
    const el = container.querySelector('#sync-info');
    if (!el) return;
    const s = getState();
    const last = await lastSyncTime();
    el.innerHTML = `${s.online ? 'Online.' : 'Offline.'} ${s.queueCount} change${s.queueCount === 1 ? '' : 's'} queued${
      last ? ` - last synced ${new Date(last).toLocaleTimeString()}` : ''
    }`;
  };

  const bindProfileControls = (root, redraw) => {
    root.querySelector('#p-add')?.addEventListener('click', async () => {
      const code = root.querySelector('#p-new-language')?.value;
      if (!code) {
        toast('Every preset is already in your profiles - define a custom language if you study something else.', 'info');
        return;
      }
      try {
        await api('/api/profiles', {
          method: 'PUT',
          body: { language_code: code, difficulty_mode: 'stretch', gloss_language: 'en' },
        });
        await loadProfiles();
        setState({ activeLanguage: code });
        localStorage.setItem('linguarium.activeLanguage', code);
        redraw();
        toast('Language profile added.', 'pos');
      } catch (err) {
        toast(err.message ?? 'Could not add the profile.', 'neg');
      }
    });

    root.querySelector('#p-custom')?.addEventListener('click', openCustomLanguage);

    root.querySelectorAll('[data-set-active]').forEach((btn) =>
      btn.addEventListener('click', () => {
        setState({ activeLanguage: btn.dataset.setActive });
        localStorage.setItem('linguarium.activeLanguage', btn.dataset.setActive);
        redraw();
      }),
    );

    root.querySelectorAll('.profile-row').forEach((row) => {
      const code = row.dataset.lang;
      row.querySelector('.pm-mode')?.addEventListener('change', async (e) => {
        try {
          await api('/api/profiles', {
            method: 'PUT',
            body: { language_code: code, difficulty_mode: e.target.value, gloss_language: row.querySelector('.pm-gloss').value },
          });
          await loadProfiles();
          toast('Mode saved.', 'pos');
        } catch (err) {
          toast(err.message ?? 'Could not save the mode.', 'neg');
        }
      });
      row.querySelector('.pm-gloss')?.addEventListener('change', async (e) => {
        try {
          await api('/api/profiles', {
            method: 'PUT',
            body: { language_code: code, difficulty_mode: row.querySelector('.pm-mode').value, gloss_language: e.target.value },
          });
          await loadProfiles();
          toast('Gloss language saved.', 'pos');
        } catch (err) {
          toast(err.message ?? 'Could not save the gloss language.', 'neg');
        }
      });
      row.querySelector('.pm-level')?.addEventListener('change', async (e) => {
        const value = e.target.value || null;
        try {
          await api('/api/profiles', {
            method: 'PUT',
            body: { language_code: code, level: value },
          });
          await loadProfiles();
          toast(value ? `Level saved: ${e.target.selectedOptions[0]?.textContent ?? value}.` : 'Level cleared.', 'pos');
        } catch (err) {
          toast(err.message ?? 'Could not save the level.', 'neg');
        }
      });
      row.querySelector('.pm-remove')?.addEventListener('click', async () => {
        if (!confirm(`Remove the ${code} profile? Entries and history are kept.`)) return;
        try {
          await api('/api/profiles', { method: 'DELETE', params: { language: code } });
          await loadProfiles();
          redraw();
          toast('Profile removed.', 'pos');
        } catch (err) {
          toast(err.message ?? 'Could not remove it.', 'neg');
        }
      });
      // Library edition (custom languages): the wiki code the open sources
      // read for this language. Defined ONCE here; the library tab, the
      // catalog and the imports all use it without asking again.
      row.querySelector('.pm-edition')?.addEventListener('change', async (e) => {
        const edition = e.target.value.trim().toLowerCase();
        try {
          await api('/api/languages', { method: 'PUT', body: { code, source_edition: edition } });
          await loadLanguages();
          toast(edition ? `Library edition saved: ${edition} - every source now reads it.` : 'Library edition cleared - sources will ask for a code again.', 'pos');
        } catch (err) {
          toast(err.message ?? 'Could not save the edition.', 'neg');
          e.target.value = '';
        }
      });
    });
  };

  const openCustomLanguage = () => {
    const m = modal({
      title: 'Define a custom language',
      bodyHtml: `
        <p class="muted small">The platform is language-agnostic: any language works, including constructed or under-resourced ones. Tokenizer settings decide how texts are split into clickable words.</p>
        <form class="stack">
          <label>Name <input id="l-name" required maxlength="80" placeholder="e.g. Solresol"></label>
          <label>Code (2-16 chars) <input id="l-code" required maxlength="16" pattern="[a-z][a-z0-9-]+" placeholder="e.g. srs"></label>
          <label>Library edition (optional) <input id="l-edition" maxlength="12" placeholder="wiki code the sources read, e.g. mi, scn, simple">
            <span class="muted small">If the language code is not itself a wiki edition, this is the edition the open library reads - define it once here and every source uses it.</span></label>
          <label>Direction <select id="l-direction"><option value="ltr">left-to-right</option><option value="rtl">right-to-left</option></select></label>
          <label>Tokenizer
            <div class="tok-options">
              <label class="check"><input type="checkbox" id="l-charlevel"> Character-level (no word spaces, e.g. Thai, Japanese)</label>
              <label class="check"><input type="checkbox" id="l-casefold" checked> Fold case when matching terms (e.g. Latin-script languages)</label>
              <label class="check"><input type="checkbox" id="l-apostrophe"> Apostrophes inside words (e.g. l'hiver)</label>
              <label class="check"><input type="checkbox" id="l-hyphen" checked> Hyphens inside words</label>
            </div>
          </label>
        </form>`,
      actionsHtml: `<button class="btn subtle" data-close>Cancel</button><button class="btn primary" id="l-save">Create language</button>`,
    });
    m.el.querySelector('[data-close]').addEventListener('click', m.close);
    m.el.querySelector('#l-save').addEventListener('click', async () => {
      const g = (id) => m.el.querySelector(`#${id}`).value.trim();
      const c = (id) => m.el.querySelector(`#${id}`).checked;
      if (!g('l-name') || !g('l-code')) {
        toast('A name and a code are required.', 'warn');
        return;
      }
      try {
        await api('/api/languages', {
          method: 'POST',
          body: {
            name: g('l-name'),
            code: g('l-code'),
            direction: g('l-direction'),
            source_edition: g('l-edition') || null,
            tokenizer: {
              charLevel: c('l-charlevel'),
              caseFold: c('l-casefold'),
              innerApostrophe: c('l-apostrophe'),
              innerHyphen: c('l-hyphen'),
            },
          },
        });
        await loadLanguages();
        await api('/api/profiles', {
          method: 'PUT',
          body: { language_code: g('l-code'), difficulty_mode: 'stretch', gloss_language: 'en' },
        });
        await loadProfiles();
        m.close();
        draw();
        toast('Custom language created and added to your profiles.', 'pos');
      } catch (err) {
        toast(err.message ?? 'Could not create the language.', 'neg');
      }
    });
  };

  const bindDataControls = (root) => {
    root.querySelector('#s-sync-now')?.addEventListener('click', async () => {
      await flushQueue();
      await refreshQueueCount();
      updateSyncInfo();
    });
    root.querySelector('#s-clear-cache')?.addEventListener('click', async () => {
      if (!confirm('Clear the offline cache on this device? Your account data on the server is untouched.')) return;
      await clearAll();
      toast('Local cache cleared.', 'pos');
    });
    root.querySelector('#s-export')?.addEventListener('click', async () => {
      try {
        await downloadExport();
        toast('Backup downloaded.', 'pos');
      } catch (err) {
        toast(err.message ?? 'Export failed.', 'neg');
      }
    });
    root.querySelector('#s-purge-data')?.addEventListener('click', () => confirmDelete('data'));
    root.querySelector('#s-delete-account')?.addEventListener('click', () => confirmDelete('full'));

    // Import backup (phase 2): merge on the server, never overwrite progress.
    root.querySelector('#s-import')?.addEventListener('click', () => {
      root.querySelector('#s-import-file')?.click();
    });
    root.querySelector('#s-import-file')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (!confirm(`Import ${file.name}? Unknown items are restored; anything already present here keeps its current state.`)) return;
      let backup;
      try {
        backup = JSON.parse(await file.text());
      } catch {
        toast('That file is not valid JSON.', 'neg');
        return;
      }
      try {
        const result = await api('/api/import', { method: 'POST', body: backup });
        const i = result.imported ?? {};
        const sk = result.skipped ?? {};
        const lines = [
          `${i.entries ?? 0} entries (${i.memories ?? 0} memory states)`,
          `${i.collections ?? 0} collections`,
          `${i.texts ?? 0} texts`,
          `${i.profiles ?? 0} profiles, ${i.grammar ?? 0} grammar stages`,
        ].join(', ');
        const skippedLine = Object.entries(sk).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(', ');
        toast(`Imported: ${lines}.`, 'pos');
        if (skippedLine) toast(`Kept current versions of: ${skippedLine} - nothing was overwritten.`, 'info');
        const { loadLanguages, refreshAll } = await import('../core/data.mjs');
        await Promise.all([loadLanguages(), refreshAll()]);
      } catch (err) {
        toast(err.message ?? 'Import failed.', 'neg');
      }
    });
  };

  const confirmDelete = (mode) => {
    const m = modal({
      title: mode === 'full' ? 'Delete your account' : 'Delete all learning data',
      bodyHtml: `
        <p>${
          mode === 'full'
            ? 'This deletes every row of your data AND the login account itself. There is no undo.'
            : 'This deletes every row of your learning data. The login stays, empty and usable. There is no undo.'
        }</p>
        <p class="muted small">Export a backup first if there is any chance you want it back.</p>
        <label>Type <strong>DELETE</strong> to confirm <input id="del-confirm" placeholder="DELETE"></label>`,
      actionsHtml: `<button class="btn subtle" data-close>Cancel</button><button class="btn danger" id="del-go">Delete ${mode === 'full' ? 'account' : 'data'}</button>`,
    });
    m.el.querySelector('[data-close]').addEventListener('click', m.close);
    m.el.querySelector('#del-go').addEventListener('click', async () => {
      if (m.el.querySelector('#del-confirm').value !== 'DELETE') {
        toast('Type DELETE (capitals) to confirm.', 'warn');
        return;
      }
      try {
        const res = await api('/api/account', { method: 'DELETE', params: { mode }, body: { confirm: 'DELETE' } });
        await clearAll();
        if (mode === 'full') {
          await doLogout();
          toast('Account and data deleted. Goodbye.', 'pos');
          location.hash = '#/';
          location.reload();
          return;
        }
        toast('Learning data deleted. The account remains, empty.', 'pos');
        await refreshAll();
        m.close();
        draw();
      } catch (err) {
        toast(err.message ?? 'Deletion failed.', 'neg');
      }
    });
  };

  const bindAccountControls = (root) => {
    root.querySelector('#a-save')?.addEventListener('click', async () => {
      const name = root.querySelector('#a-name').value.trim();
      const pass = root.querySelector('#a-pass').value;
      try {
        if (name && name !== (getState().user?.name ?? '')) await doUpdateDisplayName(name);
        if (pass) await doPasswordChange(pass);
        toast('Account saved.', 'pos');
        root.querySelector('#a-pass').value = '';
      } catch (err) {
        toast(err.message ?? 'Could not save.', 'neg');
      }
    });
    root.querySelector('#a-recovery')?.addEventListener('click', async () => {
      try {
        await doRequestRecovery(getState().user?.email ?? '');
        toast('Recovery email sent (if the address is registered).', 'pos');
      } catch (err) {
        toast(err.message ?? 'Could not send the email.', 'neg');
      }
    });
    root.querySelector('#a-logout')?.addEventListener('click', async () => {
      await doLogout();
      navigate('#/');
      location.reload();
    });
  };

  const bindTheme = (root) => {
    root.querySelector('#theme-select')?.addEventListener('change', (e) => {
      const theme = e.target.value;
      localStorage.setItem('linguarium.theme', theme);
      setState({ theme });
      setMode(theme);
    });
    root.querySelector('#skin-grid')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-skin]');
      if (!btn) return;
      setSkin(btn.dataset.skin);
      root.querySelectorAll('.skin-swatch').forEach((el) => el.classList.toggle('active', el === btn));
      toast(`${btn.querySelector('.skin-name')?.textContent ?? 'Accent'} accent applied.`, 'pos');
    });
  };

  // ------------------------------------------------------------- phase 3

  const bindPersonalization = async (root) => {
    const host = root.querySelector('#personalization-body');
    if (!host) return;

    // --- FSRS parameter fitting card (account-wide) ---
    let fitted = null;
    try {
      fitted = await api('/api/fsrs-optimize');
    } catch {
      fitted = null;
    }

    const drawPersonalization = () => {
      const profiles = getState().profiles ?? [];
      const weightsActive = usingCustomWeights();
      host.innerHTML = `
        <div class="profile-sched-rows">
          ${
            profiles.length === 0
              ? '<p class="muted small">No language profiles yet - add a language above.</p>'
              : profiles.map(profileSchedRowHtml).join('')
          }
        </div>
        <div class="fsrs-fit-card">
          <div class="panel-head">
            <h2>${icon('flash')}FSRS parameters fitted to your history</h2>
            <span class="badge ${weightsActive ? 'pos' : 'neutral'}">${weightsActive ? 'in use on this device' : 'defaults in use'}</span>
          </div>
          <p class="muted small">The 19 FSRS-5 weights can be refitted to your own review log (at least 300 scored intervals are needed, so the fit is meaningful and not noise-chasing). This is automated analysis, provenance-labelled, and reversible at any time.</p>
          <div id="fsrs-fit-state">${fsrsFitStateHtml(fitted, weightsActive)}</div>
          <div class="sync-row">
            <button class="btn primary" id="fsrs-fit-run">${icon('flash')}Fit parameters to my review history</button>
            ${weightsActive || fitted?.weights ? `<button class="btn subtle" id="fsrs-fit-forget">${icon('x')}Back to default parameters</button>` : ''}
          </div>
        </div>`;

      root.querySelectorAll('[data-pers-profile]').forEach((btn) =>
        btn.addEventListener('click', () => openSchedulingModal(btn.dataset.persProfile)),
      );
      root.querySelector('#fsrs-fit-run')?.addEventListener('click', () => runFsrsFit(host));
      root.querySelector('#fsrs-fit-forget')?.addEventListener('click', async () => {
        try {
          await api('/api/fsrs-optimize', { method: 'DELETE' });
        } catch {
          /* the server copy may already be gone */
        }
        localStorage.removeItem('linguarium.fsrsWeights');
        resetWeights();
        fitted = null;
        toast('Back to the default FSRS-5 parameters everywhere.', 'pos');
        drawPersonalization();
      });
    };

    const runFsrsFit = async () => {
      const btn = root.querySelector('#fsrs-fit-run');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `${icon('flash')}Fitting...`;
      }
      try {
        const result = await api('/api/fsrs-optimize', { method: 'POST' });
        if (result?.fitted) {
          fitted = result;
          const delta = Math.round((1 - result.loss_optimized / result.loss_default) * 1000) / 10;
          const m = modal({
            title: 'FSRS parameters fitted',
            bodyHtml: `
              <p>Fit complete: the log-loss on your own review history improved by <strong>${delta}%</strong> (${result.review_count} scored intervals, ${result.sequences} sequences).</p>
              <p class="muted small">Default loss ${result.loss_default.toFixed(4)} -> fitted loss ${result.loss_optimized.toFixed(4)}. This is an automated fit to your history - not a guarantee. Applying it is your choice and fully reversible.</p>`,
            actionsHtml: `<button class="btn subtle" data-close>Not now</button><button class="btn primary" id="fsrs-apply">Use the fitted parameters</button>`,
          });
          m.el.querySelector('[data-close]').addEventListener('click', m.close);
          m.el.querySelector('#fsrs-apply').addEventListener('click', () => {
            applyWeights(result.weights);
            m.close();
          });
          drawPersonalization();
        } else {
          toast(result?.reason ?? 'The optimizer could not improve on the default parameters. Nothing was changed.', 'info');
        }
      } catch (err) {
        toast(err.message ?? 'The fit failed.', 'neg');
      }
      drawPersonalization();
    };

    const applyWeights = (weights) => {
      configureWeights(weights);
      localStorage.setItem('linguarium.fsrsWeights', JSON.stringify(weights));
      toast('Your fitted FSRS parameters are now scheduling your reviews.', 'pos');
      drawPersonalization();
    };

    drawPersonalization();
  };

  const openSchedulingModal = (code) => {
    const s = getState();
    const profile = (s.profiles ?? []).find((p) => p.language_code === code);
    if (!profile) return;
    const lang = (s.languages ?? []).find((l) => l.code === code);
    const dims = ['recognition', 'recall', 'production'];
    const m = modal({
      title: `Scheduling - ${lang?.name ?? code}`,
      bodyHtml: `
        <form class="stack" id="sched-form">
          ${dims
            .map((dim) => {
              const value = profile[`retention_${dim}`] ?? 0.9;
              return `<label class="retention-row">${DIMENSIONS[dim].label} target retention
            <span class="retention-live mono" id="ret-live-${dim}">${Math.round(value * 100)}%</span>
            <input type="range" id="ret-${dim}" min="70" max="97" step="1" value="${Math.round(value * 100)}">
            <span class="muted small">${DIMENSIONS[dim].description}</span>
          </label>`;
            })
            .join('')}
          <div class="sched-limits">
            <label>Daily review cap <input type="number" min="1" max="999" id="lim-review" placeholder="no cap" value="${profile.daily_review_limit ?? ''}"></label>
            <label>Daily new-card cap <input type="number" min="1" max="999" id="lim-new" placeholder="no cap" value="${profile.daily_new_limit ?? ''}"></label>
          </div>
          <p class="muted small">Higher retention = shorter intervals = more reviews; lower = longer gaps, riskier recall. Caps count today's totals for this language (any dimension) and are reported honestly in the review session - never silently.</p>
        </form>`,
      actionsHtml: `<button class="btn subtle" data-close>Cancel</button><button class="btn primary" id="sched-save">Save scheduling</button>`,
    });
    m.el.querySelectorAll('input[type=range]').forEach((range) => {
      range.addEventListener('input', () => {
        const live = m.el.querySelector(`#ret-live-${range.id.replace('ret-', '')}`);
        if (live) live.textContent = `${range.value}%`;
      });
    });
    m.el.querySelector('[data-close]').addEventListener('click', m.close);
    m.el.querySelector('#sched-save').addEventListener('click', async () => {
      const val = (id) => {
        const el = m.el.querySelector(id);
        return el && el.value !== '' ? Number(el.value) : null;
      };
      try {
        await api('/api/profiles', {
          method: 'PUT',
          body: {
            language_code: code,
            difficulty_mode: profile.difficulty_mode,
            gloss_language: profile.gloss_language,
            retention_recognition: val('#ret-recognition') / 100,
            retention_recall: val('#ret-recall') / 100,
            retention_production: val('#ret-production') / 100,
            daily_review_limit: val('#lim-review'),
            daily_new_limit: val('#lim-new'),
          },
        });
        await loadProfiles();
        m.close();
        toast('Scheduling preferences saved.', 'pos');
        const host = document.querySelector('#personalization-body');
        if (host) bindPersonalization(document.querySelector('.view'));
      } catch (err) {
        toast(err.message ?? 'Could not save the scheduling preferences.', 'neg');
      }
    });
  };

  const fsrsFitStateHtml = (fitted, weightsActive) => {
    if (weightsActive && fitted?.weights) {
      const delta = Math.round((1 - fitted.loss_optimized / fitted.loss_default) * 1000) / 10;
      return `<p class="muted small">Fitted ${new Date(fitted.trained_at).toLocaleDateString()} from ${fitted.review_count} intervals (loss improvement ${Number.isFinite(delta) ? `${delta}%` : 'n/a'}). <strong>These parameters are scheduling your reviews on this device.</strong> Back up any time: they are included in your export.</p>`;
    }
    if (fitted?.weights) {
      return `<p class="muted small">A fitted parameter set exists (trained ${new Date(fitted.trained_at).toLocaleDateString()}, ${fitted.review_count} intervals) but is not in use on this device. Fit again to re-evaluate, or review on another device.</p>`;
    }
    return '<p class="muted small">No fitted parameters yet. The FSRS-5 defaults are in use - they are excellent parameters, and fitting is optional.</p>';
  };

  // ------------------------------------------------------------ phase 3 end

  draw();
  return () => {};
}

function profileRowHtml(p, glossOptions) {
  const s = getState();
  const lang = (s.languages ?? []).find((l) => l.code === p.language_code);
  const modes = Object.entries(DIFFICULTY_MODES)
    .map(([value, def]) => `<option value="${value}" ${p.difficulty_mode === value ? 'selected' : ''}>${def.label}</option>`)
    .join('');
  // A rough, transparent hint from the learner's own vocabulary for this
  // language - never a CEFR claim, and never auto-applied.
  const langEntries = (s.entries ?? []).filter((e) => e.language_code === p.language_code);
  const suggestion =
    langEntries.length >= 800 ? 'fluent' : langEntries.length >= 300 ? 'advanced' : langEntries.length >= 75 ? 'intermediate' : langEntries.length >= 15 ? 'beginner' : 'complete-beginner';
  const levelOptions = [
    `<option value="" ${p.level ? '' : 'selected'}>not declared</option>`,
    ...PROFICIENCY_LEVELS.map(
      (l) => `<option value="${l.value}" ${p.level === l.value ? 'selected' : ''}>${l.label} - ${l.hint}</option>`,
    ),
  ].join('');
  return `
  <div class="profile-row" data-lang="${esc(p.language_code)}">
    <div class="profile-main">
      <strong>${esc(lang?.name ?? p.language_code)}</strong>
      <span class="muted small">${esc(p.language_code)}${lang?.native_name ? ` - ${esc(lang.native_name)}` : ''}</span>
      ${s.activeLanguage === p.language_code ? '<span class="badge pos">active</span>' : `<button class="btn subtle small" data-set-active="${esc(p.language_code)}">Set active</button>`}
      <span class="muted small" title="A transparent hint, never auto-applied - declare what is true for you.">your vocabulary here: ${langEntries.length} terms - rough suggestion: ${esc(PROFICIENCY_LEVELS.find((l) => l.value === suggestion)?.label ?? suggestion)}</span>
    </div>
    <div class="profile-controls">
      <label>Your level
        <select class="pm-level">${levelOptions}</select>
      </label>
      <label>Mode
        <select class="pm-mode">${modes}</select>
      </label>
      <label>Gloss language
        <select class="pm-gloss">
          ${glossOptions.replace(`value="${p.gloss_language}"`, `value="${p.gloss_language}" selected`)}
        </select>
      </label>
      ${
        lang?.kind === 'custom'
          ? `<label class="pm-edition-label" title="The wiki language code the open library reads for this language (defined once, used by every source). Leave empty to be asked per search.">Library edition
            <input class="pm-edition" maxlength="12" placeholder="e.g. mi, scn, simple" value="${esc(lang?.source_edition ?? '')}">
          </label>`
          : ''
      }
      <button class="icon-btn pm-remove" title="Remove this profile">${icon('trash')}</button>
    </div>
  </div>`;
}

/** One row of the Personalization panel: per-profile scheduling summary. */
function profileSchedRowHtml(p) {
  const s = getState();
  const lang = (s.languages ?? []).find((l) => l.code === p.language_code);
  const ret = (d) => Math.round((p[`retention_${d}`] ?? 0.9) * 100);
  const limits = `${p.daily_review_limit ? `${p.daily_review_limit} reviews/day` : 'no review cap'} - ${p.daily_new_limit ? `${p.daily_new_limit} new cards/day` : 'no new-card cap'}`;
  return `
  <div class="profile-sched-row">
    <div class="profile-sched-main">
      <strong>${esc(lang?.name ?? p.language_code)}</strong>
      <span class="muted small">recognition ${ret('recognition')}% - recall ${ret('recall')}% - production ${ret('production')}% - ${esc(limits)}</span>
    </div>
    <button class="btn subtle small" data-pers-profile="${esc(p.language_code)}">${icon('sliders')}Scheduling</button>
  </div>`;
}
