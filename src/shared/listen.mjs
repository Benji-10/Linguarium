/**
 * Shared listening engine (phase 2).
 *
 * Two honest sources of audio, both keeping the same knowledge state:
 *
 *   1. Audio referenced by URL (handled inline in the reader with a plain
 *      <audio> element): the file is never stored in the database as a
 *      binary blob, and its source/license metadata stays attached to the
 *      text it belongs to.
 *   2. Browser speech synthesis for texts that have no recording: labelled
 *      as machine-synthesized, not a native recording. Availability depends
 *      on the voices installed on the user's system, and is reported
 *      honestly - nothing is faked.
 *
 * The bar plays sentence by sentence, follows the sentence in the
 * transcript, and stops advancing when the page is left.
 */

/** Preferred voice regions per language code (BCP-47 suffixes). */
const LANGUAGE_REGIONS = {
  ko: ['KR'], zh: ['CN', 'TW', 'HK'], ja: ['JP'], en: ['US', 'GB', 'AU'],
  fr: ['FR', 'CA'], es: ['ES', 'MX', 'AR'], de: ['DE', 'AT', 'CH'],
  ru: ['RU'], it: ['IT'], pt: ['PT', 'BR'], el: ['GR'], nl: ['NL'],
  sv: ['SE'], da: ['DK'], nb: ['NO'], fi: ['FI'], pl: ['PL'], cs: ['CZ'],
  sk: ['SK'], hu: ['HU'], ro: ['RO'], bg: ['BG'], uk: ['UA'], tr: ['TR'],
  eo: [], la: [], tok: [],
};

/**
 * Wire the listen bar of a reader to speech synthesis.
 * Returns { play, pause, isPlaying, destroy }.
 */
export function attachListenBar({ container, language, langLabel }) {
  const bar = container.querySelector('#listen-bar');
  const playBtn = container.querySelector('#listen-play');
  const prevBtn = container.querySelector('#listen-prev');
  const nextBtn = container.querySelector('#listen-next');
  const noteEl = container.querySelector('#listen-note');

  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  let voice = null;
  let playing = false;
  let index = 0;

  const sentences = () => [...container.querySelectorAll('#reader-body .sent')];

  function pickVoice() {
    if (!synth) return null;
    const voices = synth.getVoices();
    if (!voices.length) return null;
    const norm = (l) => String(l).toLowerCase().replace('_', '-');
    for (const region of LANGUAGE_REGIONS[language] ?? []) {
      const exact = voices.find((v) => norm(v.lang) === `${language.toLowerCase()}-${region.toLowerCase()}`);
      if (exact) return exact;
    }
    const prefix = `${language.toLowerCase()}-`;
    return (
      voices.find((v) => norm(v.lang).startsWith(prefix)) ||
      voices.find((v) => norm(v.lang) === language.toLowerCase()) ||
      null
    );
  }

  function refreshVoices() {
    voice = pickVoice();
    updateBar();
  }

  function updateBar() {
    if (!bar) return;
    if (!synth) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    const total = sentences().length;
    if (!voice) {
      playBtn.disabled = true;
      noteEl.textContent = `No installed speech voice for ${langLabel ?? language} yet - browser-synthesized reading needs a system voice (add one in your OS settings). Everything else works.`;
    } else {
      playBtn.disabled = false;
      noteEl.textContent = playing
        ? `Playing sentence ${index + 1} of ${total} - browser voice, not a recording.`
        : total
          ? `${total} sentence${total === 1 ? '' : 's'} - browser voice, not a recording.`
          : '';
    }
    playBtn.innerHTML = playBtn.innerHTML.replace(/(Listen|Pause)/, playing ? 'Pause' : 'Listen');
  }

  function highlight(i) {
    const sents = sentences();
    container.querySelectorAll('.sent.listening').forEach((el) => el.classList.remove('listening'));
    const el = sents[Math.max(0, Math.min(i, sents.length - 1))];
    if (el) {
      el.classList.add('listening');
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  function speakCurrent() {
    const sents = sentences();
    if (!playing || index >= sents.length) {
      playing = false;
      updateBar();
      return;
    }
    const el = sents[index];
    const text = (el?.textContent ?? '').trim();
    highlight(index);
    if (!text) {
      index += 1;
      speakCurrent();
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = language;
    }
    u.rate = 0.95;
    u.onend = () => {
      if (!playing) return;
      index += 1;
      speakCurrent();
    };
    u.onerror = () => {
      playing = false;
      updateBar();
    };
    synth.speak(u);
    updateBar();
  }

  function play() {
    if (!synth || !voice) return;
    if (playing) return;
    if (index >= sentences().length) index = 0;
    playing = true;
    speakCurrent();
  }

  function pause() {
    playing = false;
    if (synth) synth.cancel();
    const sents = sentences();
    if (index >= sents.length) index = Math.max(0, sents.length - 1);
    updateBar();
  }

  function step(delta) {
    const sents = sentences();
    if (!sents.length) return;
    const wasPlaying = playing;
    if (synth) synth.cancel();
    playing = false;
    index = Math.max(0, Math.min(index + delta, sents.length - 1));
    highlight(index);
    if (wasPlaying) {
      playing = true;
      speakCurrent();
    } else {
      updateBar();
    }
  }

  playBtn?.addEventListener('click', () => (playing ? pause() : play()));
  prevBtn?.addEventListener('click', () => step(-1));
  nextBtn?.addEventListener('click', () => step(1));

  let voicesHandler = null;
  if (synth) {
    voicesHandler = () => refreshVoices();
    window.speechSynthesis.addEventListener('voiceschanged', voicesHandler);
    refreshVoices();
    // Some browsers populate the voice list only after a tick.
    setTimeout(refreshVoices, 350);
  }

  return {
    play,
    pause,
    isPlaying: () => playing,
    destroy() {
      playing = false;
      if (synth) synth.cancel();
      if (voicesHandler) window.speechSynthesis.removeEventListener('voiceschanged', voicesHandler);
    },
  };
}
