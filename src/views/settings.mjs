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
import { DIFFICULTY_MODES } from '../shared/constants.mjs';

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
        <p class="muted small">One profile per language you study. The difficulty mode steers recommendations; the gloss language is the language definitions are written in (never assumed to be English).</p>
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
          <button class="btn subtle danger" id="s-purge-data">Delete all my learning data</button>
          <button class="btn subtle danger" id="s-delete-account">Delete my account</button>
        </div>
        <p class="muted small">Deletion is two-step (type DELETE to confirm) and only touches your own rows.</p>
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
        <div class="panel-head"><h2>${icon('eye')}Appearance</h2></div>
        <div class="sync-row">
          <select id="theme-select">
            <option value="auto" ${s.theme === 'auto' ? 'selected' : ''}>Follow the system</option>
            <option value="light" ${s.theme === 'light' ? 'selected' : ''}>Light</option>
            <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Dark</option>
          </select>
        </div>
      </section>
    `;

    bindProfileControls(container, draw);
    bindDataControls(container);
    bindAccountControls(container);
    bindTheme(container);
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
      document.documentElement.dataset.theme = theme;
    });
  };

  draw();
  return () => {};
}

function profileRowHtml(p, glossOptions) {
  const s = getState();
  const lang = (s.languages ?? []).find((l) => l.code === p.language_code);
  const modes = Object.entries(DIFFICULTY_MODES)
    .map(([value, def]) => `<option value="${value}" ${p.difficulty_mode === value ? 'selected' : ''}>${def.label}</option>`)
    .join('');
  return `
  <div class="profile-row" data-lang="${esc(p.language_code)}">
    <div class="profile-main">
      <strong>${esc(lang?.name ?? p.language_code)}</strong>
      <span class="muted small">${esc(p.language_code)}${lang?.native_name ? ` - ${esc(lang.native_name)}` : ''}</span>
      ${s.activeLanguage === p.language_code ? '<span class="badge pos">active</span>' : `<button class="btn subtle small" data-set-active="${esc(p.language_code)}">Set active</button>`}
    </div>
    <div class="profile-controls">
      <label>Mode
        <select class="pm-mode">${modes}</select>
      </label>
      <label>Gloss language
        <select class="pm-gloss">
          ${glossOptions.replace(`value="${p.gloss_language}"`, `value="${p.gloss_language}" selected`)}
        </select>
      </label>
      <button class="icon-btn pm-remove" title="Remove this profile">${icon('trash')}</button>
    </div>
  </div>`;
}
