/**
 * Grammar progression save (shared by the Grammar view's stage buttons,
 * grammar exercises and writing practice).
 *
 * Online: PUT /api/grammar. Offline: queued as a 'grammarStage' op that the
 * sync flush replays - so grammar progression survives offline sessions
 * instead of being dropped.
 */

export async function saveGrammarStage(structureId, stage) {
  const { getState } = await import('../core/store.mjs');
  const { api } = await import('../core/api.mjs');
  const { enqueue } = await import('../core/idb.mjs');
  try {
    if (getState().online) {
      await api('/api/grammar', { method: 'PUT', body: { structure_id: structureId, stage } });
    } else {
      throw new Error('offline');
    }
  } catch {
    await enqueue({ type: 'grammarStage', payload: { structure_id: structureId, stage } });
  }
}

/** Index of a stage in the progression (unknown stages count as encountered). */
export function stageIndex(stage, GRAMMAR_STAGES) {
  const i = GRAMMAR_STAGES.indexOf(stage);
  return i < 0 ? 0 : i;
}
