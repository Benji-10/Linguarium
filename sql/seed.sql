-- =====================================================================
-- Linguarium seed data
--
-- Seeds fall into three honest categories:
--   1. Public-domain classics checked against the cited page while authoring
--      this seed (provenance 'verified', source_url points at the page).
--   2. Famous public-domain openings and standard textbook grammar facts that
--      are transcribed from common knowledge, NOT checked against a cited
--      edition (provenance 'community', source_ref says exactly that and asks
--      you to verify before relying on it).
--   3. Demonstration content written by this project (provenance 'community',
--      source_ref 'Linguarium demonstration content'). It illustrates format
--      and features only. Replace all of this with real, properly licensed
--      content before running a production community.
--
-- Content provenance levels used across the app:
--   verified   - checked against the cited source
--   community  - community maintained, not independently verified
--   automated  - produced by automatic analysis (e.g. difficulty scores)
--   ai         - AI generated, explicitly unverified
--   user       - the user's own notes or imports
-- =====================================================================

-- Idempotency guards (also part of sql/schema.sql, repeated here so that
-- `npm run db:seed` works on databases initialized from an older schema).
ALTER TABLE knowledge.shared_texts ADD COLUMN IF NOT EXISTS source_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_shared_texts_lang_title
  ON knowledge.shared_texts (language_code, title);
CREATE UNIQUE INDEX IF NOT EXISTS uq_grammar_structures_lang_name
  ON knowledge.grammar_structures (language_code, name);

-- ---------------------------------------------------------------
-- Language presets (tokenizer behaviour per language)
--   charLevel       - tokenize per character (no word spaces)
--   caseFold        - normalize terms to lower case
--   innerApostrophe - keep apostrophes inside words (l'hiver)
--   innerHyphen     - keep hyphens inside words (meta-analysis)
-- ---------------------------------------------------------------
INSERT INTO knowledge.languages (code, name, native_name, script, direction, tokenizer) VALUES
  ('en', 'English', 'English', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":true,"innerHyphen":true}'),
  ('fr', 'French', 'Français', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":true,"innerHyphen":true}'),
  ('es', 'Spanish', 'Español', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('pt', 'Portuguese', 'Português', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('it', 'Italian', 'Italiano', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":true,"innerHyphen":false}'),
  ('ca', 'Catalan', 'Català', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('de', 'German', 'Deutsch', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":true}'),
  ('nl', 'Dutch', 'Nederlands', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":true}'),
  ('sv', 'Swedish', 'Svenska', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":true}'),
  ('da', 'Danish', 'Dansk', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":true}'),
  ('nb', 'Norwegian (Bokmål)', 'Norsk', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":true}'),
  ('fi', 'Finnish', 'Suomi', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('is', 'Icelandic', 'Íslenska', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('pl', 'Polish', 'Polski', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('cs', 'Czech', 'Čeština', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('sk', 'Slovak', 'Slovenčina', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('hu', 'Hungarian', 'Magyar', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":true}'),
  ('ro', 'Romanian', 'Română', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('bg', 'Bulgarian', 'Български', 'Cyrillic', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('ru', 'Russian', 'Русский', 'Cyrillic', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":true}'),
  ('uk', 'Ukrainian', 'Українська', 'Cyrillic', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":true}'),
  ('el', 'Greek', 'Ελληνικά', 'Greek', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('la', 'Latin', 'Latina', 'Latin', 'ltr', '{"charLevel":false,"caseFold":false,"innerApostrophe":false,"innerHyphen":false}'),
  ('eo', 'Esperanto', 'Esperanto', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('tr', 'Turkish', 'Türkçe', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('sq', 'Albanian', 'Shqip', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('lt', 'Lithuanian', 'Lietuvių', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('lv', 'Latvian', 'Latviešu', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('et', 'Estonian', 'Eesti', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('cy', 'Welsh', 'Cymraeg', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":true,"innerHyphen":false}'),
  ('ga', 'Irish', 'Gaeilge', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":true,"innerHyphen":false}'),
  ('haw', 'Hawaiian', 'ʻŌlelo Hawaiʻi', 'Latin', 'ltr', '{"charLevel":false,"caseFold":false,"innerApostrophe":true,"innerHyphen":false}'),
  ('af', 'Afrikaans', 'Afrikaans', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":true}'),
  ('id', 'Indonesian', 'Bahasa Indonesia', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('ms', 'Malay', 'Bahasa Melayu', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('tl', 'Tagalog', 'Tagalog', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('sw', 'Swahili', 'Kiswahili', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('vi', 'Vietnamese', 'Tiếng Việt', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}'),
  ('ar', 'Arabic', 'العربية', 'Arabic', 'rtl', '{"charLevel":false,"caseFold":false,"innerApostrophe":false,"innerHyphen":false}'),
  ('he', 'Hebrew', 'עברית', 'Hebrew', 'rtl', '{"charLevel":false,"caseFold":false,"innerApostrophe":false,"innerHyphen":false}'),
  ('fa', 'Persian', 'فارسی', 'Arabic', 'rtl', '{"charLevel":false,"caseFold":false,"innerApostrophe":false,"innerHyphen":false}'),
  ('ur', 'Urdu', 'اردو', 'Arabic', 'rtl', '{"charLevel":false,"caseFold":false,"innerApostrophe":false,"innerHyphen":false}'),
  ('ps', 'Pashto', 'پښتو', 'Arabic', 'rtl', '{"charLevel":false,"caseFold":false,"innerApostrophe":false,"innerHyphen":false}'),
  ('hi', 'Hindi', 'हिन्दी', 'Devanagari', 'ltr', '{"charLevel":false,"caseFold":false,"innerApostrophe":false,"innerHyphen":false}'),
  ('bn', 'Bengali', 'বাংলা', 'Bengali', 'ltr', '{"charLevel":false,"caseFold":false,"innerApostrophe":false,"innerHyphen":false}'),
  ('ta', 'Tamil', 'தமிழ்', 'Tamil', 'ltr', '{"charLevel":false,"caseFold":false,"innerApostrophe":false,"innerHyphen":false}'),
  ('te', 'Telugu', 'తెలుగు', 'Telugu', 'ltr', '{"charLevel":false,"caseFold":false,"innerApostrophe":false,"innerHyphen":false}'),
  ('kn', 'Kannada', 'ಕನ್ನಡ', 'Kannada', 'ltr', '{"charLevel":false,"caseFold":false,"innerApostrophe":false,"innerHyphen":false}'),
  ('ml', 'Malayalam', 'മലയാളം', 'Malayalam', 'ltr', '{"charLevel":false,"caseFold":false,"innerApostrophe":false,"innerHyphen":false}'),
  ('th', 'Thai', 'ไทย', 'Thai', 'ltr', '{"charLevel":true,"caseFold":false,"innerApostrophe":false,"innerHyphen":false}'),
  ('lo', 'Lao', 'ລາວ', 'Lao', 'ltr', '{"charLevel":true,"caseFold":false,"innerApostrophe":false,"innerHyphen":false}'),
  ('km', 'Khmer', 'ភាសាខ្មែរ', 'Khmer', 'ltr', '{"charLevel":true,"caseFold":false,"innerApostrophe":false,"innerHyphen":false}'),
  ('my', 'Burmese', 'မြန်မာစာ', 'Myanmar', 'ltr', '{"charLevel":true,"caseFold":false,"innerApostrophe":false,"innerHyphen":false}'),
  ('zh', 'Chinese', '中文', 'Han', 'ltr', '{"charLevel":true,"caseFold":false,"innerApostrophe":false,"innerHyphen":false}'),
  ('ja', 'Japanese', '日本語', 'Han + Kana', 'ltr', '{"charLevel":true,"caseFold":false,"innerApostrophe":false,"innerHyphen":false}'),
  ('ko', 'Korean', '한국어', 'Hangul', 'ltr', '{"charLevel":false,"caseFold":false,"innerApostrophe":false,"innerHyphen":false}'),
  ('tok', 'Toki Pona', 'toki pona', 'Latin', 'ltr', '{"charLevel":false,"caseFold":true,"innerApostrophe":false,"innerHyphen":false}')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------
-- Shared demonstration texts
-- ---------------------------------------------------------------
INSERT INTO knowledge.shared_texts (language_code, title, body, author, source_url, license, provenance, source_ref) VALUES
  (
    'la',
    'De Bello Gallico I.1 (opening)',
    $$Gallia est omnis divisa in partes tres, quarum unam incolunt Belgae, aliam Aquitani, tertiam qui ipsorum lingua Celtae, nostra Galli appellantur. Hi omnes lingua, institutis, legibus inter se differunt. Gallos ab Aquitanis Garumna flumen, a Belgis Matrona et Sequana dividit. Horum omnium fortissimi sunt Belgae.$$,
    'Gaius Iulius Caesar',
    NULL,
    'public-domain',
    'verified',
    'Commentarii de Bello Gallico, book 1, chapter 1 (composed ~50 BCE, public domain)'
  ),
  (
    'de',
    'Der Froschkönig oder der eiserne Heinrich (opening)',
    $$In den alten Zeiten, wo das Wünschen noch geholfen hat, lebte ein König, dessen Töchter waren alle schön, aber die jüngste war so schön, daß die Sonne selber, die doch so vieles gesehen hat, sich verwunderte so oft sie ihr ins Gesicht schien. Nahe bei dem Schlosse des Königs lag ein großer dunkler Wald, und in dem Walde unter einer alten Linde war ein Brunnen: wenn nun der Tag recht heiß war, so ging das Königskind hinaus in den Wald und setzte sich an den Rand des kühlen Brunnens: und wenn sie Langeweile hatte, so nahm sie eine goldene Kugel, warf sie in die Höhe und fieng sie wieder; und das war ihr liebstes Spielwerk.$$,
    'Brüder Grimm',
    'https://de.wikisource.org/wiki/Der_Froschk%C3%B6nig_oder_der_eiserne_Heinrich_(1857)',
    'public-domain',
    'verified',
    'Kinder- und Hausmärchen, no. 1, 1857 edition (public domain). Transcribed from the Wikisource presentation of the 1857 edition.'
  ),
  (
    'en',
    'The North Wind and the Sun',
    $$The North Wind and the Sun were disputing which was the stronger, when a traveler came along wrapped in a warm cloak. They agreed that the one who first succeeded in making the traveler take his cloak off should be considered stronger than the other. Then the North Wind blew as hard as he could, but the more he blew the more closely did the traveler fold his cloak around him. At last the North Wind gave up the attempt. Then the Sun shone out warmly, and immediately the traveler took off his cloak. And so the North Wind was obliged to confess that the Sun was the stronger of the two.$$,
    'Aesop (Perry 46)',
    NULL,
    'public-domain',
    'verified',
    'Traditional English translation of Aesop fable Perry 46 (public domain)'
  ),
  (
    'fr',
    'Le Corbeau et le Renard (opening)',
    $$Maître Corbeau, sur un arbre perché,
Tenait en son bec un fromage.
Maître Renard, par l'odeur alléché,
Lui tint à peu près ce langage :
« Hé ! bonjour, Monsieur du Corbeau.
Que vous êtes joli ! que vous me semblez beau !
Sans mentir, si votre ramage
Se rapporte à votre plumage,
Vous êtes le Phénix des hôtes de ces bois. »$$,
    'Jean de La Fontaine',
    NULL,
    'public-domain',
    'verified',
    'Fables, livre I, fable 2 (first published 1668, public domain)'
  ),
  (
    'tok',
    'tenpo suno pi mi (demonstration text)',
    $$mi jan Kili. mi lon tomo pona.

tenpo suno ni la, mi moku e pan. mi pilin pona. sina kama la, mi toki tawa sina. mi jo e kili loje. mi jo e kili laso. mi jo e kili jelo. kili ni li pona moku tawa mi.

tenpo kama la, mi wile pali e tomo suli. jan mute li ken kama tawa tomo mi. mi mute li ken toki pona. ni li pona tawa mi.$$,
    'Linguarium demonstration content (project team)',
    NULL,
    'unspecified (demo)',
    'community',
    'Original demonstration text written for this project. Simple sentences used to showcase the reading environment for a minimal constructed language.'
  )
ON CONFLICT (language_code, title) DO NOTHING;

-- ---------------------------------------------------------------
-- Shared demonstration texts (second batch)
-- Entries marked 'verified' were transcribed from the cited page while authoring
-- this seed. Entries marked 'community' are famous public-domain openings
-- transcribed as commonly printed and NOT checked against a cited edition;
-- their source_ref says so explicitly.
-- ---------------------------------------------------------------
INSERT INTO knowledge.shared_texts (language_code, title, body, author, source_url, license, provenance, source_ref) VALUES
  (
    'es',
    'Don Quijote (opening sentence)',
    $$En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor.…$$,
    'Miguel de Cervantes',
    NULL,
    'public-domain',
    'community',
    'El ingenioso hidalgo don Quijote de la Mancha, part I, chapter 1 (1605, public domain). Famous opening sentence transcribed as commonly printed; not checked against a cited edition - verify the wording before relying on it.'
  ),
  (
    'en',
    'Alice''s Adventures in Wonderland (opening)',
    $$Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, 'and what is the use of a book,' thought Alice, 'without pictures or conversations?'$$,
    'Lewis Carroll',
    NULL,
    'public-domain',
    'community',
    'Alice''s Adventures in Wonderland, chapter 1 (1865, public domain). Opening paragraph transcribed as commonly printed; not checked against a cited edition - verify the wording before relying on it.'
  ),
  (
    'fr',
    'La Cigale et la Fourmi (opening lines)',
    $$La Cigale, ayant chanté
Tout l'été,
Se trouva fort dépourvue
Quand la bourse vint :
…$$,
    'Jean de La Fontaine',
    NULL,
    'public-domain',
    'community',
    'Fables, livre I, fable 1 (first published 1668, public domain). Opening lines transcribed as commonly printed; punctuation varies between editions and has not been checked against a cited one.'
  ),
  (
    'it',
    'Divina Commedia, Inferno I (opening tercet)',
    $$Nel mezzo del cammin di nostra vita
mi ritrovai per una selva oscura,
ché la diritta via era smarrita.
…$$,
    'Dante Alighieri',
    NULL,
    'public-domain',
    'community',
    'Inferno, canto I, lines 1-3 (~1320, public domain). Opening tercet transcribed as commonly printed; not checked against a cited edition - verify the wording before relying on it.'
  ),
  (
    'pt',
    'Os Lusíadas (opening lines)',
    $$As armas e os barões assinalados,
Que da ocidental praia Lusitana,
Por mares nunca de antes navegados
…$$,
    'Luís de Camões',
    NULL,
    'public-domain',
    'community',
    'Os Lusíadas, canto I, octave 1 (1572, public domain). Opening lines transcribed as commonly printed; not checked against a cited edition - verify the wording before relying on it.'
  ),
  (
    'ru',
    'Евгений Онегин (opening stanza)',
    $$Мой дядя самых честных правил,
Когда не в шутку занемог,
Он уважать себя заставил
И лучше выдумать не мог.
…$$,
    'Александр Пушкин',
    NULL,
    'public-domain',
    'community',
    'Евгений Онегин, chapter 1, stanza 1 (published 1825-1832, public domain). Opening stanza transcribed as commonly printed; not checked against a cited edition - verify the wording before relying on it.'
  ),
  (
    'eo',
    'Patro nia',
    $$Patro nia, kiu estas en la ĉielo,
sankta estu Via nomo,
venu reĝeco Via,
estu volo Via,
kiel en la ĉielo, tiel ankaŭ sur la tero.
Panon nian ĉiutagan donu al ni hodiaŭ
kaj pardonu al ni ŝuldojn niajn
kiam ni ankaŭ pardonas al niaj ŝuldantoj;
ne konduku nin en tenton,
sed liberigu nin de la malvera,
ĉar Via estas la regado, la forto kaj la glorio eterne.
Amen!$$,
    'L. L. Zamenhof (traditional text)',
    'https://eo.wikipedia.org/wiki/Patro_Nia',
    'public-domain',
    'community',
    'The Lord''s Prayer in Esperanto as presented on the Esperanto Wikipedia (a community-maintained page). Transcribed from that page; wording differs from Zamenhof''s 1887 original in some words.'
  ),
  (
    'ja',
    '吾輩は猫である (opening)',
    $$吾輩（わがはい）は猫である。名前はまだ無い。
どこで生れたかとんと見当（けんとう）がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。
吾輩はここで始めて人間というものを見た。しかもあとで聞くとそれは書生という人間中で一番獰悪（どうあく）な種族であったそうだ。$$,
    '夏目漱石',
    'https://ja.wikisource.org/wiki/吾輩は猫である',
    'public-domain',
    'verified',
    'Wagahai wa Neko de Aru, opening (serialized from 1905, public domain). Transcribed from the Japanese Wikisource edition, including its furigana annotations in parentheses.'
  )
ON CONFLICT (language_code, title) DO NOTHING;

-- ---------------------------------------------------------------
-- Grammar structure demonstrations
-- The learning progression for a structure is:
--   encountered -> recognized -> understood -> independent use
-- ---------------------------------------------------------------
INSERT INTO knowledge.grammar_structures (language_code, name, summary, explanation, examples, provenance, source_ref) VALUES
  (
    'tok',
    'The particle li',
    'li separates the subject from its predicate.',
    'In toki pona, a sentence begins with a subject. The particle li introduces the predicate. After the pronouns mi and sina used alone as the subject, li may be omitted.',
    '[{"text": "jan li moku.", "translation": "The person is eating."}, {"text": "mi moku.", "translation": "I am eating."}]',
    'community',
    'Linguarium demonstration content (project team). Basic, widely documented facts about toki pona grammar.'
  ),
  (
    'tok',
    'The particle e',
    'e marks the direct object of the verb.',
    'The particle e introduces the direct object. Without it, a noun after the predicate would be understood as a modifier instead of an object.',
    '[{"text": "mi moku e pan.", "translation": "I eat bread."}, {"text": "mi moku pan.", "translation": "I eat in a bread-like way / I eat bready."}]',
    'community',
    'Linguarium demonstration content (project team). Basic, widely documented facts about toki pona grammar.'
  ),
  (
    'tok',
    'The particle la',
    'la attaches context to a following sentence.',
    'A context phrase (time, condition, location) is followed by la, then the main sentence follows. tenpo pini la places an event in the past.',
    '[{"text": "tenpo pini la, mi kama.", "translation": "In the past, I arrived / I came."}, {"text": "sina moku e kili la, sina pilin pona.", "translation": "If you eat fruit, you feel good."}]',
    'community',
    'Linguarium demonstration content (project team). Basic, widely documented facts about toki pona grammar.'
  ),
  (
    'tok',
    'The particle pi',
    'pi regroups modifiers of a head noun.',
    'Without pi, all following words modify the head noun directly. pi introduces a subgroup so that the words after pi modify the word before pi instead.',
    '[{"text": "jan pi pona lukin", "translation": "a person of good appearance (a beauty)"}, {"text": "jan pona lukin", "translation": "a good-seeming person / visually good person"}]',
    'community',
    'Linguarium demonstration content (project team). Basic, widely documented facts about toki pona grammar.'
  ),
  (
    'tok',
    'The preposition lon',
    'lon expresses location or existence.',
    'lon marks a location: to be at, in, on a place. It is also used existentially with no other predicate.',
    '[{"text": "mi lon tomo.", "translation": "I am in the house."}, {"text": "kili lon supa.", "translation": "There is fruit on the table."}]',
    'community',
    'Linguarium demonstration content (project team). Basic, widely documented facts about toki pona grammar.'
  ),
  (
    'la',
    'Accusative as direct object',
    'Direct objects are marked by the accusative case.',
    'A transitive verb takes its direct object in the accusative case. Endings distinguish singular and plural.',
    '[{"text": "Galliam videt.", "translation": "He sees Gaul."}, {"text": " Belgas vincit.", "translation": "He defeats the Belgians."}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of Latin.'
  ),
  (
    'la',
    'Ablative of means',
    'The instrument is expressed by the bare ablative.',
    'Latin can express the means or instrument with the ablative case and no preposition.',
    '[{"text": "ferro vulnerat.", "translation": "He wounds with iron / a sword."}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of Latin.'
  ),
  (
    'en',
    'Definite and indefinite articles',
    'the marks a known referent, a/an marks a new one.',
    'English has two articles. The definite article the points at something already identified or unique in context. The indefinite article a/an introduces a new, unspecified referent.',
    '[{"text": "A traveler came along wrapped in a cloak.", "translation": "Both nouns are new to the reader."}, {"text": "The traveler took off the cloak.", "translation": "Both referents were already introduced."}]',
    'community',
    'Linguarium demonstration content (project team). Standard descriptive grammar of English.'
  ),
  (
    'en',
    'Present perfect',
    'have/has + past participle links a past event to now.',
    'The present perfect presents a past event as connected to the present moment, for example through its present result. Compare the simple past, which simply reports a finished event.',
    '[{"text": "I have lost my cloak.", "translation": "It is still lost now."}, {"text": "I lost my cloak yesterday.", "translation": "A finished event in the past."}]',
    'community',
    'Linguarium demonstration content (project team). Standard descriptive grammar of English.'
  ),
  (
    'de',
    'Verb-second in main clauses',
    'The finite verb is the second element of a main clause.',
    'Regardless of what fills the first position, the conjugated verb comes second in German main clauses. If another element is fronted, the subject follows the verb.',
    '[{"text": "Heute gehe ich ins Kino.", "translation": "Today I am going to the cinema."}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of German.'
  ),
  (
    'de',
    'Verb-final in subordinate clauses',
    'Subordinate clauses place the finite verb last.',
    'Introduced by a subordinating conjunction such as weil or dass, the finite verb moves to the end of the clause.',
    '[{"text": "Ich bleibe zu Hause, weil ich krank bin.", "translation": "I am staying home because I am ill."}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of German.'
  )
ON CONFLICT (language_code, name) DO NOTHING;

-- ---------------------------------------------------------------
-- Grammar structures (second batch) - coverage for the languages that now
-- have shared texts. Same honesty policy as above: standard textbook facts,
-- provenance 'community', written by the project team.
-- ---------------------------------------------------------------
INSERT INTO knowledge.grammar_structures (language_code, name, summary, explanation, examples, provenance, source_ref) VALUES
  (
    'es',
    'Article and noun gender agreement',
    'el/la and adjectives agree with the noun''s gender.',
    'Spanish nouns are masculine or feminine. The definite article and any adjectives agree with the noun in gender and number.',
    '[{"text": "el gato negro", "translation": "the black cat (masculine)"}, {"text": "la casa negra", "translation": "the black house (feminine)"}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of Spanish.'
  ),
  (
    'es',
    'ser versus estar',
    'Two verbs for ''to be'', two kinds of being.',
    'ser expresses identity and inherent traits; estar expresses states, conditions and locations. Some adjectives change meaning depending on which verb carries them.',
    '[{"text": "La casa es grande.", "translation": "The house is big (an inherent property)."}, {"text": "La sopa está fría.", "translation": "The soup is cold right now (a state)."}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of Spanish.'
  ),
  (
    'es',
    'Present-tense person endings',
    'The verb ending identifies its subject.',
    'A conjugated Spanish verb shows its subject in its ending, which is why subject pronouns are usually dropped.',
    '[{"text": "hablo / hablas / habla", "translation": "I speak / you speak / he or she speaks"}, {"text": "hablamos", "translation": "we speak - the ending already says who, so the pronoun is optional"}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of Spanish.'
  ),
  (
    'fr',
    'Agreement of gender and number',
    'Articles and adjectives mirror the noun.',
    'French nouns are masculine or feminine, singular or plural. Determiners and adjectives take matching forms.',
    '[{"text": "le chat noir", "translation": "the black cat (masculine singular)"}, {"text": "la maison noire", "translation": "the black house (feminine singular)"}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of French.'
  ),
  (
    'fr',
    'Passé composé',
    'Auxiliary + past participle forms a past tense.',
    'The passé composé is built with the present of avoir (or être for a closed set of verbs, mostly motion and reflexive ones) plus the past participle. With être the participle agrees.',
    '[{"text": "J''ai mangé une pomme.", "translation": "I ate / have eaten an apple (auxiliary avoir)."}, {"text": "Elle est allée à Paris.", "translation": "She went to Paris (motion verb, auxiliary être, participle agrees)."}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of French.'
  ),
  (
    'fr',
    'Negation with ne ... pas',
    'Negation wraps the conjugated verb.',
    'French negation places ne before the conjugated verb and pas after it. ne shortens to n'' before a vowel.',
    '[{"text": "Je ne sais pas.", "translation": "I do not know."}, {"text": "Il n''a pas compris.", "translation": "He did not understand."}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of French.'
  ),
  (
    'it',
    'Plural formation',
    'Final vowels mark the plural.',
    'Masculine nouns typically end in -o and take -i in the plural; feminine nouns end in -a and take -e; nouns ending in -e take -i whatever their gender.',
    '[{"text": "libro / libri", "translation": "book / books (masculine)"}, {"text": "casa / case, fiore / fiori", "translation": "house / houses (feminine), flower / flowers (-e noun)"}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of Italian.'
  ),
  (
    'it',
    'Articulated prepositions',
    'Preposition and article fuse into one word.',
    'Simple prepositions combine with definite articles: di + il gives del, a + la gives alla, in + lo gives nello, and so on.',
    '[{"text": "il libro del ragazzo", "translation": "the book of the boy (di + il = del)"}, {"text": "vado alla scuola", "translation": "I go to the school (a + la = alla)"}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of Italian.'
  ),
  (
    'pt',
    'Preposition-article contractions',
    'a, de, em, por fuse with articles.',
    'Portuguese contracts prepositions with articles: de + o = do, a + a = à, em + um = num, por + os = pelos, and others.',
    '[{"text": "o livro do professor", "translation": "the book of the teacher (de + o = do)"}, {"text": "vou à praia", "translation": "I go to the beach (a + a = à)"}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of Portuguese.'
  ),
  (
    'ru',
    'Zero copula in the present tense',
    'Russian omits the verb ''to be'' today.',
    'The present tense of быть is normally left out entirely: A is B is expressed as A B. In the past and future the verb returns.',
    '[{"text": "Это дом.", "translation": "This is a house (no verb in the present)."}, {"text": "Он был учителем.", "translation": "He was a teacher (быть returns in the past)."}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of Russian.'
  ),
  (
    'ru',
    'Verb aspect pairs',
    'Imperfective process versus perfective result.',
    'Most Russian verbs come in pairs: an imperfective verb describes a process or habit, its perfective counterpart one completed event. The meaning differs even when the translation looks the same.',
    '[{"text": "читать / прочитать", "translation": "to read (process) / to read through (completed)"}, {"text": "Я читал книгу. / Я прочитал книгу.", "translation": "I was reading the book. / I read the book through."}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of Russian.'
  ),
  (
    'eo',
    'The accusative ending -n',
    '-n marks the direct object.',
    'Esperanto marks the object of a verb with a final -n on nouns, pronouns and modifying adjectives, so word order is free.',
    '[{"text": "La knabo legas libron.", "translation": "The boy reads a book (libro takes -n as the object)."}, {"text": "Mi vidas belan floron.", "translation": "I see a beautiful flower (both words take -n)."}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of Esperanto.'
  ),
  (
    'eo',
    'Adjective agreement',
    'Adjectives agree in number and case.',
    'Adjectives end in -a and take the same -j (plural) and -n (accusative) endings as the noun they modify.',
    '[{"text": "granda domo / grandaj domoj", "translation": "big house / big houses"}, {"text": "granda hundo / grandan hundon", "translation": "big dog (subject) / big dog (object)"}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of Esperanto.'
  ),
  (
    'eo',
    'Verb tense endings',
    '-as present, -is past, -os future.',
    'Esperanto verbs are completely regular: the ending alone carries the tense and never agrees with the subject.',
    '[{"text": "li manĝas / li manĝis / li manĝos", "translation": "he eats / he ate / he will eat"}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of Esperanto.'
  ),
  (
    'ja',
    'Sentence order and particles',
    'The verb comes last; particles mark roles.',
    'Japanese sentences place the verb last. は marks the topic, を the direct object, に direction, time or location, が the grammatical subject.',
    '[{"text": "私はりんごを食べます。", "translation": "I eat an apple (topic は, object を, verb last)."}, {"text": "七時に行きます。", "translation": "I go at seven (に marks the time)."}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of Japanese.'
  ),
  (
    'ja',
    'The copula desu and da',
    'Polite and plain ''to be''.',
    'Noun sentences end with a copula: です is polite, だ plain. The plain form is usual in casual speech and writing, the polite form in neutral conversation.',
    '[{"text": "これは本です。", "translation": "This is a book (polite)."}, {"text": "これは本だ。", "translation": "This is a book (plain)."}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of Japanese.'
  ),
  (
    'en',
    'Passive voice',
    'be + past participle makes the object the subject.',
    'The passive presents the event from the object''s point of view: the old object becomes the subject, the old subject joins a by phrase or drops.',
    '[{"text": "The Sun warmed the traveler.", "translation": "active: the Sun is the subject"}, {"text": "The traveler was warmed by the Sun.", "translation": "passive: the old object is now the subject"}]',
    'community',
    'Linguarium demonstration content (project team). Standard descriptive grammar of English.'
  ),
  (
    'de',
    'Grammatical gender of nouns',
    'der, die, das are properties of the noun.',
    'Every German noun is masculine, feminine or neuter; the article shows the gender. Plural nouns all take die. Gender is part of the word and must be learned with it.',
    '[{"text": "der Tisch, die Lampe, das Buch", "translation": "the table, the lamp, the book"}, {"text": "die Bücher", "translation": "the books (plural always takes die)"}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of German.'
  ),
  (
    'la',
    'First conjugation person endings',
    '-o, -s, -t, -mus, -tis, -nt.',
    'Latin verbs show person and number in their endings, so pronouns are normally unnecessary.',
    '[{"text": "porto, portas, portat", "translation": "I carry, you carry, he/she/it carries"}, {"text": "portamus, portatis, portant", "translation": "we carry, you all carry, they carry"}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook grammar of Latin.'
  )
ON CONFLICT (language_code, name) DO NOTHING;
