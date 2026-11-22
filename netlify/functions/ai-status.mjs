/**
 * GET /api/ai-status - is AI enrichment available?
 *
 * AI is optional by design: without GEMINI_API_KEY every core feature still
 * works. The client uses this endpoint to show AI sections as explicitly
 * disabled (with an explanation), never as broken.
 */

import { handler, json } from './lib/http.mjs';
import { requireUser } from './lib/identity.mjs';
import { readDailyQuota } from './lib/ratelimit.mjs';

export const GEMINI_MODEL = 'gemini-3.1-flash-lite';

export default handler({
  GET: async (req) => {
    const user = await requireUser();
    const available = Boolean(process.env.GEMINI_API_KEY);
    const dailyLimit = Number(process.env.GEMINI_DAILY_LIMIT) || 300;
    let usedToday = 0;
    if (available) {
      usedToday = await readDailyQuota(user.id, 'enrich');
    }
    return json({ available, model: GEMINI_MODEL, daily_limit: dailyLimit, used_today: usedToday });
  },
});

export const config = { path: '/api/ai-status' };
