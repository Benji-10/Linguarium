/**
 * Text difficulty estimation.
 *
 * Difficulty is estimated from the reader's own knowledge state, NOT from a
 * CEFR label on the material. The estimate combines:
 *
 *   familiarity   share of word tokens already in the user's known set
 *   syntax        mean sentence length (proxy for syntactic load)
 *   length        total token count (endurance / session load)
 *   subject       optional topic familiarity, defaults to a neutral value
 *
 * The result is a band for THIS reader:
 *   comfortable / stretch / challenge
 * plus a full breakdown shown in the UI, because the estimate itself is
 * content with provenance 'automated' and must be transparent, not magic.
 *
 * Frequency data and subject tags are optional inputs: the function accepts
 * them when the shared knowledge base has data (phase 2 content pipeline)
 * and works without them (subjectFamiliarity falls back to neutral).
 */

import { tokenize, normalizeTerm, splitSentences } from './tokenizer.mjs';

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * @param {object} params
 * @param {string} params.text
 * @param {object} params.tokenizer language tokenizer config
 * @param {Set<string>} [params.dictionary] segmentation dictionary for no-space
 *   scripts (same dictionary the reader displays) so the estimate matches the
 *   tokens the learner actually sees
 * @param {Set<string>} params.knownSet normalized terms the user knows
 * @param {Map<string, number>} [params.frequencyRanks] optional term -> rank
 *   (lower rank = more common). Missing ranks count as mid-frequency.
 * @param {number} [params.subjectFamiliarity] optional 0..1
 * @returns {object} difficulty report
 */
export function scoreText({ text, tokenizer, knownSet, dictionary = null, frequencyRanks = null, subjectFamiliarity = null }) {
  const tokens = tokenize(text, tokenizer, dictionary);
  const sentences = splitSentences(text);

  let known = 0;
  let knownCommon = 0;
  let unknownTotal = 0;
  let unknownCommon = 0; // unknown terms that are highly frequent (surprising gaps)

  const unknownTerms = new Map(); // normalized -> count

  for (const tok of tokens) {
    const norm = normalizeTerm(tok.text, tokenizer);
    if (knownSet.has(norm)) {
      known += 1;
      if (frequencyRanks && frequencyRanks.has(norm) && frequencyRanks.get(norm) <= 5000) knownCommon += 1;
    } else {
      unknownTotal += 1;
      unknownTerms.set(norm, (unknownTerms.get(norm) ?? 0) + 1);
      if (frequencyRanks && frequencyRanks.has(norm) && frequencyRanks.get(norm) <= 5000) unknownCommon += 1;
    }
  }

  const total = tokens.length || 1;
  const familiarity = clamp01(known / total);

  const meanSentenceLength =
    sentences.length > 0 ? sentences.reduce((acc, s) => acc + tokenize(s, tokenizer, dictionary).length, 0) / sentences.length : 0;
  const syntax = clamp01(meanSentenceLength / 25); // 25+ tokens/sentence -> max score

  const lengthScore = clamp01(tokens.length / 8000);

  const subject = subjectFamiliarity == null ? 0.5 : clamp01(subjectFamiliarity);

  const composite =
    0.45 * familiarity + 0.25 * (1 - syntax) + 0.15 * (1 - lengthScore) + 0.15 * subject;

  let band;
  if (familiarity >= 0.97 && syntax <= 0.6 && tokens.length <= 3000) {
    band = 'comfortable';
  } else if (familiarity < 0.9 || syntax >= 0.8 || tokens.length > 8000) {
    band = 'challenge';
  } else {
    band = 'stretch';
  }

  const topUnknown = [...unknownTerms.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([term, count]) => ({ term, count }));

  return {
    provenance: 'automated',
    band,
    composite: Math.round(composite * 100) / 100,
    familiarity: Math.round(familiarity * 1000) / 1000,
    syntax: Math.round(syntax * 1000) / 1000,
    syntaxMeanSentenceLength: Math.round(meanSentenceLength * 10) / 10,
    length: tokens.length,
    lengthScore: Math.round(lengthScore * 1000) / 1000,
    subject: Math.round(subject * 100) / 100,
    unknownCount: unknownTotal,
    topUnknown,
    breakdown: [
      {
        label: 'Word familiarity',
        value: Math.round(familiarity * 100),
        unit: '%',
        detail: `${known} of ${total} tokens are already in your known set.`,
      },
      {
        label: 'Sentence length',
        value: Math.round(meanSentenceLength * 10) / 10,
        unit: 'words avg',
        detail: 'Longer sentences carry more syntactic load for a learner.',
      },
      {
        label: 'Text length',
        value: tokens.length,
        unit: 'words',
        detail: `${sentences.length} sentences.`,
      },
      {
        label: 'Subject familiarity',
        value: Math.round(subject * 100),
        unit: '%',
        detail: 'Topic familiarity estimate. Neutral default until you tag topics.',
      },
    ],
  };
}

/** Does a band match the user's chosen difficulty mode? */
export function bandMatchesMode(band, mode) {
  return band === mode;
}
