/**
 * Writing practice (phase 2).
 *
 * An honest placeholder: this area is planned but not implemented yet.
 * See docs/ROADMAP.md for the design: prompt generation tied to your
 * vocabulary state, free-text writing, and self-assessment feeding the
 * production dimension of FSRS.
 */

import { icon } from '../ui/components.mjs';

export async function renderPractice(container) {
  container.innerHTML = `
    <section class="page-head"><div><h1>${icon('pencil')}Writing practice</h1>
    <p class="muted">Planned for phase 2 - this is an honest placeholder, not a broken screen.</p></div></section>
    <section class="panel phase-panel">
      <span class="phase-mark">${icon('pencil')}</span>
      <h2>Coming in phase 2</h2>
      <p class="muted">The plan, straight from the roadmap:</p>
      <ul class="feature-list">
        <li>${icon('pencil').toString()}Writing prompts built from the words and structures you are actually learning.</li>
        <li>${icon('review').toString()}Free-text answers you self-assess, feeding the <strong>production</strong> dimension of your FSRS state.</li>
        <li>${icon('flash').toString()}Optional AI feedback, clearly labelled as unverified AI analysis.</li>
      </ul>
      <p class="muted small">Meanwhile, production practice already works inside <a href="#/review?dimension=production">Review &gt; Production</a>: you type the term from its meaning.</p>
    </section>`;
  return () => {};
}
