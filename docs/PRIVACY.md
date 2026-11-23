# Privacy

## What is stored

Only what is needed to run the learning experience, in **your own Neon database**:

- account identity (the Netlify Identity user id, a display name);
- language profiles and preferences (difficulty mode, gloss language);
- vocabulary entries and your notes;
- FSRS memory states and the review log (your own learning history);
- collections and their items;
- texts you added, with the source metadata you entered;
- reading positions and word encounters;
- grammar progression;
- a per-user daily counter for AI enrichment quota.

## What is never collected

- No third-party trackers, no analytics scripts, no font CDNs, no ad tech — anywhere.
  The app loads exactly zero third-party client-side resources.
- No device fingerprinting, no session recording, no A/B infrastructure.
- The AI provider, when enabled, receives **one term and a language name** per
  enrichment request — never your texts, history, or any identifier beyond that.
  (See docs/AI.md for the quota and cache rules.)

## Where data lives

- Application data: your Neon PostgreSQL project (connection string held server-side
  as a Netlify environment variable).
- Local device: IndexedDB offline cache + change queue (clearable in Settings), and
  the active-language/theme preferences in localStorage. No cookies beyond the
  Netlify Identity session cookie (`nf_jwt`).

## Your controls

- **Export**: full portable JSON backup at any time (Settings → Your data).
- **Delete learning data**: purges every `user_data` row for your account; the login
  remains, empty.
- **Delete account**: purges data **and** deletes the Netlify Identity account.
- Both deletions require typing DELETE to confirm and only touch your own rows
  (the function resolves the caller from the verified session).

## Data lifecycle

- Soft-deleted entries/texts are tombstoned (sync-safe) and excluded everywhere.
- Review history is kept until account deletion; the backup export includes it so
  nothing is lost when you leave.

## Phase 3 additions to the statement

- **Text adaptation** (optional AI): when you adapt a text, the model receives that
  single text plus two short term lists derived from it. It never receives any other
  user data; the result is stored as your own (adapted) text.
- **FSRS fitting**: runs server-side on your own review log, in your own database;
  the fitted parameters are stored with it and travel in your export. Nothing is
  shared with anyone.
- **Contributions**: your submission references your account id so you can see its
  moderation status; the shared tables that everyone reads never contain user ids.
  Nothing about you is published.
- The theme/skin and fitted-parameter preferences live in localStorage (UI
  preferences only, no learning data).
