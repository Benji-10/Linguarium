# Content policy and provenance

## The three kinds of content

| Kind | Required metadata | Display |
| --- | --- | --- |
| **Real content** | author/creator, source URL where applicable, license | shown with the text, "verified" or "community" provenance badge |
| **Adapted content** | everything of the original, plus an adaptation note describing what changed | adaptation note shown under the title |
| **AI-generated content** | always labelled, verified where possible, marked unverifiable otherwise | "AI generated" badge wherever it appears |

The text import form enforces this: title/body plus a source section (author, source URL,
license, adaptation note). Everything a user adds is labelled "Imported by you" — they
assert the licensing themselves.

## Provenance levels (rendered as badges everywhere)

| Level | Meaning | Tone |
| --- | --- | --- |
| verified | checked against the cited source | green |
| community | community maintained, not independently verified | blue |
| automated | produced by automatic analysis (e.g. difficulty scores) | blue |
| ai | AI generated, explicitly unverified | warning |
| user / user-imported | your own notes or imports | neutral |

## Etymology rules (non-negotiable)

1. **Never invented.** No etymology is shown unless it comes from a source we can name
   (`source_ref` on entries, or the seed data's citations).
2. **AI may report etymology only when grounded.** The enrichment prompt requires
   attested etymology from established knowledge or an explicit "unknown" result;
   even then the output is labelled *AI-generated, unverified* and rendered with a
   warning badge, never merged into verified fields.
3. **Mnemonics are always separate.** AI may generate a memory aid, and the UI renders
   it under its own heading with the note "a memory aid — not the word's history".
4. **No reliable source means saying so.** The UI shows "No reliable etymology
   available" rather than a plausible-sounding story.

## Difficulty modes and estimation

The three modes (Comfortable / Stretch / Challenge) are **per-user preferences**, not
labels on material. Text difficulty is estimated per reader from:

- word familiarity — share of tokens in *your* known set;
- sentence length — mean tokens per sentence (syntactic load proxy);
- text length;
- subject familiarity — neutral until topic tagging exists.

The estimate is content with provenance "automated": the UI always offers a breakdown
("Why this estimate?") that explains each factor, states that it is not a CEFR label
and not a fact about the text. Frequency ranks and subject tags are accepted as optional
inputs (`src/shared/difficulty.mjs`) for the phase 2 content pipeline.

## Seed data honesty

`sql/seed.sql` contains only:

- public-domain classics with their sources named (Caesar, Grimm, Aesop/La Fontaine) —
  provenance *verified*;
- demonstration content written for this project (a short Toki Pona text, basic grammar
  structures for Toki Pona / Latin / English / German) — provenance *community*, with
  a note to replace it before running an open community.

Nothing in the seed pretends to be something it is not.

## Community contributions (phase 3)

The shared library grows through moderated contributions. The rules are the same as
the seed data's, enforced by validation and moderation:

1. **License is mandatory and must be real.** "Unspecified" is rejected at submission.
2. **Provenance must be traceable**: a text needs an author or a source URL; grammar
   and lexicon entries must cite where their content comes from.
3. **Nothing is auto-published.** Submissions wait in the moderation queue; an admin
   (`x-admin-key`, see README) approves or rejects with a note. Approved items enter
   the shared tables with provenance `community` — never `verified`.
4. **Invented etymology is a rejection reason** — same non-negotiable rule as above.
5. Rate-limited submissions (20/day) per user.

## The import pipeline (open sources)

The Reading page's "Import a text" center covers every import path of the platform
vision, all keyless and free, all in the **active language only** (one language at a
time — cross-language shelves are hidden, not shown mixed):

| Path | What happens | Provenance kept |
| --- | --- | --- |
| Paste | text + mandatory source section (author, URL, license, adaptation note) | user-imported, user asserts licensing |
| Upload `.txt` / `.html` / `.epub` | parsed in the browser (fflate for EPUB; ruby markup in HTML is preserved as annotations for the reader) | user-imported, user asserts licensing |
| URL | fetched server-side (SSRF-guarded, size-capped, redirect-capped), extracted to text, **previewed and confirmed by the user** before saving | user-imported, user asserts licensing |
| Aozora Bunko (Japanese) | curated shelf of 38 famous public-domain works, local search (instant, no upstream API to hang); the text is fetched from the official HTML edition (furigana preserved), then the aozorahack.org text mirror, then the official .zip — all decoded from Shift-JIS | author + Aozora card URL + per-work license attached automatically |
| Project Gutenberg | Gutendex browse/search → book text from the pglaf.org mirror first (gutenberg.org 503-throttles datacenter IPs), cap 200k chars cut at a sentence boundary with a note | author + book URL + public-domain license attached automatically |
| Wikisource / Wikipedia / Wikibooks / Wikinews / Wikivoyage | MediaWiki search → page text via `prop=extracts` (or parsed HTML fallback) | source URL, author ("Wikipedia contributors" etc.), license (CC BY-SA / CC BY 2.5 / per-work for Wikisource) attached automatically |
| News feeds | curated stable RSS (BBC, DW, Al Jazeera, ANSA, Le Monde, 20 Minutes, El País, N+1, Meduza, NHK, Hankyoreh) → items open through the URL path | article page is the licensing authority; user confirms metadata |
| AI generation | Gemini `gemini-3.1-flash-lite`, optional, personal (known/unknown term lists in the prompt), quota'd | provenance `ai` + generation note naming model, topic, band |

**Sources differ per language, and the import screen says so.** The provider
registry in `lib/sources.mjs` records which source actually serves which
language (probed live 2026-11: Gutendex per-language counts, the wikisource.org
portal edition list, the Wikimedia project lists):

- Japanese leads with **Aozora Bunko** — Gutenberg's ja shelf is 22 books and
  Japanese has a canonical free library of its own; the imported works carry
  their furigana as ruby annotations.
- Korean has no large keyless corpus (National Library of Korea and the
  Modu corpus need keys/applications): the wiki family — Wikisource,
  Wikipedia, Wikibooks, Wikinews — plus the 한겨레 (Hankyoreh) news feed are
  what honestly exists for it. There is no ko.wikivoyage.org (the portal
  lists no Korean edition), and the major Korean outlets (Yonhap, Chosun,
  SBS, Khan, News1) all refuse datacenter RSS — probed 2026-11.
- Chinese gets Wikisource zh (a large classical-text library) plus the wiki
  family and Wikivoyage zh; Gutenberg's 444 zh books and the BBC 中文 /
  Deutsche Welle news feeds are offered too.
- Russian gets the full wiki family, Wikivoyage ru, Gutenberg's ru shelf,
  and four news feeds (BBC Russian, DW Russian, N+1 science, Meduza).
- French and Spanish are the best-served: Gutenberg shelves, the wiki
  family, Wikivoyage, and multiple news feeds (Le Monde, 20 Minutes;
  BBC Mundo, DW Español, El País). France 24 and France Info RSS both
  403-refuse datacenter traffic, so they are deliberately absent.
- **Wikivoyage** (added 2026-11) serves every language with an edition
  (en, de, it, fr, es, ru, zh, pt, nl, pl, sv, fi, el, uk, he, ro, vi, bn,
  ps, shn, tr, cs, hi, eo, id, ja, fa): travel guides are ideal learner
  reading — concrete vocabulary, short sections, everyday register.
- Gutenberg is only offered where its catalogue actually has a shelf
  (en, fr, es, pt, it, ca, de, nl, sv, da, nb→no, fi, is, pl, cs, hu, ro,
  bg, ru, el, la, eo, cy, ga, af, tl, he, zh, ja): Gutendex *hangs* for
  minutes on languages with zero books instead of answering empty, so the
  server answers honestly ("no shelf for this language, try …") rather than
  stalling. Book cards show the catalogue's own shelves/subjects as the
  blurb (Gutendex carries no summaries — nothing is invented).
- The Gutendex calls fit the ~10 s function budget (2 attempts × 4 s), and
  a slow page serves the last successfully cached copy (stale beats
  error); a cold miss answers with a retry note instead of a 502.
- Norwegian (bokmål, `nb`) wiki editions live on the `no.` subdomain — the
  MW URL builders remap it; Wikipedia itself really is `nb.wikipedia.org`.
- Wikinews and Wikibooks editions are offered only for the languages that
  have them; `tok` (Toki Pona) has a Wikisource but no Wikipedia (closed
  2005).
- Custom languages get a **Library edition** (Settings → custom language,
  2026-11): the wiki code the open sources should read when the language's
  own code is not a wiki edition ("srs" reading `simple`). It is defined
  once — at creation or later on the profile row — and the catalog, the
  imports and the library tab all use it; a code typed in the library tab
  is saved back so it is only ever typed once.

Long Gutenberg books are never silently truncated: the cut is at a sentence boundary at
the 200,000-character cap and the text's note says exactly that. Gutendex answers are
memo-cached for 10 minutes per function instance (it rate-limits bursts); gutenberg.org
is only reached through the pglaf.org mirror because gutenberg.org 503-refuses
datacenter traffic.

The catalog and URL fetchers live in `netlify/functions/lib/sources.mjs` (pure mappers
unit-tested offline) and every server-side fetch passes the SSRF guard (no private
hosts, no odd ports, no credentials, redirect cap, size cap, timeout).

## Word lookup: the dictionary chain

Looking a word up (reader word panel, Knowledge) follows the honest source order:

1. **shared lexicon** (local database, instant, offline, community provenance);
2. **online dictionaries** — jisho.org/JMdict for *every* Japanese term (it
   de-inflects: clicking 食べました finds 食べる; no per-word special cases
   exist anywhere in the chain), Wiktionary for every language (three routes,
   because the direct ones 403 datacenter traffic), plus dictionaryapi.dev
   for English (keyless, free, cached server-side in `knowledge.lookup_cache`
   and client-side in IndexedDB);
3. **AI analysis** (Gemini) — the explicit, user-triggered fallback, never called
   silently, always labelled unverified.

Every entry carries its source and license: Wiktionary content is CC BY-SA 4.0 and is
attributed by linking the entry page.

## Ruby (furigana / pinyin)

Inline parenthetical readings (`吾輩（わがはい）`, `汉字(hànzì)`) — common in
public-domain editions — are **parsed out of the text** (so the text length and
screen readers are not distorted by readings-as-sentence-content) and rendered as real
`<ruby>`/`<rt>` markup above the words. A per-language Furigana/Pinyin toggle hides or
shows the readings; the parsed annotation form is never rendered inline. Words the
learner's vocabulary already carries readings for get vocabulary ruby too. The
base-covering heuristic for readings that span only part of a Han run is an
approximation (proportional reading length) and is documented as such in
`src/shared/ruby.mjs`.

## Segmentation for no-space scripts

Japanese and Chinese are segmented into **words** by three layers
(`src/shared/tokenizer.mjs`):

1. **the browser's own word segmenter** (`Intl.Segmenter`, ICU dictionary) —
   real word units (澱粉) even for words the learner does not know yet;
2. **greedy longest-match over the learner's dictionary** (shared lexicon,
   own vocabulary, this text's ruby bases) — your words always win, so
   segmentation improves as your vocabulary grows;
3. **Japanese inflection merging** (`src/shared/flection.mjs`, added 2026-11): a
   Kanji head plus its okurigana plus a conjugated ending become ONE clickable
   token (眠っている, 食べている, 高くなかった) whenever the dictionary confirms
   the base word — the compact school-grammar tables are data, not a
   statistical model, and nothing merges without dictionary confirmation
   (猫 + は never becomes 猫は).

Environments without `Intl.Segmenter` fall back to the previous dictionary /
kana-run / per-character behaviour plus the inflection merge. The honest label
stands: this is dictionary matching plus auditable grammar tables — **not a
morphological analyzer**; unknown kanji stay single tokens and exact
multi-word terms are what text selection lookup is for.

Furigana follows the same grammar awareness in all three of its sources:
texts that annotate the dictionary form before an inflected ending
(眠（ねむる）っている) are adjusted to the stem (ねむ), vocabulary readings
derive the inflected surface reading (眠る → ねむる lights 眠っている as
ねむっている, never ねむる stamped over the whole word), and dictionary
lookups store their readings under the entry's own headword. The irregular
来る is deliberately skipped — its stem reading (き/こ) cannot be derived
from the dictionary form, and no furigana is better than wrong furigana.

## Extended language resources (phase 3)

`knowledge.resources` is a catalog of *links* — open frequency lists, pronunciation
references, learner corpora, dictionaries — each with license metadata and a
"verify at the source" note. The data itself is never copied into the deployment,
and the catalog deliberately covers under-resourced languages (Toki Pona included)
alongside the big ones. It is community-maintained content: `community` provenance,
never `verified`.
