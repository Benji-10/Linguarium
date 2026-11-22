/**
 * Status derivation for vocabulary entries and collection items.
 *
 * A status reflects demonstrated performance, never "the card was opened":
 *
 *   unencountered     no reviews and no recorded encounters
 *   learning          reviewed, but below the recognition threshold
 *   recognized         recognition stability >= 7 days
 *   reliably_recalled recall stability >= 7 days
 *   mastered          production stability >= 15 days over >= 3 reps, or
 *                     both recall and recognition stability >= 30 days
 *   due               any dimension is due for review (overlay)
 */

import { ENTRY_STATUSES, STATUS_THRESHOLDS } from './constants.mjs';
import { isDue } from './fsrs.mjs';

const T = STATUS_THRESHOLDS;

/**
 * @param {object|null} entry vocabulary entry (or null)
 * @param {object} memories map dimension -> memory state ({stability, reps, lapses, due, ...})
 * @param {object} opts { encountered: boolean, now: number }
 * @returns {{status: string, tier: string, dueDimensions: string[], detail: string}}
 */
export function deriveStatus(entry, memories = {}, opts = {}) {
  const { encountered = false, now = Date.now() } = opts;
  const dims = Object.keys(memories).filter((d) => memories[d] && memories[d].reps > 0);

  const dueDimensions = dims.filter((d) => isDue(memories[d], now));

  if (dims.length === 0) {
    return {
      status: encountered ? 'learning' : 'unencountered',
      tier: encountered ? 'learning' : 'unencountered',
      dueDimensions,
      detail: encountered ? 'Seen in reading, not yet reviewed.' : 'No activity yet.',
    };
  }

  const recognition = memories.recognition;
  const recall = memories.recall;
  const production = memories.production;

  let tier = 'learning';
  let detail = 'Reviewed, still below the recognition threshold.';

  if (production && production.stability >= T.masteredStability && production.reps >= T.masteredReps) {
    tier = 'mastered';
    detail = 'Actively produced across multiple sessions.';
  } else if (
    recall &&
    recognition &&
    recall.stability >= T.passiveMasteryStability &&
    recognition.stability >= T.passiveMasteryStability
  ) {
    tier = 'mastered';
    detail = 'Long stable in both recognition and recall.';
  } else if (recall && recall.stability >= T.recalledStability) {
    tier = 'reliably_recalled';
    detail = 'Recall stability above threshold.';
  } else if (recognition && recognition.stability >= T.recognizedStability) {
    tier = 'recognized';
    detail = 'Recognition stability above threshold.';
  }

  const status = dueDimensions.length > 0 ? 'due' : tier;
  return { status, tier, dueDimensions, detail };
}

/** Display label for a status. */
export function statusLabel(status) {
  return ENTRY_STATUSES[status]?.label ?? status;
}

/**
 * Progression across dimensions, used by the entry detail panel.
 * Returns which thresholds each dimension currently clears.
 */
export function dimensionProgress(memory) {
  if (!memory || memory.reps === 0) return { started: false };
  return {
    started: true,
    stability: memory.stability,
    difficulty: memory.difficulty,
    reps: memory.reps,
    lapses: memory.lapses,
    recognized: memory.stability >= T.recognizedStability,
    recalled: memory.stability >= T.recalledStability,
    mastered: memory.stability >= T.masteredStability && memory.reps >= T.masteredReps,
  };
}
