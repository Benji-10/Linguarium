/**
 * Listening environment (phase 2).
 *
 * An honest placeholder. See docs/ROADMAP.md: audio is referenced by URL
 * and license, never stored in the main database as binary blobs; transcripts
 * open in the reading environment so one knowledge state serves both.
 */

import { icon } from '../ui/components.mjs';

export async function renderListening(container) {
  container.innerHTML = `
    <section class="page-head"><div><h1>${icon('headphones')}Listening</h1>
    <p class="muted">Planned for phase 2 - this is an honest placeholder, not a broken screen.</p></div></section>
    <section class="panel phase-panel">
      <span class="phase-mark">${icon('headphones')}</span>
      <h2>Coming in phase 2</h2>
      <p class="muted">The plan, straight from the roadmap:</p>
      <ul class="feature-list">
        <li>${icon('headphones').toString()}Audio referenced by URL with source and license metadata - never stored as binary blobs in the database.</li>
        <li>${icon('book').toString()}Transcripts open in the same interactive reader, so one knowledge state serves listening and reading.</li>
        <li>${icon('review').toString()}Term click-through during listening records encounters, exactly like reading.</li>
      </ul>
    </section>`;
  return () => {};
}
