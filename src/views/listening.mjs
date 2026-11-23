/**
 * Listening environment (phase 2).
 *
 * One knowledge state serves listening and reading: every item opens in the
 * same interactive reader, where terms are clickable and encounters are
 * logged. Two honest audio sources, both labelled:
 *
 *   - Browser speech synthesis - machine-synthesized, not a native
 *     recording; availability depends on the voices installed on this
 *     system and is reported as it is.
 *   - Audio referenced by URL (items you add) - the file stays at its
 *     source, keeps its source/license metadata, and is never copied into
 *     the database as a binary blob.
 */

import { icon, esc, toast, spinner, emptyState, provenanceBadge, modal, bandBadge } from '../ui/components.mjs';
import { getState, setState, tokenizerFor, languageName } from '../core/store.mjs';
import { navigate } from '../core/router.mjs';
import { api } from '../core/api.mjs';
import { loadTexts } from '../core/data.mjs';
import { scoreText } from '../shared/difficulty.mjs';

export async function renderListening(container) {
  container.innerHTML = `${spinner('Loading listening material')}`;
  const state = getState();

  if (!state.textsLoaded) {
    await loadTexts();
    setState({ textsLoaded: true });
  }

  const s = getState();
  const activeLang = s.activeLanguage;
  const mode = (s.profiles ?? []).find((p) => p.language_code === activeLang)?.difficulty_mode ?? 'stretch';
  const knownSet = new Set(
    (s.entries ?? []).filter((e) => !activeLang || e.language_code === activeLang).map((e) => e.normalized),
  );

  // Shared material for the active language (+ any audio items you added).
  const sharedForLang = (s.sharedTexts ?? []).filter((t) => !activeLang || t.language_code === activeLang);
  const myTexts = (s.texts ?? []).filter((t) => !activeLang || t.language_code === activeLang);
  const audioItems = (s.texts ?? []).filter((t) => t.audio_url);

  const row = (t, kind) => {
    // Bands need the body; list responses only carry body_length, so the
    // badge is shown when a body is cached and omitted otherwise.
    let bandHtml = '';
    if (t.body) {
      const tokenizer = tokenizerFor(s.languages, t.language_code) ?? {};
      const d = scoreText({ text: t.body, tokenizer, knownSet });
      bandHtml = `${bandBadge(d.band)}<span class="muted small">${Math.round(d.familiarity * 100)}% familiar</span>`;
    }
    return `
    <div class="discover-row">
      <a class="discover-main" href="#/read/${kind}/${esc(t.id)}" data-listen="${esc(t.id)}" data-kind="${kind}">
        <strong>${esc(t.title)}</strong>
        <span class="muted small">${esc(languageName(s.languages, t.language_code))}${t.author ? ` - ${esc(t.author)}` : ''}</span>
      </a>
      <div class="discover-side">
        ${t.audio_url ? `<span class="badge info">${icon('headphones')}audio</span>` : ''}
        ${provenanceBadge(t.provenance)}
        ${bandHtml}
      </div>
    </div>`;
  };

  container.innerHTML = `
    <section class="page-head">
      <div>
        <h1>${icon('headphones')}Listening</h1>
        <p class="muted">${
          activeLang
            ? `Material in ${esc(languageName(s.languages, activeLang))} - the same reader, the same knowledge state as reading.`
            : 'Choose an active language in Settings to focus the list.'
        }</p>
      </div>
      <button class="btn primary" id="btn-add-audio">${icon('plus')}Add an audio item</button>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Listen &amp; read</h2>
        <span class="muted small" id="tts-note">checking browser voices…</span></div>
      ${
        sharedForLang.length + myTexts.length === 0
          ? emptyState({
              iconName: 'headphones',
              title: 'Nothing to listen to in this language yet',
              message: 'Shared starter texts appear once the database is seeded; paste your own text in Reading, or add an audio item above.',
            })
          : `<div class="discover-rows">${sharedForLang.map((t) => row(t, 'shared')).join('')}${myTexts.map((t) => row(t, 'user')).join('')}</div>`
      }
      <p class="muted small">Reading aloud uses your browser's speech system - machine-synthesized audio, not a native recording. Voice availability depends on the voices installed on your device.</p>
    </section>

    ${
      audioItems.length > 0
        ? `<section class="panel">
            <div class="panel-head"><h2>Your audio items</h2>
              <span class="muted small">audio referenced by URL - never stored as files in the database</span></div>
            <div class="discover-rows">${audioItems
              .map(
                (t) => `
              <div class="discover-row">
                <a class="discover-main" href="#/read/user/${esc(t.id)}" data-listen="${esc(t.id)}" data-kind="user">
                  <strong>${esc(t.title)}</strong>
                  <span class="muted small">${esc(languageName(s.languages, t.language_code))}${t.author ? ` - ${esc(t.author)}` : ''}</span>
                </a>
                <div class="discover-side">${provenanceBadge(t.provenance)}
                  <audio controls preload="none" src="${esc(t.audio_url)}" style="height:32px"></audio>
                </div>
              </div>`,
              )
              .join('')}</div>
          </section>`
        : ''
    }

    <section class="panel roadmap-note">
      <h2>${icon('info')}How listening works here</h2>
      <ul class="feature-list">
        <li>${icon('headphones').toString()}Every item opens in the interactive reader: click any term while listening to keep it - the same encounters as reading.</li>
        <li>${icon('book').toString()}The transcript is the text: one knowledge state, one vocabulary, one review schedule for listening and reading.</li>
        <li>${icon('info').toString()}Browser speech is synthesized - honest about that. Real recordings belong in audio items, referenced by URL with their source and license kept.</li>
      </ul>
    </section>
  `;

  // Voice availability note (honest, live-checked).
  const note = container.querySelector('#tts-note');
  const describeVoices = () => {
    if (!('speechSynthesis' in window)) {
      note.textContent = 'this browser cannot synthesize speech - use audio items instead';
      return;
    }
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) {
      note.textContent = 'browser voices are still loading…';
      return;
    }
    const norm = (l) => String(l).toLowerCase().replace('_', '-');
    const match = activeLang
      ? voices.some((v) => norm(v.lang).startsWith(`${activeLang.toLowerCase()}-`)) || voices.some((v) => norm(v.lang) === activeLang.toLowerCase())
      : true;
    note.textContent = match
      ? 'a browser voice is available for this language'
      : 'no browser voice for this language yet - add a system voice, or use audio items';
  };
  if ('speechSynthesis' in window) {
    describeVoices();
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener('voiceschanged', describeVoices, { once: true });
    setTimeout(describeVoices, 400);
  } else {
    describeVoices();
  }

  // Listen & read: open the reader with playback started.
  container.querySelectorAll('[data-listen]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        sessionStorage.setItem('linguarium.autolisten', '1');
      } catch { /* ignore */ }
      navigate(`#/read/${a.dataset.kind}/${a.dataset.listen}`);
    });
  });

  container.querySelector('#btn-add-audio')?.addEventListener('click', openAddAudio);

  return () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  };
}

async function openAddAudio() {
  const s = getState();
  const langOptions = (s.languages ?? [])
    .map((l) => `<option value="${esc(l.code)}" ${l.code === s.activeLanguage ? 'selected' : ''}>${esc(l.name)}</option>`)
    .join('');

  const bodyHtml = `
    <form id="add-audio-form" class="stack">
      <label>Title <input id="a-title" required maxlength="300" placeholder="e.g. News clip 2026-03-01"></label>
      <label>Language <select id="a-language">${langOptions}</select></label>
      <label>Audio URL (direct https link)
        <input id="a-audio" type="url" required maxlength="1000" placeholder="https://…/recording.mp3">
      </label>
      <label>Transcript
        <textarea id="a-body" rows="7" required placeholder="The full transcript - it becomes an interactive reader."></textarea>
      </label>
      <details class="source-details" open>
        <summary>Source and license <span class="muted small">(required - the audio keeps its attribution)</span></summary>
        <label>Author / original creator <input id="a-author" maxlength="300" placeholder="e.g. recording by…"></label>
        <label>Source URL <input id="a-source" type="url" maxlength="1000" placeholder="https://… (page the audio came from)"></label>
        <label>License <input id="a-license" maxlength="80" placeholder="e.g. CC BY 4.0, public-domain"></label>
      </details>
      <p class="muted small">The recording is referenced by its URL and never copied into the database - you assert the licensing by adding it.</p>
    </form>`;

  const m = modal({
    title: 'Add an audio item',
    bodyHtml,
    actionsHtml: `<button class="btn subtle" data-close>Cancel</button><button class="btn primary" id="a-save">Add item</button>`,
  });

  m.el.querySelector('[data-close]').addEventListener('click', m.close);
  m.el.querySelector('#a-save').addEventListener('click', async () => {
    const g = (id) => m.el.querySelector(`#${id}`)?.value?.trim();
    const audio = g('a-audio');
    const body = m.el.querySelector('#a-body').value;
    if (!g('a-title') || !body) {
      toast('A title and the transcript are required.', 'warn');
      return;
    }
    if (!audio || !/^https:\/\//.test(audio)) {
      toast('The audio URL must be a direct https link.', 'warn');
      return;
    }
    try {
      const { text } = await api('/api/texts', {
        method: 'POST',
        body: {
          language_code: g('a-language'),
          title: g('a-title'),
          body,
          audio_url: audio,
          author: g('a-author') || null,
          source_url: g('a-source') || null,
          license: g('a-license') || 'unspecified',
        },
      });
      await loadTexts();
      m.close();
      toast('Audio item added - its transcript is an interactive reader.', 'pos');
      navigate(`#/read/user/${text.id}`);
    } catch (err) {
      toast(err.message ?? 'Could not save the audio item.', 'neg');
    }
  });
}
