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
