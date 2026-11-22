/**
 * Dashboard: the state of your learning at a glance.
 * Includes an onboarding checklist until the account has real activity.
 */

import { icon, esc, emptyState, spinner } from '../ui/components.mjs';
import { getState } from '../core/store.mjs';
import { navigate } from '../core/router.mjs';
import { statusDistribution, dueSummary, computeStreak } from '../core/data.mjs';
import { ENTRY_STATUSES } from '../shared/constants.mjs';
import { fmtCount } from '../ui/components.mjs';

export async function renderDashboard(container) {
  const state = getState();
  container.innerHTML = `${spinner('Loading your dashboard')}`;

  const { progress, profiles, activeLanguage } = state;
  const streak = computeStreak(progress?.reviewDays ?? []);
  const due = dueSummary(progress, activeLanguage);
  const dist = await statusDistribution(activeLanguage);
  const reviewToday = (progress?.reviewDays ?? []).find((r) => String(r.day).slice(0, 10) === new Date().toISOString().slice(0, 10))?.count ?? 0;

  const hasProfiles = (profiles ?? []).length > 0;
  const hasEntries = dist.total > 0;
  const onboardingNeeded = !hasProfiles || !hasEntries || streak === 0;

  const greetingName = state.user?.name?.split(' ')[0] ?? 'there';

  container.innerHTML = `
    <section class="hero">
      <div>
        <h1>Good day, ${esc(greetingName)}</h1>
        <p class="muted">${
          activeLanguage
            ? `Practicing <strong>${esc(languageTitle(state, activeLanguage))}</strong> - ${esc(modeLabel(state, activeLanguage))} mode.`
            : 'Add a language profile to begin. Everything you do here stays connected to one shared knowledge state.'
        }</p>
      </div>
      <div class="hero-actions">
        <a class="btn primary" href="#/review">${icon('review')}Review${due.total > 0 ? ` <span class="count-pill">${due.total}</span>` : ''}</a>
        <a class="btn" href="#/reading">${icon('book')}Read</a>
      </div>
    </section>

    <section class="stat-grid">
      ${statCard('clock', 'Due now', fmtCount(due.total), due.total > 0 ? 'warn' : 'pos', due.total > 0 ? 'Review queue is ready' : 'Nothing overdue')}
      ${statCard('flash', 'Day streak', String(streak), streak >= 7 ? 'pos' : 'neutral', `${fmtCount(reviewToday)} reviewed today`)}
      ${statCard('globe', 'Known terms', fmtCount(dist.total), 'info', `${fmtCount(dist.counts.mastered ?? 0)} mastered`)}
      ${statCard('book', 'Texts', fmtCount(progress?.texts ?? 0), 'neutral', `${fmtCount(progress?.encounters ?? 0)} word encounters`)}
    </section>

    ${
      onboardingNeeded
        ? `<section class="panel onboarding">
            <h2>${icon('compass')}Start here</h2>
            <ol class="checklist">
              ${checkItem(hasProfiles, 'Add a language you are learning', '#/settings')}
              ${checkItem(hasEntries, 'Create or import a vocabulary collection', '#/collections')}
              ${checkItem((progress?.texts ?? 0) > 0, 'Add a text and read it, clicking new words', '#/reading')}
              ${checkItem(streak > 0, 'Complete your first review session', '#/review')}
            </ol>
          </section>`
        : ''
    }

    <section class="panel">
      <div class="panel-head"><h2>${icon('layers')}Knowledge state${activeLanguage ? ` - ${esc(languageTitle(state, activeLanguage))}` : ''}</h2>
        <span class="muted small">reflects real review performance</span></div>
      ${
        dist.total === 0
          ? emptyState({
              iconName: 'globe',
              title: 'No vocabulary yet',
              message: 'Import a word list or click words while reading - they will all appear here.',
              actionHtml: '<a class="btn" href="#/collections">Import a collection</a>',
            })
          : distributionHtml(dist.counts, dist.total)
      }
    </section>

    <section class="panel">
      <div class="panel-head"><h2>${icon('clock')}Review dimensions</h2>
        <span class="muted small">separate FSRS memory per ability</span></div>
      <div class="dim-grid">
        ${dimCard('recognition', due.recognition)}
        ${dimCard('recall', due.recall)}
        ${dimCard('production', due.production)}
      </div>
      <p class="muted small">Recognition: see the term, know the meaning. Recall: meaning to term. Production: actively produce it.</p>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>${icon('book')}Continue reading</h2><a class="btn subtle small" href="#/reading">All texts</a></div>
      ${readingListHtml(state)}
    </section>
  `;

  bindLinks(container);
  return () => {};
}

function bindLinks(container) {
  container.querySelectorAll('a[data-nav]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(a.dataset.nav);
    });
  });
}

function statCard(iconName, label, value, tone = 'neutral', sub = '') {
  return `<div class="stat-card ${tone}">
    <span class="stat-icon">${icon(iconName).toString()}</span>
    <div><div class="stat-value">${esc(value)}</div><div class="stat-label">${esc(label)}</div></div>
    <div class="stat-sub muted">${esc(sub)}</div>
  </div>`;
}

function dimCard(dim, dueCount) {
  const meta = {
    recognition: { label: 'Recognition', desc: 'See term, recall meaning' },
    recall: { label: 'Recall', desc: 'See meaning, recall term' },
    production: { label: 'Production', desc: 'Type the term from meaning' },
  }[dim];
  return `<a class="dim-card" href="#/review?dimension=${dim}">
    <div class="dim-head">${esc(meta.label)}<span class="count-pill ${dueCount > 0 ? 'warn-bg' : ''}">${dueCount}</span></div>
    <div class="muted small">${esc(meta.desc)}</div>
  </a>`;
}

function distributionHtml(counts, total) {
  const order = ['unencountered', 'learning', 'recognized', 'reliably_recalled', 'mastered', 'due'];
  const width = (n) => (total > 0 ? Math.max(1, Math.round((n / total) * 100)) : 0);
  const rows = order
    .map((k) => {
      const def = ENTRY_STATUSES[k];
      return `<div class="dist-row">
        <span class="badge ${def.tone}">${esc(def.label)}</span>
        <div class="dist-bar"><span class="${def.tone}" style="width:${width(counts[k] ?? 0)}%"></span></div>
        <span class="dist-num">${fmtCount(counts[k] ?? 0)}</span>
      </div>`;
    })
    .join('');
  return `<div class="dist-rows">${rows}</div>`;
}

function checkItem(done, text, hash) {
  return `<li class="${done ? 'done' : ''}">
    ${icon(done ? 'check' : 'clock').toString()}<span>${esc(text)}</span>
    ${done ? '' : `<a class="btn subtle small" href="${hash}">Do it</a>`}
  </li>`;
}

function readingListHtml(state) {
  const texts = (state.texts ?? []).slice(0, 3);
  if (texts.length === 0 && (state.sharedTexts ?? []).length === 0) {
    return emptyState({
      iconName: 'book',
      title: 'Nothing to read yet',
      message: 'Paste or upload a text, or pick one from the shared starter library.',
      actionHtml: '<a class="btn" href="#/reading">Add a text</a>',
    });
  }
  const rows = texts.map(
    (t) => `<a class="reading-row" href="#/read/user/${esc(t.id)}">
      <strong>${esc(t.title)}</strong>
      <span class="muted small">${esc(languageTitle(state, t.language_code))}${t.author ? ` - ${esc(t.author)}` : ''}</span>
    </a>`,
  );
  const shared = (state.sharedTexts ?? []).slice(0, 2).map(
    (t) => `<a class="reading-row shared" href="#/read/shared/${esc(t.id)}">
      <strong>${esc(t.title)}</strong>
      <span class="muted small">${esc(languageTitle(state, t.language_code))} - shared starter library</span>
    </a>`,
  );
  return `<div class="reading-rows">${rows.join('')}${shared.join('')}</div>`;
}

function languageTitle(state, code) {
  return state.languages.find((l) => l.code === code)?.name ?? code;
}

function modeLabel(state, code) {
  const profile = state.profiles.find((p) => p.language_code === code);
  return profile?.difficulty_mode ?? 'stretch';
}
