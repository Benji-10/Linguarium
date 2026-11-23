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
ALTER TABLE user_data.language_profiles ADD COLUMN IF NOT EXISTS level TEXT;
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

-- ================================================================
-- Phase 2 content batch: a richer library and grammar coverage.
--
-- Fixes reported after phase 1:
--   * the library was thin (one short text per language) — this batch
--     adds longer and more varied material, including SIX Korean texts
--     (previously Korean had none at all).
--   * topic tags (new column) so Discover can filter by subject.
--
-- Labelling rules stay the same as the earlier batches:
--   'verified'  - transcribed from the cited work, high confidence.
--   'community' - demonstration content by the project team, or
--                 classic public-domain openings transcribed from
--                 memory as commonly printed (NOT checked against a
--                 critical edition - the source_ref says so).
-- ================================================================

-- Migration for databases created before the rate_limits fix: "window" is a
-- reserved keyword in PostgreSQL, so the original CREATE TABLE failed on Neon.
-- Rename it if a table with the old column somehow exists.
DO $$
BEGIN
  ALTER TABLE user_data.rate_limits RENAME COLUMN "window" TO window_day;
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL;
END $$;

ALTER TABLE knowledge.shared_texts ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE user_data.texts ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE user_data.texts ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Topic tags for the phase-1 texts (idempotent re-runs).
UPDATE knowledge.shared_texts SET topic = 'classic' WHERE title LIKE 'De Bello%';
UPDATE knowledge.shared_texts SET topic = 'classic' WHERE title LIKE 'Der Froschk%';
UPDATE knowledge.shared_texts SET topic = 'fable'  WHERE title LIKE 'The North Wind%';
UPDATE knowledge.shared_texts SET topic = 'classic' WHERE title LIKE 'Le Corbeau%';
UPDATE knowledge.shared_texts SET topic = 'classic' WHERE title LIKE 'La Cigale%';
UPDATE knowledge.shared_texts SET topic = 'classic' WHERE title LIKE 'Don Quijote%';
UPDATE knowledge.shared_texts SET topic = 'classic' WHERE title LIKE 'Divina Commedia%';
UPDATE knowledge.shared_texts SET topic = 'classic' WHERE title LIKE 'Os Lus%';
UPDATE knowledge.shared_texts SET topic = 'classic' WHERE title LIKE '%Онегин%';
UPDATE knowledge.shared_texts SET topic = 'poem'    WHERE language_code = 'eo';
UPDATE knowledge.shared_texts SET topic = 'classic' WHERE title LIKE '%吾輩%';
UPDATE knowledge.shared_texts SET topic = 'story'   WHERE language_code = 'tok' AND title LIKE 'tenpo%';
UPDATE knowledge.shared_texts SET topic = 'classic' WHERE title LIKE 'Alice%';

INSERT INTO knowledge.shared_texts (language_code, title, body, author, source_url, license, provenance, source_ref, topic) VALUES
  (
    'ko',
    '일요일 (a Sunday diary)',
    $$일요일 아침에 나는 늦게 일어났습니다. 창밖에 새가 노래를 했습니다. 나는 세수를 하고, 아침을 먹었습니다. 그리고 커피를 한 잔 마셨습니다. 책상에 앉아서 책을 읽었습니다. 책이 재미있어서 시간이 빨리 지났습니다.
    점심쯤에 친구에게 전화를 걸었습니다. 우리는 같이 산책하기로 했습니다. 공원에 사람이 많았습니다. 날씨가 좋았기 때문입니다. 나무 아래에 앉아서 이야기를 나누었습니다. 친구는 요즘 새로운 일을 시작했다고 했습니다. 나는 친구가 자랑스러웠습니다.
    저녁에는 집에 돌아와서 국수를 끓여 먹었습니다. 그리고 조용히 음악을 들었습니다. 오늘은 평화로운 하루였습니다. 내일은 다시 일찍 일어나야 합니다. 그래서 일찍 잠들었습니다.$$,
    'Linguarium demonstration content (project team)',
    NULL,
    'unspecified (demo)',
    'community',
    'Original demonstration text written for this project. Everyday vocabulary, polite -습니다 style, past-tense narration.',
    'daily-life'
  ),
  (
    'ko',
    '시장에서 (at the market)',
    $$점심 준비를 하다가 우유가 떨어졌습니다. 엄마가 말했습니다. "우유 한 병과 빵 두 개를 사 와 주겠니?"
    나는 시장으로 갔습니다. 시장에는 사람이 많았습니다. 가게 아주머니가 친절하게 물었습니다. "무엇을 드릴까요?" 나는 대답했습니다. "우유 한 병하고 빵 두 개 주세요."
    아주머니는 봉지에 우유와 빵을 담아 주셨습니다. "모두 사천 원이에요." 나는 돈을 내고 고개를 숙여 인사했습니다. "감사합니다. 안녕히 계세요."
    돌아오는 길에 붕어빵 냄새가 참 좋았습니다. 하지만 참았습니다. 집에 와서 엄마에게 물건을 드렸더니, 엄마는 기뻐하셨습니다.$$,
    'Linguarium demonstration content (project team)',
    NULL,
    'unspecified (demo)',
    'community',
    'Original demonstration text written for this project. Simple dialogue with shopping vocabulary and prices.',
    'dialogue'
  ),
  (
    'ko',
    '고양이와 달 (the cat and the moon)',
    $$옛날에 마을에 작은 고양이 한 마리가 살았습니다. 고양이는 밤마다 지붕에 올라가서 달을 보았습니다. 달은 둥글고 밝았습니다.
    어느 날 밤, 고양이는 생각했습니다. "저 달을 만져 보고 싶다." 그래서 고양이는 높은 산으로 달을 따라 올라갔습니다. 산꼭대기에 도착했지만, 달은 여전히 멀리 있었습니다. 고양이는 다리가 아파서 주저앉았습니다.
    그때 아래에 연못이 보였습니다. 연못 안에도 달이 있었습니다. 고양이는 기뻐서 연못으로 달려갔습니다. 그러나 발이 물에 닿는 순간, 달은 사라졌습니다. 고양이는 젖은 발을 보면서 한숨을 쉬었습니다.
    그날 밤, 고양이는 다시 지붕 위에 앉았습니다. 머리 위에 달이 떠 있었습니다. 달은 어제처럼 아름다웠습니다. 고양이는 조용히 웃었습니다. "달은 구경하는 것만으로 충분하다."
    그 후로 고양이는 매일 밤 지붕에서 달을 구경했습니다.$$,
    'Linguarium demonstration content (project team)',
    NULL,
    'unspecified (demo)',
    'community',
    'Original demonstration fable-style story written for this project. Simple narrative past tense with common everyday verbs.',
    'story'
  ),
  (
    'ko',
    '친구에게 보내는 편지 (a letter to a friend)',
    $$민수에게,

    안녕? 오랜만이야. 잘 지내고 있어? 나는 요즘 좀 한가로워.
    아침마다 뒷산에 올라가. 요즘 산에 벚꽃이 피었어. 정말 예뻐. 사진을 창피하게 못 찍어서 미안하지만, 직접 보면 놀랄 거야.
    지난주에는 할머니 댁에 다녀왔어. 할머니가 김치찌개를 끓여 주셨는데, 아직도 그 맛이 생각나. 할머니는 늘 건강하시대.
    너도 언제 한번 우리 집에 와. 같이 밥 먹고 이야기하자. 요즘 좋아하는 노래가 있으면 알려 줘. 나도 재미있는 책을 하나 소개해 줄게.
    답장 기다릴게. 몸 조심하고, 공부도 적당히 하길.

    지수가.$$,
    'Linguarium demonstration content (project team)',
    NULL,
    'unspecified (demo)',
    'community',
    'Original demonstration letter written for this project. Casual -요 style between friends with common letter conventions.',
    'letter'
  ),
  (
    'ko',
    '한국의 사계절 (the four seasons of Korea)',
    $$한국에는 뚜렷한 사계절이 있다.
    봄에는 꽃이 핀다. 벚꽃이 길을 하얗게 물들인다. 사람들은 공원으로 나가서 꽃구경을 하고 사진을 찍는다.
    여름은 덥고 습하다. 사람들은 삼계탕을 먹으면서 더위를 이긴다. 바다나 계곡으로 휴가를 떠나는 사람도 많다. 저녁에는 시원한 냉면이 인기다.
    가을은 하늘이 높고 선선하다. 단풍이 산을 붉게 물들인다. 주말마다 등산객이 산으로 몰린다. 농촌에서는 추수가 한창이다. 갓 딴 사과와 배가 시장에 나온다.
    겨울은 춥고 눈이 자주 온다. 아이들은 눈사람을 만들고 눈싸움을 한다. 어른들은 뜨거운 팥죽이나 군고구마로 몸을 데운다.
    이렇게 계절마다 풍경과 음식과 놀이가 다르다. 그래서 한국 사람들은 계절의 변화를 생활과 문화 속에서 느낀다.$$,
    'Linguarium demonstration content (project team)',
    NULL,
    'unspecified (demo)',
    'community',
    'Original demonstration text written for this project. Plain expository -다 style with season and food vocabulary.',
    'culture'
  ),
  (
    'ko',
    '첫 눈 (the first snow)',
    $$어제 밤에 첫눈이 왔습니다. 아침에 일어나서 창밖을 보니, 세상이 하얗게 변해 있었습니다. 지붕과 길과 나무 위에 눈이 쌓였습니다.
    나는 따뜻한 옷을 입고 밖으로 나갔습니다. 공기가 차고 상쾌했습니다. 아이들이 밖에 나와서 눈싸움을 하고 있었습니다. 어떤 아이는 커다란 눈사람을 만들고 있었습니다. 나도 눈을 한 줌 집어서 하늘로 던졌습니다. 눈송이가 얼굴에 닿았을 때, 어린 시절이 갑자기 떠올랐습니다. 그때도 친구들과 함께 눈덩이를 굴렸습니다.
    집에 들어와서 뜨거운 차를 한 잔 마셨습니다. 창밖에는 눈이 아직도 조용히 내리고 있었습니다. 겨울이 왔다는 생각에 마음이 이상하게 들떴습니다. 내일은 일찍 일어나서 눈길을 걸어 보고 싶습니다.$$,
    'Linguarium demonstration content (project team)',
    NULL,
    'unspecified (demo)',
    'community',
    'Original demonstration text written for this project. Past-tense narration with weather and feeling vocabulary.',
    'daily-life'
  ),
  (
    'zh',
    '我的一天 (my day)',
    $$早上七点，闹钟响了。我起床、洗脸、刷牙。妈妈已经做好了早饭。我吃了包子和豆浆，觉得很舒服。
    上午我有两节课：数学和语文。数学有点难，但是老师讲得很清楚。中午我和同学一起去食堂吃饭。米饭、青菜，还有一个鸡蛋。
    下午没有课。我在图书馆看了一会儿书，然后去操场打了半小时篮球。晚上吃完饭，我帮妈妈洗了碗，然后写作业。
    十点半，我上床睡觉。今天是普通但是舒服的一天。$$,
    'Linguarium demonstration content (project team)',
    NULL,
    'unspecified (demo)',
    'community',
    'Original demonstration text written for this project. High-frequency daily vocabulary, simple sentence patterns.',
    'daily-life'
  ),
  (
    'zh',
    '静夜思 (quiet night thoughts)',
    $$床前明月光，疑是地上霜。
举头望明月，低头思故乡。$$,
    '李白 (Li Bai)',
    NULL,
    'public-domain',
    'verified',
    'Tang-dynasty quatrain by Li Bai (701-762), universally printed standard text. Public domain.',
    'poem'
  ),
  (
    'zh',
    '狐假虎威 (opening)',
    $$虎求百兽而食之，得狐。狐曰：“子无敢食我也！天帝使我长百兽，今子食我，是逆天帝命也。子以我为不信，吾为子先行，子随我后，观百兽之见我而敢不走乎？”……$$,
    '《战国策》 (traditional)',
    NULL,
    'public-domain',
    'community',
    'Classical Chinese fable (Zhanguo ce), traditional text, public domain. Transcribed as commonly printed; not checked against a critical edition. Classical register - challenge material.',
    'fable'
  ),
  (
    'el',
    'Ο καιρός σήμερα (the weather today)',
    $$Σήμερα το πρωί έβρεξε πολύ. Ο ουρανός ήταν γκρι και τα πουλιά δεν τραγουδούσαν. Πήρα την ομπρέλα μου και πήγα στη δουλειά με τα πόδια.
    Το απόγευμα ο ήλιος βγήκε ξαφνικά και ο ουρανός έγινε γαλάζιος. Το πάρκο κοντά στο σπίτι μου γέμισε κόσμο. Πήρα έναν καφέ και κάθισα σε ένα παγκάκι. Δύο παιδιά έπαιζαν μπάλα. Μια γυναίκα διάβαζε βιβλίο κάτω από ένα δέντρο.
    Το βράδυ φύσηξε λίγο άνεμος και έκανε δροσιά. Αύριο λένε ότι θα έχει ήλιο. Ελπίζω να πάω για περπάτημα στη θάλασσα.$$,
    'Linguarium demonstration content (project team)',
    NULL,
    'unspecified (demo)',
    'community',
    'Original demonstration text written for this project. Everyday Modern Greek with weather vocabulary.',
    'daily-life'
  ),
  (
    'de',
    'Rotkäppchen (opening)',
    $$Es war einmal ein süßes kleines Mädchen; es hatte jedermann gern, der es ansah, am liebsten aber seine Großmutter, die wußte nicht, was sie alles für das Kind gab. Einmal schenkte sie ihm ein Käppchen von rotem Samt, und weil ihm das so wohl stand und es sonst nichts mehr trug, hieß es nur das Rotkäppchen.$$,
    'Brüder Grimm',
    NULL,
    'public-domain',
    'community',
    'Kinder- und Hausmärchen no. 26, 1857 edition (public domain). Transcribed from memory as commonly printed; not checked against a critical edition.',
    'classic'
  ),
  (
    'de',
    'Hänsel und Gretel (opening)',
    $$Vor einem großen Walde wohnte ein armer Holzhacker mit seiner Frau und seinen zwei Kindern; das Knäblein hieß Hänsel und das Mädchen Gretel. Es hatte wenig zu essen, und einmal, als große Teuerung ins Land kam, konnte er das tägliche Brot nicht mehr schaffen.$$,
    'Brüder Grimm',
    NULL,
    'public-domain',
    'community',
    'Kinder- und Hausmärchen no. 15, 1857 edition (public domain). Transcribed from memory as commonly printed; not checked against a critical edition.',
    'classic'
  ),
  (
    'fr',
    'Il pleure dans mon cœur (opening stanzas)',
    $$Il pleure dans mon cœur
Comme il pleut sur la ville ;
Quelle est cette langueur
Qui pénètre mon cœur ?

Ô bruit doux de la pluie
Par terre et sur les toits !
Pour un cœur qui s'ennuie,
Ô le chant de la pluie !$$,
    'Paul Verlaine',
    NULL,
    'public-domain',
    'community',
    'Romances sans paroles, 1874 (public domain). Transcribed from memory as commonly printed; not checked against a critical edition.',
    'poem'
  ),
  (
    'la',
    'Lupus et agnus (opening)',
    $$Lupus et agnus, siti compulsi, ad rivum eundem venerant. Superior stabat lupus, longeque inferior agnus. Tunc fautor fraudis, provocandi studio, quaesivit causam iurgii.$$,
    'Phaedrus (traditional)',
    NULL,
    'public-domain',
    'community',
    'Fabulae Aesopiae I.1 (Phaedrus, 1st century CE, public domain). Transcribed from memory as commonly printed; not checked against a critical edition.',
    'fable'
  ),
  (
    'ru',
    'Зимнее утро (первая строфа)',
    $$Мороз и солнце; день чудесный!
Ещё ты дремлешь, друг прелестный —
Пора, красавица, проснись:
Открой сомкнуты негой взоры
Навстречу северной Авроры,
Звездою севера явись!$$,
    'А. С. Пушкин',
    NULL,
    'public-domain',
    'community',
    '1829 poem by Pushkin (public domain). Transcribed from memory as commonly printed; not checked against a critical edition.',
    'poem'
  ),
  (
    'ja',
    '坊っちゃん (opening)',
    $$親譲りの無鉄砲で小供の時から損ばかりしている。小学校に居る時分学校の二階から飛び降りて一週間ほど腰を抜かした事がある。なぜそんな無闇をしたと聞く人があるかも知れぬ。別段深い理由でもない。$$,
    '夏目漱石',
    NULL,
    'public-domain',
    'community',
    'Bocchan, 1906 novel by Natsume Soseki (public domain). Transcribed from memory as commonly printed; not checked against a critical edition.',
    'classic'
  ),
  (
    'en',
    'The Boy Who Cried Wolf',
    $$A shepherd boy was watching the village sheep near a dark forest. It was lonely, so he thought of a plan to get some company. He rushed toward the village crying out loudly, "Wolf! Wolf!"
    The villagers came running to help, but found no wolf. The boy laughed at them and they went back, annoyed. He tried the same trick again, and again the villagers ran up — and again there was no wolf.
    Then one evening a real wolf did spring from the underbrush and scattered the flock. The boy screamed, "Wolf! Wolf!" but this time the villagers thought he was lying again, and no one came. The wolf made a good meal of the sheep that night.$$,
    'Aesop (Perry 333, traditional English retelling)',
    NULL,
    'public-domain',
    'community',
    'Standard English retelling of Aesop fable Perry 333, as commonly printed for children. Not a cited edition.',
    'fable'
  ),
  (
    'es',
    'Un domingo en casa (a Sunday at home)',
    $$El domingo me levanté tarde. Hacía sol y el café olía muy bien. Después del desayuno ordené mi cuarto y escuché música.
    Al mediodía cociné arroz con pollo. No quedó mal, aunque la sal era poca. Mi hermana dijo que la próxima vez ella cocina y yo lavo los platos. Acordamos.
    Por la tarde leí un rato en el balcón y llamé a mi abuela. Siempre me pregunta lo mismo: ¿comiste bien? Sí, abuela, comí bien.
    Al anochecer salimos a caminar por el parque. Había familias, perros y vendedores de helado. Volvimos a casa cansados y contentos. Los domingos son así: lentos, simples y buenos.$$,
    'Linguarium demonstration content (project team)',
    NULL,
    'unspecified (demo)',
    'community',
    'Original demonstration text written for this project. Everyday Spanish with household and weekend vocabulary.',
    'daily-life'
  ),
  (
    'tok',
    'kala lili (the little fish)',
    $$tenpo pini la, jan wan li jo e kala lili tu. kala lili li lon poki telo. jan li moku e kala suli taso. kala lili li ken ala moku e jan. taso jan li moku ala e kala lili.
    jan li toki tawa kala: "mi awen e sina. sina kama suli la, mi moku e sina." tenpo suno mute li tawa. kala lili li kama suli.
    tenpo wan la, jan li kama tawa poki telo. kala li suli. jan li lukin e kala. jan li pilin: "kala ni li suli. mi wile moku e ona." taso tenpo mute la, kala li pona tawa jan. jan li pilin pona tawa kala kin.
    jan li moku ala e kala. jan li pana e moku tawa kala ale. kala ale li suli li pona. ni li pona tawa jan ale.$$,
    'Linguarium demonstration content (project team)',
    NULL,
    'unspecified (demo)',
    'community',
    'Original demonstration story written for this project using core vocabulary only.',
    'story'
  )
ON CONFLICT (language_code, title) DO NOTHING;

-- Korean grammar structures (previously Korean had none).
INSERT INTO knowledge.grammar_structures (language_code, name, summary, explanation, examples, provenance, source_ref) VALUES
  (
    'ko',
    'Topic particles 은/는',
    '은/는 mark what the sentence is about.',
    'Korean marks the topic of the sentence with 은 after a consonant and 는 after a vowel. The topic is often the thing already being talked about; it can be the subject or something else. Compare with 이/가, which mark the grammatical subject in neutral statements.',
    '[{"text": "저는 학생입니다.", "translation": "As for me, I am a student."}, {"text": "이 책은 재미있어요.", "translation": "This book (as for it) is interesting."}]',
    'community',
    'Linguarium demonstration content (project team). Basic, widely documented facts about Korean grammar.'
  ),
  (
    'ko',
    'Subject particles 이/가',
    '이/가 mark the grammatical subject.',
    'The subject particle is 이 after a consonant and 가 after a vowel. In neutral news-like sentences the subject takes 이/가; when the noun is the shared topic of conversation it takes 은/는 instead. Both particles are often dropped in casual speech when the role is clear.',
    '[{"text": "비가 와요.", "translation": "Rain is coming. (It is raining.)"}, {"text": "제 이름은 지수입니다.", "translation": "My name is Jisoo. (topic 제 이름, no subject particle needed)"}]',
    'community',
    'Linguarium demonstration content (project team). Basic, widely documented facts about Korean grammar.'
  ),
  (
    'ko',
    'Object particle 을/를',
    '을/를 mark the direct object.',
    'The object particle is 을 after a consonant and 를 after a vowel: 책을, 커피를. It is often omitted in casual speech when the meaning is clear, but keeping it makes the sentence unambiguous — useful in writing.',
    '[{"text": "저는 책을 읽습니다.", "translation": "I read a book. (책 book + 을 object)"}, {"text": "커피를 마셨어요.", "translation": "(I) drank coffee. (커피 coffee + 를 object)"}]',
    'community',
    'Linguarium demonstration content (project team). Basic, widely documented facts about Korean grammar.'
  ),
  (
    'ko',
    'Formal polite endings -습니다/-ㅂ니다',
    'The formal polite style for statements.',
    'Statements in the formal polite style end in -습니다 after a verb stem ending in a consonant and -ㅂ니다 after a vowel: 먹습니다, 갑니다. Questions end in -습니까/-ㅂ니까. This is the style of news, announcements, presentations and polite service encounters.',
    '[{"text": "저는 아침에 커피를 마십니다.", "translation": "I drink coffee in the morning."}, {"text": "지금 갑니다.", "translation": "I am going now. (stem 가- + ㅂ니다)"}]',
    'community',
    'Linguarium demonstration content (project team). Basic, widely documented facts about Korean grammar.'
  ),
  (
    'ko',
    'Casual polite -요 style',
    'The everyday polite style.',
    'The -요 style is polite but friendly — the default for conversations with people you know but are not close to. Verb stems take -아요 after ㅏ/ㅗ vowels, -어요 otherwise, and 하다 becomes 해요: 가요, 먹어요, 해요.',
    '[{"text": "오늘 날씨가 좋아요.", "translation": "The weather is nice today. (좋다 + 아요)"}, {"text": "커피 마시고 싶어요.", "translation": "I want to drink coffee. (싶어요 casual polite)"}]',
    'community',
    'Linguarium demonstration content (project team). Basic, widely documented facts about Korean grammar.'
  ),
  (
    'ko',
    'Past tense -았/었-',
    'Verb stems take -았- or -었- for the past.',
    'For the past tense, insert -았- after stems with ㅏ/ㅗ vowels and -었- otherwise, then add a style ending: -습니다 (formal), -어요 (casual polite), or plain -다: 가았어요 contracts to 갔어요, 먹었어요, 갔습니다.',
    '[{"text": "친구에게 전화를 걸었습니다.", "translation": "I called my friend. (걸- + 었 + 습니다)"}, {"text": "어제 비가 왔어요.", "translation": "It rained yesterday. (와서 contracted: 오 + 았어요 → 왔어요)"}]',
    'community',
    'Linguarium demonstration content (project team). Basic, widely documented facts about Korean grammar.'
  ),
  (
    'ko',
    '-고 싶다 (want to)',
    'To want to do something.',
    'Attach -고 싶다 to a verb stem for "want to ...": 먹고 싶다, 가고 싶다. It conjugates like an adjective: 싶어요, 싶었습니다. For third-person subjects use -고 싶어하다.',
    '[{"text": "저는 한국에 가고 싶습니다.", "translation": "I want to go to Korea. (가- + 고 싶다)"}, {"text": "뭘 드시고 싶어요?", "translation": "What would you like to eat? (honorific 드시- + 고 싶어요)"}]',
    'community',
    'Linguarium demonstration content (project team). Basic, widely documented facts about Korean grammar.'
  ),
  (
    'ko',
    'Negation with 안 and 못',
    'Two words for "not": plain and cannot.',
    '안 before a verb negates plainly ("does not"); 못 means "cannot" — inability or impossibility. Long forms also exist with -지 않다 and -지 못하다. 안 가요 = I am not going; 못 가요 = I cannot go.',
    '[{"text": "저는 오늘 안 가요.", "translation": "I am not going today. (plain negation 안)"}, {"text": "다리가 아파서 못 걸어요.", "translation": "My leg hurts so I cannot walk. (inability 못)"}]',
    'community',
    'Linguarium demonstration content (project team). Basic, widely documented facts about Korean grammar.'
  )
ON CONFLICT (language_code, name) DO NOTHING;

-- Chinese grammar structures (previously Chinese had none).
INSERT INTO knowledge.grammar_structures (language_code, name, summary, explanation, examples, provenance, source_ref) VALUES
  (
    'zh',
    'The verbs 是, 有 and 在',
    'Three verbs that beginners often confuse.',
    '是 links two nouns (A is B). 有 expresses existence or possession (there is / to have). 在 marks location or an ongoing position (to be at). Using 是 where 在 or 有 is needed is the classic beginner error.',
    '[{"text": "我妈妈是老师。", "translation": "My mother is a teacher. (A is B)"}, {"text": "桌子上有一本书。", "translation": "There is a book on the table. (existence 有)"}, {"text": "书在桌子上。", "translation": "The book is on the table. (location 在)"}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook facts about Mandarin grammar.'
  ),
  (
    'zh',
    'Measure words 个, 本, 只',
    'Nouns are counted with measure words.',
    'Chinese numbers cannot attach to bare nouns; a measure word sits between them. 个 is the general-purpose one; 本 is for books and bound volumes; 只 is for many animals. The measure word also appears after demonstratives: 这个, 那本.',
    '[{"text": "两个包子", "translation": "two steamed buns (general measure 个)"}, {"text": "一本书", "translation": "one book (bound volume measure 本)"}, {"text": "一只猫", "translation": "one cat (animal measure 只)"}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook facts about Mandarin grammar.'
  ),
  (
    'zh',
    'The particle 了',
    '了 marks a completed action.',
    'The verbal 了 after a verb signals that the action is complete or closed off. It is not a tense by itself; context decides the reading. Sentence-final 了 often signals a new situation or change of state.',
    '[{"text": "我吃了早饭。", "translation": "I ate breakfast. (completed action 了 after verb)"}, {"text": "下雨了。", "translation": "It started raining. (new situation, sentence-final 了)"}]',
    'community',
    'Linguarium demonstration content (project team). Standard textbook facts about Mandarin grammar.'
  )
ON CONFLICT (language_code, name) DO NOTHING;

-- ================================================================
-- Phase 3 batch: personalization columns, shared lexicon starter
-- entries, the community contribution tables and a curated catalog
-- of open per-language resources (frequency lists, pronunciation
-- references, learner corpora, dictionaries) with license metadata.
--
-- Everything remains idempotent (IF NOT EXISTS / ON CONFLICT), so
-- re-running this seed on an existing database only adds what is
-- missing and never touches user content.
-- ================================================================

-- Guards for databases created before phase 3 (also in schema.sql).
ALTER TABLE user_data.language_profiles ADD COLUMN IF NOT EXISTS retention_recognition REAL NOT NULL DEFAULT 0.9;
ALTER TABLE user_data.language_profiles ADD COLUMN IF NOT EXISTS retention_recall       REAL NOT NULL DEFAULT 0.9;
ALTER TABLE user_data.language_profiles ADD COLUMN IF NOT EXISTS retention_production    REAL NOT NULL DEFAULT 0.9;
ALTER TABLE user_data.language_profiles ADD COLUMN IF NOT EXISTS daily_new_limit     INTEGER;
ALTER TABLE user_data.language_profiles ADD COLUMN IF NOT EXISTS daily_review_limit  INTEGER;

CREATE TABLE IF NOT EXISTS user_data.fsrs_weights (
  user_id        UUID PRIMARY KEY,
  weights        JSONB NOT NULL,
  trained_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  review_count   INTEGER NOT NULL DEFAULT 0,
  loss_default   REAL,
  loss_optimized REAL,
  provenance     TEXT NOT NULL DEFAULT 'automated'
);

CREATE TABLE IF NOT EXISTS knowledge.contribution_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          TEXT NOT NULL,
  language_code TEXT NOT NULL,
  title         TEXT,
  payload       JSONB NOT NULL,
  submitted_by  UUID NOT NULL,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT NOT NULL DEFAULT 'pending',
  moderated_at  TIMESTAMPTZ,
  moderator_note TEXT,
  provenance    TEXT NOT NULL DEFAULT 'community',
  license       TEXT NOT NULL DEFAULT 'unspecified',
  source_url    TEXT
);
CREATE INDEX IF NOT EXISTS idx_contribution_queue_status ON knowledge.contribution_queue (status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_contribution_queue_submitter ON knowledge.contribution_queue (submitted_by);

CREATE TABLE IF NOT EXISTS knowledge.lexicon (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code TEXT NOT NULL,
  term          TEXT NOT NULL,
  reading       TEXT,
  part_of_speech TEXT,
  definition    TEXT NOT NULL,
  gloss_language TEXT NOT NULL DEFAULT 'en',
  provenance    TEXT NOT NULL DEFAULT 'community',
  source_url    TEXT,
  license       TEXT NOT NULL DEFAULT 'unspecified',
  source_ref    TEXT,
  created_by    UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lexicon_lang_term
  ON knowledge.lexicon (language_code, term);

CREATE TABLE IF NOT EXISTS knowledge.resources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code TEXT NOT NULL,
  kind          TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  source_url    TEXT NOT NULL,
  license       TEXT NOT NULL,
  provenance    TEXT NOT NULL DEFAULT 'community',
  source_ref    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_resources_lang_name
  ON knowledge.resources (language_code, name);

-- ---------------------------------------------------------------
-- Shared lexicon starter entries.
--
-- Deliberately small and conservative: only terms whose glosses are
-- standard, widely published textbook knowledge. Provenance is
-- 'community' - never 'verified' - and every row asks the reader to
-- verify against a real source. Grows through the contribution queue.
-- ---------------------------------------------------------------

INSERT INTO knowledge.lexicon (language_code, term, part_of_speech, definition, gloss_language, provenance, source_url, license, source_ref) VALUES
  ('tok', 'akesi', 'noun', 'reptile, amphibian; a scaly or wet-skinned animal', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'ala', 'particle', 'no, none, zero; negates the word it follows', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'ale', 'noun', 'all, everything, life (the synonym ali is also common)', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'anu', 'particle', 'or; joins alternatives', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'awen', 'verb', 'to stay, to remain, to wait; still, yet', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'en', 'particle', 'and; joins noun phrases acting as the subject', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'ijo', 'noun', 'thing, something, anything; phenomenon', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'ike', 'adjective', 'bad, unpleasant, unneeded', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'jan', 'noun', 'person, human being, somebody', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'jo', 'verb', 'to have, to hold, to carry', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'kala', 'noun', 'fish, sea creature', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'kasi', 'noun', 'plant, vegetation, herb, leaf', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'ken', 'verb', 'to be able, can; possible', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'kepeken', 'verb', 'to use; (preposition) with, by means of', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'kili', 'noun', 'fruit, vegetable, mushroom', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'kiwen', 'noun', 'hard thing, solid object, stone-like thing', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'kule', 'noun', 'colour, paint; (adjective) colourful', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'kulupu', 'noun', 'group, community, society, gathering', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'lawa', 'noun', 'head; (verb) to lead, to control, to steer', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'lipu', 'noun', 'flat object, book, document, web page', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'luka', 'noun', 'hand, arm; the number five', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'ma', 'noun', 'land, earth, country, outdoors', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'mama', 'noun', 'parent, ancestor; cause, source', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'moku', 'noun', 'food, meal; (verb) to eat, to drink', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('tok', 'pona', 'adjective', 'good, positive, useful; (verb) to improve, to fix, to heal', 'en', 'community', 'https://en.wiktionary.org/wiki/Category:Toki_Pona_language', 'cc-by-sa-4.0', 'Gloss follows the widely published core word list. Verify before relying on it.'),
  ('eo', 'akvo', 'noun', 'water', 'en', 'community', NULL, 'public-domain', 'Root and gloss as published in the Fundamento de Esperanto (public domain). Verify before relying on it.'),
  ('eo', 'amiko', 'noun', 'friend', 'en', 'community', NULL, 'public-domain', 'Root and gloss as published in the Fundamento de Esperanto (public domain). Verify before relying on it.'),
  ('eo', 'bela', 'adjective', 'beautiful, pretty', 'en', 'community', NULL, 'public-domain', 'Root and gloss as published in the Fundamento de Esperanto (public domain). Verify before relying on it.'),
  ('eo', 'bona', 'adjective', 'good', 'en', 'community', NULL, 'public-domain', 'Root and gloss as published in the Fundamento de Esperanto (public domain). Verify before relying on it.'),
  ('eo', 'granda', 'adjective', 'large, big', 'en', 'community', NULL, 'public-domain', 'Root and gloss as published in the Fundamento de Esperanto (public domain). Verify before relying on it.'),
  ('eo', 'hundo', 'noun', 'dog', 'en', 'community', NULL, 'public-domain', 'Root and gloss as published in the Fundamento de Esperanto (public domain). Verify before relying on it.'),
  ('eo', 'kato', 'noun', 'cat', 'en', 'community', NULL, 'public-domain', 'Root and gloss as published in the Fundamento de Esperanto (public domain). Verify before relying on it.'),
  ('eo', 'libro', 'noun', 'book', 'en', 'community', NULL, 'public-domain', 'Root and gloss as published in the Fundamento de Esperanto (public domain). Verify before relying on it.'),
  ('eo', 'lingvo', 'noun', 'language', 'en', 'community', NULL, 'public-domain', 'Root and gloss as published in the Fundamento de Esperanto (public domain). Verify before relying on it.'),
  ('eo', 'nokto', 'noun', 'night', 'en', 'community', NULL, 'public-domain', 'Root and gloss as published in the Fundamento de Esperanto (public domain). Verify before relying on it.'),
  ('eo', 'patro', 'noun', 'father', 'en', 'community', NULL, 'public-domain', 'Root and gloss as published in the Fundamento de Esperanto (public domain). Verify before relying on it.'),
  ('eo', 'patrino', 'noun', 'mother', 'en', 'community', NULL, 'public-domain', 'Root and gloss as published in the Fundamento de Esperanto (public domain). Verify before relying on it.'),
  ('eo', 'suno', 'noun', 'sun', 'en', 'community', NULL, 'public-domain', 'Root and gloss as published in the Fundamento de Esperanto (public domain). Verify before relying on it.'),
  ('eo', 'tago', 'noun', 'day', 'en', 'community', NULL, 'public-domain', 'Root and gloss as published in the Fundamento de Esperanto (public domain). Verify before relying on it.'),
  ('eo', 'tero', 'noun', 'earth, ground', 'en', 'community', NULL, 'public-domain', 'Root and gloss as published in the Fundamento de Esperanto (public domain). Verify before relying on it.'),
  ('la', 'aqua', 'noun', 'water', 'en', 'community', NULL, 'public-domain', 'Standard textbook Latin vocabulary. Verify against a dictionary before relying on it.'),
  ('la', 'amicus', 'noun', 'friend', 'en', 'community', NULL, 'public-domain', 'Standard textbook Latin vocabulary. Verify against a dictionary before relying on it.'),
  ('la', 'dies', 'noun', 'day', 'en', 'community', NULL, 'public-domain', 'Standard textbook Latin vocabulary. Verify against a dictionary before relying on it.'),
  ('la', 'liber', 'noun', 'book', 'en', 'community', NULL, 'public-domain', 'Standard textbook Latin vocabulary. Verify against a dictionary before relying on it.'),
  ('la', 'lingua', 'noun', 'tongue, language', 'en', 'community', NULL, 'public-domain', 'Standard textbook Latin vocabulary. Verify against a dictionary before relying on it.'),
  ('la', 'nox', 'noun', 'night', 'en', 'community', NULL, 'public-domain', 'Standard textbook Latin vocabulary. Verify against a dictionary before relying on it.'),
  ('la', 'sol', 'noun', 'sun', 'en', 'community', NULL, 'public-domain', 'Standard textbook Latin vocabulary. Verify against a dictionary before relying on it.'),
  ('la', 'terra', 'noun', 'earth, land', 'en', 'community', NULL, 'public-domain', 'Standard textbook Latin vocabulary. Verify against a dictionary before relying on it.')
ON CONFLICT (language_code, term) DO NOTHING;

-- ---------------------------------------------------------------
-- Extended language resources: a curated catalog of open resources.
-- Every entry links to the source with its license; the data itself is
-- never copied into this database. Provenance is 'community' and the
-- source_ref asks the reader to verify the license at the source.
-- ---------------------------------------------------------------

-- Dictionary: the English Wiktionary category of each preset language
-- (definitions, readings, IPA). Exists for every language in the presets.
INSERT INTO knowledge.resources (language_code, kind, name, description, source_url, license, provenance, source_ref)
SELECT
  l.code,
  'dictionary',
  'Wiktionary',
  'Wiktionary coverage of ' || l.name || ': definitions, readings and IPA pronunciation.',
  'https://en.wiktionary.org/wiki/Category:' || replace(replace(replace(l.name, ' (', ' '), ')', ''), ' ', '_') || '_language',
  'CC BY-SA 4.0',
  'community',
  'Curated catalog entry. Verify the license at the source before relying on it.'
FROM knowledge.languages l
ON CONFLICT (language_code, name) DO NOTHING;

-- Corpus: the Wikipedia edition of each preset language (living text for
-- reading practice). Toki Pona has no Wikipedia edition and is skipped.
INSERT INTO knowledge.resources (language_code, kind, name, description, source_url, license, provenance, source_ref)
SELECT
  l.code,
  'corpus',
  'Wikipedia',
  'A living corpus of ' || l.name || ' articles: natural prose for reading practice.',
  'https://' || (CASE WHEN l.code = 'nb' THEN 'no' ELSE l.code END) || '.wikipedia.org',
  'CC BY-SA 4.0',
  'community',
  'Curated catalog entry. Verify the license at the source before relying on it.'
FROM knowledge.languages l
WHERE l.code <> 'tok'
ON CONFLICT (language_code, name) DO NOTHING;

-- Corpus: Tatoeba sentences (learner-friendly sentence pairs; most
-- sentences CC BY 2.0 FR, some CC0). Tatoeba uses ISO 639-3 codes.
INSERT INTO knowledge.resources (language_code, kind, name, description, source_url, license, provenance, source_ref)
SELECT
  l.code,
  'corpus',
  'Tatoeba',
  'A sentence collection in ' || l.name || ': short natural sentences with translations.',
  'https://tatoeba.org/en/sentences/show_all/' || (
    CASE l.code
      WHEN 'en' THEN 'eng' WHEN 'fr' THEN 'fra' WHEN 'es' THEN 'spa' WHEN 'pt' THEN 'por'
      WHEN 'it' THEN 'ita' WHEN 'ca' THEN 'cat' WHEN 'de' THEN 'deu' WHEN 'nl' THEN 'nld'
      WHEN 'sv' THEN 'swe' WHEN 'da' THEN 'dan' WHEN 'fi' THEN 'fin' WHEN 'is' THEN 'isl'
      WHEN 'pl' THEN 'pol' WHEN 'cs' THEN 'ces' WHEN 'sk' THEN 'slk' WHEN 'hu' THEN 'hun'
      WHEN 'ro' THEN 'ron' WHEN 'bg' THEN 'bul' WHEN 'ru' THEN 'rus' WHEN 'uk' THEN 'ukr'
      WHEN 'el' THEN 'ell' WHEN 'la' THEN 'lat' WHEN 'eo' THEN 'epo' WHEN 'tr' THEN 'tur'
      WHEN 'sq' THEN 'sqi' WHEN 'lt' THEN 'lit' WHEN 'lv' THEN 'lav' WHEN 'et' THEN 'est'
      WHEN 'cy' THEN 'cym' WHEN 'ga' THEN 'gle' WHEN 'haw' THEN 'haw' WHEN 'af' THEN 'afr'
      WHEN 'id' THEN 'ind' WHEN 'ms' THEN 'zsm' WHEN 'tl' THEN 'tgl' WHEN 'sw' THEN 'swa'
      WHEN 'vi' THEN 'vie' WHEN 'ar' THEN 'ara' WHEN 'he' THEN 'heb' WHEN 'fa' THEN 'pes'
      WHEN 'hi' THEN 'hin' WHEN 'bn' THEN 'ben' WHEN 'ta' THEN 'tam' WHEN 'te' THEN 'tel'
      WHEN 'kn' THEN 'kan' WHEN 'ml' THEN 'mal' WHEN 'th' THEN 'tha' WHEN 'lo' THEN 'lao'
      WHEN 'km' THEN 'khm' WHEN 'my' THEN 'mya' WHEN 'zh' THEN 'cmn' WHEN 'ja' THEN 'jpn'
      WHEN 'ko' THEN 'kor' WHEN 'ur' THEN 'urd' WHEN 'ps' THEN 'pbu'
      ELSE NULL
    END),
  'CC BY 2.0 FR (some sentences CC0)',
  'community',
  'Curated catalog entry. Verify the license at the source before relying on it.'
FROM knowledge.languages l
WHERE (
  CASE l.code
    WHEN 'en' THEN 'eng' WHEN 'fr' THEN 'fra' WHEN 'es' THEN 'spa' WHEN 'pt' THEN 'por'
    WHEN 'it' THEN 'ita' WHEN 'ca' THEN 'cat' WHEN 'de' THEN 'deu' WHEN 'nl' THEN 'nld'
    WHEN 'sv' THEN 'swe' WHEN 'da' THEN 'dan' WHEN 'fi' THEN 'fin' WHEN 'is' THEN 'isl'
    WHEN 'pl' THEN 'pol' WHEN 'cs' THEN 'ces' WHEN 'sk' THEN 'slk' WHEN 'hu' THEN 'hun'
    WHEN 'ro' THEN 'ron' WHEN 'bg' THEN 'bul' WHEN 'ru' THEN 'rus' WHEN 'uk' THEN 'ukr'
    WHEN 'el' THEN 'ell' WHEN 'la' THEN 'lat' WHEN 'eo' THEN 'epo' WHEN 'tr' THEN 'tur'
    WHEN 'sq' THEN 'sqi' WHEN 'lt' THEN 'lit' WHEN 'lv' THEN 'lav' WHEN 'et' THEN 'est'
    WHEN 'cy' THEN 'cym' WHEN 'ga' THEN 'gle' WHEN 'haw' THEN 'haw' WHEN 'af' THEN 'afr'
    WHEN 'id' THEN 'ind' WHEN 'ms' THEN 'zsm' WHEN 'tl' THEN 'tgl' WHEN 'sw' THEN 'swa'
    WHEN 'vi' THEN 'vie' WHEN 'ar' THEN 'ara' WHEN 'he' THEN 'heb' WHEN 'fa' THEN 'pes'
    WHEN 'hi' THEN 'hin' WHEN 'bn' THEN 'ben' WHEN 'ta' THEN 'tam' WHEN 'te' THEN 'tel'
    WHEN 'kn' THEN 'kan' WHEN 'ml' THEN 'mal' WHEN 'th' THEN 'tha' WHEN 'lo' THEN 'lao'
    WHEN 'km' THEN 'khm' WHEN 'my' THEN 'mya' WHEN 'zh' THEN 'cmn' WHEN 'ja' THEN 'jpn'
    WHEN 'ko' THEN 'kor' WHEN 'ur' THEN 'urd' WHEN 'ps' THEN 'pbu'
    ELSE NULL
  END) IS NOT NULL
ON CONFLICT (language_code, name) DO NOTHING;

-- Hand-curated entries with stable, well-known homes.
INSERT INTO knowledge.resources (language_code, kind, name, description, source_url, license, provenance, source_ref) VALUES
  ('en', 'frequency_list', 'Wiktionary frequency lists', 'Community-maintained word frequency lists (including a 100k list) with sources and caveats documented on the page.', 'https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists', 'CC BY-SA 4.0', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('en', 'pronunciation', 'CMU Pronouncing Dictionary', 'A machine-readable pronunciation dictionary of North American English (ARPAbet phonemes).', 'https://www.speech.cs.cmu.edu/cgi-bin/cmudict', 'BSD-style; see the source', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('ja', 'dictionary', 'JMdict / EDICT project', 'The Japanese-English dictionary project behind most open Japanese dictionary apps; XML files with readings, senses and part of speech.', 'https://www.edrdg.org/jmdict/edict.html', 'CC BY-SA 4.0', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('zh', 'dictionary', 'CC-CEDICT', 'A community-maintained Chinese-English dictionary (simplified and traditional, with pinyin), distributed by MDBG.', 'https://www.mdbg.net/chinese/dictionary?page=cedict', 'CC BY-SA 4.0', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('la', 'corpus', 'The Latin Library', 'A large collection of public-domain Latin texts by period and author: classical, medieval and neo-Latin.', 'https://www.thelatinlibrary.com/', 'public domain (see the site notice)', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('eo', 'corpus', 'Tekstaro de Esperanto', 'A searchable corpus of Esperanto literature and the Fundamento texts for reading practice.', 'https://tekstaro.com/', 'free to read; see site terms', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('tok', 'dictionary', 'tokipona.org', 'The official Toki Pona site: the core word list, lessons and reading guidance by the creator of the language.', 'https://tokipona.org/', 'see site terms', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.')
ON CONFLICT (language_code, name) DO NOTHING;

-- Frequency lists: the FrequencyWords repository publishes
-- OpenSubtitles-derived top-50k lists for many languages.
INSERT INTO knowledge.resources (language_code, kind, name, description, source_url, license, provenance, source_ref) VALUES
  ('en', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for English, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('fr', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for French, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('es', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for Spanish, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('pt', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for Portuguese, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('it', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for Italian, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('de', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for German, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('nl', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for Dutch, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('sv', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for Swedish, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('ru', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for Russian, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('pl', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for Polish, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('tr', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for Turkish, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('ar', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for Arabic, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('hi', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for Hindi, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('id', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for Indonesian, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('vi', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for Vietnamese, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('cs', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for Czech, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('el', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for Greek, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('uk', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for Ukrainian, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('ko', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for Korean, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('ja', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for Japanese, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.'),
  ('zh', 'frequency_list', 'FrequencyWords (OpenSubtitles)', 'OpenSubtitles-derived word frequency list for Chinese, maintained in the FrequencyWords repository.', 'https://github.com/hermitdave/FrequencyWords', 'MIT (repository code); verify the data terms in the repository README', 'community', 'Curated catalog entry. Verify the license at the source before relying on it.')
ON CONFLICT (language_code, name) DO NOTHING;
-- ---------------------------------------------------------------
-- Online-lookup cache (Wiktionary / free dictionary APIs).
-- Server-side cache for the word-lookup chain: local lexicon first,
-- then online dictionaries (attributed, license-labelled), then the
-- user-triggered AI fallback. The cache stores the provider payload so a
-- term is fetched at most once per (language, term) for the deployment.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge.lookup_cache (
  language_code TEXT NOT NULL,
  term          TEXT NOT NULL,
  payload       JSONB NOT NULL,
  source        TEXT NOT NULL,
  source_url    TEXT,
  license       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (language_code, term)
);

-- ---------------------------------------------------------------
-- Core segmentation + lookup lexicon for no-space scripts.
--
-- Japanese and Chinese carry readings here (furigana / pinyin): these rows
-- power (a) dictionary word segmentation in the reader, and (b) ruby
-- annotations for words the text itself does not annotate.
--
-- Honest provenance: standard beginner textbook vocabulary (JLPT N5-level
-- and HSK 1-3 level words), transcribed carefully by the project team for
-- this seed - NOT checked against a cited edition. Verify before relying.
-- ---------------------------------------------------------------
INSERT INTO knowledge.lexicon (language_code, term, reading, part_of_speech, definition, gloss_language, provenance, source_url, license, source_ref) VALUES
  -- pronouns and demonstratives
  ('ja', '私', 'わたし', 'pronoun', 'I; me', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '僕', 'ぼく', 'pronoun', 'I (casual, used by men and boys)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '君', 'きみ', 'pronoun', 'you (familiar)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'あなた', 'あなた', 'pronoun', 'you (neutral)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '彼', 'かれ', 'pronoun', 'he; boyfriend', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '彼女', 'かのじょ', 'pronoun', 'she; girlfriend', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '我々', 'われわれ', 'pronoun', 'we (formal)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '皆', 'みんな', 'pronoun', 'everyone; all', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'これ', 'これ', 'pronoun', 'this (near the speaker)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'それ', 'それ', 'pronoun', 'that (near the listener)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'あれ', 'あれ', 'pronoun', 'that over there', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'ここ', 'ここ', 'pronoun', 'here', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'そこ', 'そこ', 'pronoun', 'there (near you)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'どこ', 'どこ', 'pronoun', 'where', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'この', 'この', 'determiner', 'this ...', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'その', 'その', 'determiner', 'that ...', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'あの', 'あの', 'determiner', 'that ... over there', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'どの', 'どの', 'determiner', 'which ...', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  -- question words
  ('ja', '何', 'なに', 'pronoun', 'what', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '誰', 'だれ', 'pronoun', 'who', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'いつ', 'いつ', 'adverb', 'when', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'なぜ', 'なぜ', 'adverb', 'why', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'どう', 'どう', 'adverb', 'how; in what way', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'どうして', 'どうして', 'adverb', 'why; how come', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'いくら', 'いくら', 'adverb', 'how much', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'どんな', 'どんな', 'determiner', 'what kind of', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  -- particles and grammatical words (the segmentation backbone)
  ('ja', 'は', 'は', 'particle', 'topic marker (pronounced wa)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'を', 'を', 'particle', 'direct-object marker (pronounced o)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'に', 'に', 'particle', 'direction, time, indirect object marker', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'が', 'が', 'particle', 'subject marker; but', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'で', 'で', 'particle', 'location-of-action / means marker', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'と', 'と', 'particle', 'and; with (quoting)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'も', 'も', 'particle', 'also; even', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'の', 'の', 'particle', 'possessive / linking marker', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'か', 'か', 'particle', 'question marker', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'や', 'や', 'particle', 'and (non-exhaustive list)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'から', 'から', 'particle', 'from; because', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'まで', 'まで', 'particle', 'until; as far as', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'より', 'より', 'particle', 'than (comparisons)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'へ', 'へ', 'particle', 'toward (pronounced e)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'ね', 'ね', 'particle', 'right? (seeking agreement)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'ので', 'ので', 'conjunction', 'because; since', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'けど', 'けど', 'conjunction', 'but (casual)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'しかし', 'しかし', 'conjunction', 'however', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'でも', 'でも', 'conjunction', 'but; however', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'それで', 'それで', 'conjunction', 'therefore; and then', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'それとも', 'それとも', 'conjunction', 'or (between alternatives)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  -- copula and verb endings
  ('ja', 'です', 'です', 'copula', 'polite to-be', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'だ', 'だ', 'copula', 'plain to-be', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'ます', 'ます', 'suffix', 'polite present verb ending', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'ました', 'ました', 'suffix', 'polite past verb ending', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'ません', 'ません', 'suffix', 'polite negative verb ending', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'ましょう', 'ましょう', 'suffix', 'polite let''s / offer', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'ください', 'ください', 'verb', 'please (give/do)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'たい', 'たい', 'suffix', 'want to (do)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'でしょう', 'でしょう', 'suffix', 'probably; right? (polite)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'だろう', 'だろう', 'suffix', 'probably (plain)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'かもしれない', 'かもしれない', 'expression', 'might; perhaps', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  -- very common verbs and stems
  ('ja', 'する', 'する', 'verb', 'to do', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'いる', 'いる', 'verb', 'to exist (animate); to be staying', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'ある', 'ある', 'verb', 'to exist (inanimate); to have', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'なる', 'なる', 'verb', 'to become', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '見る', 'みる', 'verb', 'to see; to watch; to look', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '見', 'み', 'noun', 'look; seeing (verb stem, e.g. 見る/見ます)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '聞く', 'きく', 'verb', 'to listen; to hear; to ask', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '言う', 'いう', 'verb', 'to say', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '行く', 'いく', 'verb', 'to go', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '来る', 'くる', 'verb', 'to come', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '食べる', 'たべる', 'verb', 'to eat', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '食べ', 'たべ', 'noun', 'eating (verb stem)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '飲む', 'のむ', 'verb', 'to drink', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '読む', 'よむ', 'verb', 'to read', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '書く', 'かく', 'verb', 'to write', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '買う', 'かう', 'verb', 'to buy', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '売る', 'うる', 'verb', 'to sell', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '待つ', 'まつ', 'verb', 'to wait', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '持つ', 'もつ', 'verb', 'to hold; to have (a thing)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '作る', 'つくる', 'verb', 'to make; to cook', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '使う', 'つかう', 'verb', 'to use', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '住む', 'すむ', 'verb', 'to live (reside)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '働く', 'はたらく', 'verb', 'to work', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '起きる', 'おきる', 'verb', 'to wake up', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '寝る', 'ねる', 'verb', 'to sleep; to go to bed', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '学ぶ', 'まなぶ', 'verb', 'to learn; to study', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '習う', 'ならう', 'verb', 'to learn (be taught)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '勉強', 'べんきょう', 'noun', 'study', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '教える', 'おしえる', 'verb', 'to teach; to tell', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '覚える', 'おぼえる', 'verb', 'to memorize; to remember', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '考える', 'かんがえる', 'verb', 'to think about; to consider', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '分かる', 'わかる', 'verb', 'to understand; to be clear', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '知る', 'しる', 'verb', 'to know; to get to know', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '出す', 'だす', 'verb', 'to take out; to submit', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '出る', 'でる', 'verb', 'to exit; to appear', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '入る', 'はいる', 'verb', 'to enter', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '開ける', 'あける', 'verb', 'to open (a thing)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '閉める', 'しめる', 'verb', 'to close (a thing)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '乗る', 'のる', 'verb', 'to ride; to get on', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '歩く', 'あるく', 'verb', 'to walk', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '走る', 'はしる', 'verb', 'to run', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '泳ぐ', 'およぐ', 'verb', 'to swim', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '遊ぶ', 'あそぶ', 'verb', 'to play; to have fun', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '会う', 'あう', 'verb', 'to meet', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '話す', 'はなす', 'verb', 'to speak; to talk', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '泣く', 'なく', 'verb', 'to cry', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '生れる', 'うまれる', 'verb', 'to be born (also written 生まれる)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  -- common adjectives
  ('ja', '大きい', 'おおきい', 'adjective', 'big; large', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '小さい', 'ちいさい', 'adjective', 'small', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '新しい', 'あたらしい', 'adjective', 'new', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '古い', 'ふるい', 'adjective', 'old (things)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '良い', 'よい', 'adjective', 'good (also いい)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'いい', 'いい', 'adjective', 'good', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '悪い', 'わるい', 'adjective', 'bad', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '高い', 'たかい', 'adjective', 'expensive; tall; high', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '安い', 'やすい', 'adjective', 'cheap', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '暑い', 'あつい', 'adjective', 'hot (weather)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '熱い', 'あつい', 'adjective', 'hot (things)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '寒い', 'さむい', 'adjective', 'cold (weather)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '面白い', 'おもしろい', 'adjective', 'interesting; funny', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '楽しい', 'たのしい', 'adjective', 'fun; enjoyable', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '難しい', 'むずかしい', 'adjective', 'difficult', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '易しい', 'やさしい', 'adjective', 'easy; kind', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '早い', 'はやい', 'adjective', 'early', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '速い', 'はやい', 'adjective', 'fast', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '遅い', 'おそい', 'adjective', 'late; slow', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '長い', 'ながい', 'adjective', 'long', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '短い', 'みじかい', 'adjective', 'short', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '多い', 'おおい', 'adjective', 'many; numerous', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '少ない', 'すくない', 'adjective', 'few; scarce', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '美味しい', 'おいしい', 'adjective', 'delicious', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '忙しい', 'いそがしい', 'adjective', 'busy', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '近い', 'ちかい', 'adjective', 'near', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '遠い', 'とおい', 'adjective', 'far', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '強い', 'つよい', 'adjective', 'strong', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '弱い', 'よわい', 'adjective', 'weak', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '若い', 'わかい', 'adjective', 'young', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '薄暗い', 'うすぐらい', 'adjective', 'dim', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: vocabulary transcribed by the project team to support the seeded Japanese reading text - verify before relying on it.'),
  -- common nouns
  ('ja', '人', 'ひと', 'noun', 'person', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '人間', 'にんげん', 'noun', 'human being', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '家', 'いえ', 'noun', 'house; home', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '部屋', 'へや', 'noun', 'room', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '学校', 'がっこう', 'noun', 'school', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '先生', 'せんせい', 'noun', 'teacher', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '学生', 'がくせい', 'noun', 'student', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '友達', 'ともだち', 'noun', 'friend', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '名前', 'なまえ', 'noun', 'name', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '今', 'いま', 'noun', 'now', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '今日', 'きょう', 'noun', 'today', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '明日', 'あした', 'noun', 'tomorrow', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '昨日', 'きのう', 'noun', 'yesterday', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '時間', 'じかん', 'noun', 'time; hour', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '年', 'とし', 'noun', 'year', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '月', 'つき', 'noun', 'month; moon', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '日', 'ひ', 'noun', 'day; sun', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '朝', 'あさ', 'noun', 'morning', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '昼', 'ひる', 'noun', 'noon; daytime', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '夜', 'よる', 'noun', 'night', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '水', 'みず', 'noun', 'water', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '空', 'そら', 'noun', 'sky', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '風', 'かぜ', 'noun', 'wind', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '雨', 'あめ', 'noun', 'rain', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '雪', 'ゆき', 'noun', 'snow', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '山', 'やま', 'noun', 'mountain', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '川', 'かわ', 'noun', 'river', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '海', 'うみ', 'noun', 'sea', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '道', 'みち', 'noun', 'road; way', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '駅', 'えき', 'noun', 'station', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '車', 'くるま', 'noun', 'car', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '電車', 'でんしゃ', 'noun', 'train', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '空港', 'くうこう', 'noun', 'airport', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '飛行機', 'ひこうき', 'noun', 'airplane', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'ご飯', 'ごはん', 'noun', 'rice; meal', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '肉', 'にく', 'noun', 'meat', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '魚', 'さかな', 'noun', 'fish', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '野菜', 'やさい', 'noun', 'vegetables', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '果物', 'くだもの', 'noun', 'fruit', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'お茶', 'おちゃ', 'noun', 'tea', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '家族', 'かぞく', 'noun', 'family', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '父', 'ちち', 'noun', 'father (own)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '母', 'はは', 'noun', 'mother (own)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '兄', 'あに', 'noun', 'older brother (own)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '姉', 'あね', 'noun', 'older sister (own)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '弟', 'おとうと', 'noun', 'younger brother', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '妹', 'いもうと', 'noun', 'younger sister', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '子供', 'こども', 'noun', 'child', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '男', 'おとこ', 'noun', 'man', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '女', 'おんな', 'noun', 'woman', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '猫', 'ねこ', 'noun', 'cat', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '犬', 'いぬ', 'noun', 'dog', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '鳥', 'とり', 'noun', 'bird', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '花', 'はな', 'noun', 'flower', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '木', 'き', 'noun', 'tree; wood', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '本', 'ほん', 'noun', 'book', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '話', 'はなし', 'noun', 'story; talk', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '言葉', 'ことば', 'noun', 'word; language', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '手', 'て', 'noun', 'hand', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '足', 'あし', 'noun', 'foot; leg', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '目', 'め', 'noun', 'eye', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '耳', 'みみ', 'noun', 'ear', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '口', 'くち', 'noun', 'mouth', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '頭', 'あたま', 'noun', 'head', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '体', 'からだ', 'noun', 'body', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '心', 'こころ', 'noun', 'heart; mind', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '金', 'かね', 'noun', 'money', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '仕事', 'しごと', 'noun', 'work; job', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '会社', 'かいしゃ', 'noun', 'company', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '病気', 'びょうき', 'noun', 'illness', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '病院', 'びょういん', 'noun', 'hospital', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '天気', 'てんき', 'noun', 'weather', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '店', 'みせ', 'noun', 'shop', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '国', 'くに', 'noun', 'country', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '世界', 'せかい', 'noun', 'world', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '新聞', 'しんぶん', 'noun', 'newspaper', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '手紙', 'てがみ', 'noun', 'letter', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '音楽', 'おんがく', 'noun', 'music', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '映画', 'えいが', 'noun', 'movie', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '写真', 'しゃしん', 'noun', 'photo', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '旅行', 'りょこう', 'noun', 'travel; trip', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  -- vocabulary from the seeded 吾輩は猫である opening
  ('ja', '吾輩', 'わがはい', 'pronoun', 'I (archaic, haughty - Sōseki''s cat)', 'en', 'community', NULL, 'mit', 'Vocabulary transcribed by the project team to support the seeded Japanese reading text (opening of 吾輩は猫である) - verify before relying on it.'),
  ('ja', '見当', 'けんとう', 'noun', 'conjecture; rough aim (見当がつく = to be able to guess)', 'en', 'community', NULL, 'mit', 'Vocabulary transcribed by the project team to support the seeded Japanese reading text (opening of 吾輩は猫である) - verify before relying on it.'),
  ('ja', '獰悪', 'どうあく', 'adjective', 'ferocious; vicious', 'en', 'community', NULL, 'mit', 'Vocabulary transcribed by the project team to support the seeded Japanese reading text (opening of 吾輩は猫である) - verify before relying on it.'),
  ('ja', '書生', 'しょせい', 'noun', 'student clerk (Meiji-era term)', 'en', 'community', NULL, 'mit', 'Vocabulary transcribed by the project team to support the seeded Japanese reading text (opening of 吾輩は猫である) - verify before relying on it.'),
  ('ja', '種族', 'しゅぞく', 'noun', 'race; species', 'en', 'community', NULL, 'mit', 'Vocabulary transcribed by the project team to support the seeded Japanese reading text (opening of 吾輩は猫である) - verify before relying on it.'),
  ('ja', '記憶', 'きおく', 'noun', 'memory', 'en', 'community', NULL, 'mit', 'Vocabulary transcribed by the project team to support the seeded Japanese reading text (opening of 吾輩は猫である) - verify before relying on it.'),
  ('ja', '事', 'こと', 'noun', 'thing; matter (abstract)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '所', 'ところ', 'noun', 'place', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '物', 'もの', 'noun', 'thing (concrete)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'もの', 'もの', 'noun', 'thing (kana spelling of 物)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  -- adverbs and expressions
  ('ja', 'とても', 'とても', 'adverb', 'very', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '少し', 'すこし', 'adverb', 'a little', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'たくさん', 'たくさん', 'adverb', 'a lot; many', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'もう', 'もう', 'adverb', 'already; soon; more', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'まだ', 'まだ', 'adverb', 'still; not yet', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'また', 'また', 'adverb', 'again; also', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'いつも', 'いつも', 'adverb', 'always', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '時々', 'ときどき', 'adverb', 'sometimes', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'よく', 'よく', 'adverb', 'often; well', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'たぶん', 'たぶん', 'adverb', 'probably', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'きっと', 'きっと', 'adverb', 'surely; certainly', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '本当に', 'ほんとうに', 'adverb', 'really; truly', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '一緒に', 'いっしょに', 'adverb', 'together', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'そう', 'そう', 'adverb', 'so; like that', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '色々', 'いろいろ', 'adverb', 'various; all kinds', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'ところが', 'ところが', 'conjunction', 'however; even so', 'en', 'community', NULL, 'mit', 'Vocabulary transcribed by the project team to support the seeded Japanese reading text - verify before relying on it.'),
  ('ja', 'しかも', 'しかも', 'conjunction', 'moreover; and yet', 'en', 'community', NULL, 'mit', 'Vocabulary transcribed by the project team to support the seeded Japanese reading text (opening of 吾輩は猫である) - verify before relying on it.'),
  ('ja', 'あと', 'あと', 'noun', 'afterwards; remainder', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', 'はじめて', 'はじめて', 'adverb', 'for the first time', 'en', 'community', NULL, 'mit', 'Vocabulary transcribed by the project team to support the seeded Japanese reading text (opening of 吾輩は猫である) - verify before relying on it.'),
  ('ja', 'そうだ', 'そうだ', 'expression', 'it appears; I hear that (plain)', 'en', 'community', NULL, 'mit', 'Vocabulary transcribed by the project team to support the seeded Japanese reading text - verify before relying on it.'),
  ('ja', 'ニャー', 'ニャー', 'interjection', 'meow (Japanese onomatopoeia)', 'en', 'community', NULL, 'mit', 'Vocabulary transcribed by the project team to support the seeded Japanese reading text - verify before relying on it.'),
  -- numbers
  ('ja', '一', 'いち', 'number', 'one', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '二', 'に', 'number', 'two', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '三', 'さん', 'number', 'three', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '四', 'よん', 'number', 'four (reading し also exists)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '五', 'ご', 'number', 'five', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '六', 'ろく', 'number', 'six', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '七', 'なな', 'number', 'seven (reading しち also exists)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '八', 'はち', 'number', 'eight', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '九', 'きゅう', 'number', 'nine', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '十', 'じゅう', 'number', 'ten', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '百', 'ひゃく', 'number', 'hundred', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '千', 'せん', 'number', 'thousand', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '万', 'まん', 'number', 'ten thousand', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '円', 'えん', 'counter', 'yen; circles', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('ja', '半', 'はん', 'number', 'half', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (JLPT N5-level) vocabulary, transcribed by the project team - verify before relying on it.'),
  -- Chinese: pronouns, function words (HSK 1-3 level)
  ('zh', '我', 'wǒ', 'pronoun', 'I; me', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '你', 'nǐ', 'pronoun', 'you', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '您', 'nín', 'pronoun', 'you (polite)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '他', 'tā', 'pronoun', 'he', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '她', 'tā', 'pronoun', 'she', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '我们', 'wǒmen', 'pronoun', 'we', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '这', 'zhè', 'pronoun', 'this', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '那', 'nà', 'pronoun', 'that', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '哪', 'nǎ', 'pronoun', 'which; where', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '什么', 'shénme', 'pronoun', 'what', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '谁', 'shéi', 'pronoun', 'who', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '哪里', 'nǎlǐ', 'pronoun', 'where', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '怎么', 'zěnme', 'pronoun', 'how; why', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '为什么', 'wèishénme', 'adverb', 'why', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '多少', 'duōshǎo', 'pronoun', 'how much / how many', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '的', 'de', 'particle', 'possessive / attributive particle', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '了', 'le', 'particle', 'completion / change-of-state particle', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '是', 'shì', 'verb', 'to be (equational)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '在', 'zài', 'verb', 'to be at; at (location)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '有', 'yǒu', 'verb', 'to have; there is', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '不', 'bù', 'adverb', 'not', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '没', 'méi', 'adverb', 'not have; not (past)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '很', 'hěn', 'adverb', 'very', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '也', 'yě', 'adverb', 'also', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '都', 'dōu', 'adverb', 'all; both', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '就', 'jiù', 'adverb', 'then; precisely', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '和', 'hé', 'conjunction', 'and; with', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '个', 'gè', 'classifier', 'general measure word', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '会', 'huì', 'verb', 'can; to know how to; will', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '能', 'néng', 'verb', 'can; to be able to', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '想', 'xiǎng', 'verb', 'to want to; to think; to miss', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '说', 'shuō', 'verb', 'to speak; to say', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '看', 'kàn', 'verb', 'to see; to watch; to read', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '听', 'tīng', 'verb', 'to listen; to hear', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '读', 'dú', 'verb', 'to read', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '写', 'xiě', 'verb', 'to write', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '吃', 'chī', 'verb', 'to eat', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '喝', 'hē', 'verb', 'to drink', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '去', 'qù', 'verb', 'to go', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '来', 'lái', 'verb', 'to come', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '买', 'mǎi', 'verb', 'to buy', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '卖', 'mài', 'verb', 'to sell', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '做', 'zuò', 'verb', 'to do; to make', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '用', 'yòng', 'verb', 'to use', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '给', 'gěi', 'verb', 'to give; for', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '找', 'zhǎo', 'verb', 'to look for; to find', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '知道', 'zhīdào', 'verb', 'to know', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '学习', 'xuéxí', 'verb', 'to study; to learn', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '工作', 'gōngzuò', 'verb', 'to work; job', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '住', 'zhù', 'verb', 'to live (reside)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '睡觉', 'shuìjiào', 'verb', 'to sleep', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '起床', 'qǐchuáng', 'verb', 'to get up', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '喜欢', 'xǐhuan', 'verb', 'to like', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '爱', 'ài', 'verb', 'to love', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '走', 'zǒu', 'verb', 'to walk; to leave', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '跑', 'pǎo', 'verb', 'to run', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '开', 'kāi', 'verb', 'to open; to drive', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '关', 'guān', 'verb', 'to close; to turn off', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '等', 'děng', 'verb', 'to wait; and so on', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '坐', 'zuò', 'verb', 'to sit; to travel by', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '教', 'jiāo', 'verb', 'to teach', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '问', 'wèn', 'verb', 'to ask', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '回答', 'huídá', 'verb', 'to answer', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  -- common Chinese adjectives
  ('zh', '大', 'dà', 'adjective', 'big; large', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '小', 'xiǎo', 'adjective', 'small; little', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '新', 'xīn', 'adjective', 'new', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '旧', 'jiù', 'adjective', 'old (things)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '老', 'lǎo', 'adjective', 'old (people); venerable', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '好', 'hǎo', 'adjective', 'good; well', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '坏', 'huài', 'adjective', 'bad; broken', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '贵', 'guì', 'adjective', 'expensive; honored', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '便宜', 'piányi', 'adjective', 'cheap', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '高', 'gāo', 'adjective', 'tall; high', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '长', 'cháng', 'adjective', 'long', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '快', 'kuài', 'adjective', 'fast; quick', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '慢', 'màn', 'adjective', 'slow', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '早', 'zǎo', 'adjective', 'early; morning', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '晚', 'wǎn', 'adjective', 'late; evening', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '热', 'rè', 'adjective', 'hot', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '冷', 'lěng', 'adjective', 'cold', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '忙', 'máng', 'adjective', 'busy', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '难', 'nán', 'adjective', 'difficult', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '容易', 'róngyì', 'adjective', 'easy', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '多', 'duō', 'adjective', 'many; much', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '少', 'shǎo', 'adjective', 'few; little', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '漂亮', 'piàoliang', 'adjective', 'pretty', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '高兴', 'gāoxìng', 'adjective', 'happy; glad', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '累', 'lèi', 'adjective', 'tired', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '饿', 'è', 'adjective', 'hungry', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  -- common Chinese nouns
  ('zh', '人', 'rén', 'noun', 'person', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '家', 'jiā', 'noun', 'home; family; measure for businesses', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '房子', 'fángzi', 'noun', 'house', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '学校', 'xuéxiào', 'noun', 'school', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '老师', 'lǎoshī', 'noun', 'teacher', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '学生', 'xuésheng', 'noun', 'student', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '朋友', 'péngyou', 'noun', 'friend', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '名字', 'míngzi', 'noun', 'name', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '今天', 'jīntiān', 'noun', 'today', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '明天', 'míngtiān', 'noun', 'tomorrow', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '昨天', 'zuótiān', 'noun', 'yesterday', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '现在', 'xiànzài', 'noun', 'now', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '时间', 'shíjiān', 'noun', 'time', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '年', 'nián', 'noun', 'year', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '月', 'yuè', 'noun', 'month; moon', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '日', 'rì', 'noun', 'day; sun', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '天', 'tiān', 'noun', 'day; sky', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '早上', 'zǎoshang', 'noun', 'morning', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '晚上', 'wǎnshang', 'noun', 'evening', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '中午', 'zhōngwǔ', 'noun', 'noon', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '水', 'shuǐ', 'noun', 'water', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '茶', 'chá', 'noun', 'tea', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '饭', 'fàn', 'noun', 'rice; meal', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '早饭', 'zǎofàn', 'noun', 'breakfast', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team to support the seeded Chinese reading texts - verify before relying on it.'),
  ('zh', '午饭', 'wǔfàn', 'noun', 'lunch', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '晚饭', 'wǎnfàn', 'noun', 'dinner', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '肉', 'ròu', 'noun', 'meat', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '鱼', 'yú', 'noun', 'fish', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '水果', 'shuǐguǒ', 'noun', 'fruit', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '妈妈', 'māma', 'noun', 'mom', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '爸爸', 'bàba', 'noun', 'dad', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '孩子', 'háizi', 'noun', 'child', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '儿子', 'érzi', 'noun', 'son', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '女儿', 'nǚ''ér', 'noun', 'daughter', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '猫', 'māo', 'noun', 'cat', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '狗', 'gǒu', 'noun', 'dog', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '书', 'shū', 'noun', 'book', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '汉字', 'hànzì', 'noun', 'Chinese character', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '中文', 'zhōngwén', 'noun', 'Chinese language', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '东西', 'dōngxi', 'noun', 'thing; stuff', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '地方', 'dìfang', 'noun', 'place', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '天气', 'tiānqì', 'noun', 'weather', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '钱', 'qián', 'noun', 'money', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '医院', 'yīyuàn', 'noun', 'hospital', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '医生', 'yīshēng', 'noun', 'doctor', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '商店', 'shāngdiàn', 'noun', 'shop', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '车站', 'chēzhàn', 'noun', 'station', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '火车', 'huǒchē', 'noun', 'train', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '飞机', 'fēijī', 'noun', 'airplane', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '电话', 'diànhuà', 'noun', 'telephone', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '电影', 'diànyǐng', 'noun', 'movie', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '音乐', 'yīnyuè', 'noun', 'music', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '电脑', 'diànnǎo', 'noun', 'computer', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '手机', 'shǒujī', 'noun', 'mobile phone', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '国家', 'guójiā', 'noun', 'country', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '世界', 'shìjiè', 'noun', 'world', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '图书馆', 'túshūguǎn', 'noun', 'library', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team to support the seeded Chinese reading text (我的一天) - verify before relying on it.'),
  ('zh', '操场', 'cāochǎng', 'noun', 'sports ground', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team to support the seeded Chinese reading text (我的一天) - verify before relying on it.'),
  ('zh', '数学', 'shùxué', 'noun', 'mathematics', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team to support the seeded Chinese reading text (我的一天) - verify before relying on it.'),
  ('zh', '语文', 'yǔwén', 'noun', 'Chinese language (school subject)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team to support the seeded Chinese reading text (我的一天) - verify before relying on it.'),
  ('zh', '课', 'kè', 'noun', 'class; lesson', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team to support the seeded Chinese reading text (我的一天) - verify before relying on it.'),
  ('zh', '闹钟', 'nàozhōng', 'noun', 'alarm clock', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team to support the seeded Chinese reading text (我的一天) - verify before relying on it.'),
  ('zh', '洗脸', 'xǐliǎn', 'verb', 'to wash one''s face', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team to support the seeded Chinese reading text (我的一天) - verify before relying on it.'),
  ('zh', '刷牙', 'shuāyá', 'verb', 'to brush one''s teeth', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team to support the seeded Chinese reading text (我的一天) - verify before relying on it.'),
  ('zh', '舒服', 'shūfu', 'adjective', 'comfortable', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team to support the seeded Chinese reading text (我的一天) - verify before relying on it.'),
  ('zh', '睡觉', 'shuìjiào', 'verb', 'to sleep', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  -- numbers
  ('zh', '一', 'yī', 'number', 'one', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '二', 'èr', 'number', 'two', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '三', 'sān', 'number', 'three', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '四', 'sì', 'number', 'four', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '五', 'wǔ', 'number', 'five', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '六', 'liù', 'number', 'six', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '七', 'qī', 'number', 'seven', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '八', 'bā', 'number', 'eight', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '九', 'jiǔ', 'number', 'nine', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '十', 'shí', 'number', 'ten', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '点', 'diǎn', 'classifier', 'o''clock; point; drop', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.'),
  ('zh', '半', 'bàn', 'number', 'half', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: standard beginner (HSK 1-3 level) vocabulary, transcribed by the project team - verify before relying on it.')
ON CONFLICT (language_code, term) DO NOTHING;

-- ---------------------------------------------------------------
-- Reading layer (phase 3 hardening): everyday + literary vocabulary
-- with readings, so furigana/pinyin annotate ordinary imported texts
-- (not only texts that carry inline annotations) and dictionary
-- segmentation keeps improving. Idempotent like every block above.
-- ---------------------------------------------------------------
INSERT INTO knowledge.lexicon (language_code, term, reading, part_of_speech, definition, gloss_language, provenance, source_url, license, source_ref) VALUES
  ('ja', '思う', 'おもう', 'verb', 'to think; to feel', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '出来る', 'できる', 'verb', 'to be able to; can do', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '云う', 'いう', 'verb', 'to say (literary spelling of 言う)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '見える', 'みえる', 'verb', 'to be visible; to appear', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '聞こえる', 'きこえる', 'verb', 'to be audible', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '置く', 'おく', 'verb', 'to put; to place', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '送る', 'おくる', 'verb', 'to send; to see off', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '迎える', 'むかえる', 'verb', 'to welcome; to greet', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '決める', 'きめる', 'verb', 'to decide', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '決まる', 'きまる', 'verb', 'to be decided; to settle', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '集まる', 'あつまる', 'verb', 'to gather; to assemble', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '集める', 'あつめる', 'verb', 'to collect', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '過ぎる', 'すぎる', 'verb', 'to pass (time); to exceed', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '終わる', 'おわる', 'verb', 'to end; to finish', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '始まる', 'はじまる', 'verb', 'to begin', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '始める', 'はじめる', 'verb', 'to start (something)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '続く', 'つづく', 'verb', 'to continue', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '残る', 'のこる', 'verb', 'to remain; to be left', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '消える', 'きえる', 'verb', 'to disappear', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '動く', 'うごく', 'verb', 'to move', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '止まる', 'とまる', 'verb', 'to stop; to halt', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '忘れる', 'わすれる', 'verb', 'to forget', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '着る', 'きる', 'verb', 'to wear (upper body)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '脱ぐ', 'ぬぐ', 'verb', 'to take off (clothes)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '洗う', 'あらう', 'verb', 'to wash', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '直す', 'なおす', 'verb', 'to fix; to repair', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '壊れる', 'こわれる', 'verb', 'to break', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '落とす', 'おとす', 'verb', 'to drop; to let fall', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '拾う', 'ひろう', 'verb', 'to pick up', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '押す', 'おす', 'verb', 'to push; to press', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '引く', 'ひく', 'verb', 'to pull', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '数える', 'かぞえる', 'verb', 'to count', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '建てる', 'たてる', 'verb', 'to build', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '売れる', 'うれる', 'verb', 'to sell (intransitive)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '届く', 'とどく', 'verb', 'to reach; to be delivered', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '届ける', 'とどける', 'verb', 'to deliver', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '調べる', 'しらべる', 'verb', 'to investigate; to look up', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '比べる', 'くらべる', 'verb', 'to compare', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '確める', 'たしかめる', 'verb', 'to make sure; to confirm', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '助ける', 'たすける', 'verb', 'to help; to rescue', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '守る', 'まもる', 'verb', 'to protect', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '選ぶ', 'えらぶ', 'verb', 'to choose', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '貸す', 'かす', 'verb', 'to lend', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '借りる', 'かりる', 'verb', 'to borrow', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '探す', 'さがす', 'verb', 'to search for; to look for', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '笑う', 'わらう', 'verb', 'to laugh; to smile', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '怒る', 'おこる', 'verb', 'to get angry', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '困る', 'こまる', 'verb', 'to be troubled', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '驚く', 'おどろく', 'verb', 'to be surprised', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '眠る', 'ねむる', 'verb', 'to sleep; to lie dead', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '死ぬ', 'しぬ', 'verb', 'to die', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '生きる', 'いきる', 'verb', 'to live', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '生まれる', 'うまれる', 'verb', 'to be born', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '老いる', 'おいる', 'verb', 'to grow old', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '許す', 'ゆるす', 'verb', 'to forgive; to allow', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '気', 'き', 'noun', 'spirit; mood; attention', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '気持ち', 'きもち', 'noun', 'feeling; mood', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '様子', 'ようす', 'noun', 'state; appearance', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '声', 'こえ', 'noun', 'voice', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '音', 'おと', 'noun', 'sound; noise', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '場所', 'ばしょ', 'noun', 'place', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '近く', 'ちかく', 'noun', 'nearby', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '向こう', 'むこう', 'noun', 'beyond; the other side', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '外', 'そと', 'noun', 'outside', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '中', 'なか', 'noun', 'inside; middle', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '間', 'あいだ', 'noun', 'interval; between', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '隣', 'となり', 'noun', 'next door; neighbor', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '俺', 'おれ', 'pronoun', 'I (rough, masculine)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '達', 'たち', 'suffix', 'plural marker for people', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '方', 'ほう', 'noun', 'direction; person (polite)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '誰か', 'だれか', 'pronoun', 'someone', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '何か', 'なにか', 'pronoun', 'something', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '何故', 'なぜ', 'adverb', 'why (literary spelling)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '沢山', 'たくさん', 'adverb', 'many; a lot (kanji spelling)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '一緒', 'いっしょ', 'noun', 'together', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '将来', 'しょうらい', 'noun', 'future', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '最近', 'さいきん', 'noun', 'recently', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '昔', 'むかし', 'noun', 'long ago; the past', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '昔話', 'むかしばなし', 'noun', 'old tale; folk story', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '世話', 'せわ', 'noun', 'care; looking after', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '迷惑', 'めいわく', 'noun', 'nuisance; trouble', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '都合', 'つごう', 'noun', 'convenience; circumstances', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '様々', 'さまざま', 'adjective', 'various (kanji spelling)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '一体', 'いったい', 'adverb', 'in the world; on earth (emphasis)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '結局', 'けっきょく', 'adverb', 'after all; in the end', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '特に', 'とくに', 'adverb', 'especially', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '上手', 'じょうず', 'adjective', 'skillful; good at', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '下手', 'へた', 'adjective', 'clumsy; bad at', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '真面目', 'まじめ', 'adjective', 'serious; earnest', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '大変', 'たいへん', 'adverb', 'very; terrible; tough', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '無理', 'むり', 'noun', 'impossible; overdoing', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '有難い', 'ありがたい', 'adjective', 'grateful; welcome', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '幸せ', 'しあわせ', 'noun', 'happiness; fortune', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '悲しい', 'かなしい', 'adjective', 'sad', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '寂しい', 'さみしい', 'adjective', 'lonely', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '苦しい', 'くるしい', 'adjective', 'painful; difficult', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '面倒', 'めんどう', 'noun', 'trouble; bother', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '心配', 'しんぱい', 'noun', 'worry; anxiety', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '騒ぐ', 'さわぐ', 'verb', 'to make noise; to riot', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '慌てる', 'あわてる', 'verb', 'to be flustered; to hurry', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '眠い', 'ねむい', 'adjective', 'sleepy', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '夢', 'ゆめ', 'noun', 'dream', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '現実', 'げんじつ', 'noun', 'reality', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '理由', 'りゆう', 'noun', 'reason', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '目的', 'もくてき', 'noun', 'purpose; goal', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '意味', 'いみ', 'noun', 'meaning', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '興味', 'きょうみ', 'noun', 'interest', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '質問', 'しつもん', 'noun', 'question', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '答え', 'こたえ', 'noun', 'answer', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '例', 'れい', 'noun', 'example', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '説明', 'せつめい', 'noun', 'explanation', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '約束', 'やくそく', 'noun', 'promise; appointment', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '嘘', 'うそ', 'noun', 'lie', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '本当', 'ほんとう', 'noun', 'truth; really', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '大事', 'だいじ', 'adjective', 'important', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '大切', 'たいせつ', 'adjective', 'precious; important', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '窓', 'まど', 'noun', 'window', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '鍵', 'かぎ', 'noun', 'key; lock', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '布団', 'ふとん', 'noun', 'futon; bedding', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '風呂', 'ふろ', 'noun', 'bath', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '着物', 'きもの', 'noun', 'kimono', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '袋', 'ふくろ', 'noun', 'bag; sack', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '箱', 'はこ', 'noun', 'box', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '皿', 'さら', 'noun', 'plate; dish', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '茶碗', 'ちゃわん', 'noun', 'rice bowl; teacup', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '台所', 'だいどころ', 'noun', 'kitchen', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '池', 'いけ', 'noun', 'pond', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '町', 'まち', 'noun', 'town', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '村', 'むら', 'noun', 'village', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '畑', 'はたけ', 'noun', 'field (crops)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '林', 'はやし', 'noun', 'woods; grove', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '森', 'もり', 'noun', 'forest', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '島', 'しま', 'noun', 'island', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '岸', 'きし', 'noun', 'shore; bank', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '波', 'なみ', 'noun', 'wave', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '浜', 'はま', 'noun', 'beach; shore', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '船', 'ふね', 'noun', 'boat; ship', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '星', 'ほし', 'noun', 'star', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '曜日', 'ようび', 'noun', 'day of the week', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '毎日', 'まいにち', 'noun', 'every day', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '今晩', 'こんばん', 'noun', 'this evening', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '今朝', 'けさ', 'noun', 'this morning', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '春', 'はる', 'noun', 'spring (season)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '夏', 'なつ', 'noun', 'summer', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '秋', 'あき', 'noun', 'autumn', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '冬', 'ふゆ', 'noun', 'winter', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '涼しい', 'すずしい', 'adjective', 'cool; refreshing', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '暖かい', 'あたたかい', 'adjective', 'warm', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '曇り', 'くもり', 'noun', 'cloudiness; cloudy weather', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '嵐', 'あらし', 'noun', 'storm', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '雷', 'かみなり', 'noun', 'thunder; lightning', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '霧', 'きり', 'noun', 'fog; mist', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '虹', 'にじ', 'noun', 'rainbow', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '光', 'ひかり', 'noun', 'light', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '影', 'かげ', 'noun', 'shadow; shade', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '匂い', 'におい', 'noun', 'smell; odor', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '味', 'あじ', 'noun', 'taste; flavor', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '腹', 'はら', 'noun', 'belly; stomach', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '背中', 'せなか', 'noun', 'back (of body)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '肩', 'かた', 'noun', 'shoulder', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '指', 'ゆび', 'noun', 'finger; toe', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '髪', 'かみ', 'noun', 'hair', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '顔', 'かお', 'noun', 'face', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '笑顔', 'えがお', 'noun', 'smiling face', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '涙', 'なみだ', 'noun', 'tears', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '息', 'いき', 'noun', 'breath', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '血', 'ち', 'noun', 'blood', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '骨', 'ほね', 'noun', 'bone', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '命', 'いのち', 'noun', 'life; fate', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '結婚', 'けっこん', 'noun', 'marriage', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '恋', 'こい', 'noun', 'romantic love', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '愛', 'あい', 'noun', 'love', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '罪', 'つみ', 'noun', 'sin; crime', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '法', 'ほう', 'noun', 'law', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '警察', 'けいさつ', 'noun', 'police', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '戦争', 'せんそう', 'noun', 'war', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '兵士', 'へいし', 'noun', 'soldier', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '刀', 'かたな', 'noun', 'sword; katana', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '馬', 'うま', 'noun', 'horse', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '牛', 'うし', 'noun', 'cow; cattle', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '豚', 'ぶた', 'noun', 'pig', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '鶏', 'にわとり', 'noun', 'chicken', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '蛇', 'へび', 'noun', 'snake', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '蜂', 'はち', 'noun', 'bee', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '蝶', 'ちょう', 'noun', 'butterfly', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '猿', 'さる', 'noun', 'monkey', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '蜘蛛', 'くも', 'noun', 'spider', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '雲', 'くも', 'noun', 'cloud', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '埃', 'ほこり', 'noun', 'dust', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '葉', 'は', 'noun', 'leaf', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '根', 'ね', 'noun', 'root', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '実', 'み', 'noun', 'fruit; nut; seed', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '蜜', 'みつ', 'noun', 'honey', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '醤油', 'しょうゆ', 'noun', 'soy sauce', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '塩', 'しお', 'noun', 'salt', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '砂糖', 'さとう', 'noun', 'sugar', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '米', 'こめ', 'noun', 'rice (uncooked)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '麦', 'むぎ', 'noun', 'wheat; barley', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '餅', 'もち', 'noun', 'rice cake (mochi)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '汁', 'しる', 'noun', 'soup; broth', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '鍋', 'なべ', 'noun', 'pot; pan', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '竹', 'たけ', 'noun', 'bamboo', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '松', 'まつ', 'noun', 'pine tree', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '桜', 'さくら', 'noun', 'cherry blossom', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '桃', 'もも', 'noun', 'peach', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '梨', 'なし', 'noun', 'pear', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '柿', 'かき', 'noun', 'persimmon', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '栗', 'くり', 'noun', 'chestnut', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '梅', 'うめ', 'noun', 'Japanese plum', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '其れ', 'それ', 'pronoun', 'that (literary)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '其の', 'その', 'determiner', 'that ... (literary)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '其処', 'そこ', 'pronoun', 'there (literary)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '何処', 'どこ', 'pronoun', 'where (literary)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '之', 'これ', 'pronoun', 'this (literary)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '是', 'これ', 'pronoun', 'this (literary)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '此', 'この', 'determiner', 'this ... (literary)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '吾', 'われ', 'pronoun', 'I; oneself (literary)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '我', 'われ', 'pronoun', 'I; oneself (literary)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '我輩', 'わがはい', 'pronoun', 'I (haughty, literary)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '汝', 'なんじ', 'pronoun', 'you (archaic)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '爺', 'じじい', 'noun', 'old man (archaic)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '婆', 'ばば', 'noun', 'old woman (archaic)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '旦那', 'だんな', 'noun', 'master of the house; boss', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '坊主', 'ぼうず', 'noun', 'boy; priest; bald person', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '者', 'もの', 'noun', 'person (literary)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('ja', '処', 'ところ', 'noun', 'place (literary spelling of 所)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: everyday and literary vocabulary for the furigana/segmentation layer (JLPT N4-N3 plus classic-literature forms), transcribed by the project team - verify before relying on it.'),
  ('zh', '时候', 'shíhou', 'noun', 'time; moment', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '觉得', 'juéde', 'verb', 'to think; to feel', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '已经', 'yǐjīng', 'adverb', 'already', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '还是', 'háishi', 'adverb', 'still; or (in questions)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '因为', 'yīnwèi', 'conjunction', 'because', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '所以', 'suǒyǐ', 'conjunction', 'therefore', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '但是', 'dànshì', 'conjunction', 'but; however', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '如果', 'rúguǒ', 'conjunction', 'if', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '一起', 'yìqǐ', 'adverb', 'together', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '大家', 'dàjiā', 'pronoun', 'everyone', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '先生', 'xiānsheng', 'noun', 'Mr.; teacher; gentleman', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '小姐', 'xiǎojiě', 'noun', 'Miss; young lady', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '钱包', 'qiánbāo', 'noun', 'wallet', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '衣服', 'yīfu', 'noun', 'clothes', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '裤子', 'kùzi', 'noun', 'trousers', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '鞋子', 'xiézi', 'noun', 'shoes', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '帽子', 'màozi', 'noun', 'hat; cap', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '眼睛', 'yǎnjing', 'noun', 'eye', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '鼻子', 'bízi', 'noun', 'nose', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '嘴巴', 'zuǐba', 'noun', 'mouth', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '耳朵', 'ěrduo', 'noun', 'ear', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '头发', 'tóufa', 'noun', 'hair', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '身体', 'shēntǐ', 'noun', 'body; health', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '护士', 'hùshi', 'noun', 'nurse', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '报纸', 'bàozhǐ', 'noun', 'newspaper', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '杂志', 'zázhì', 'noun', 'magazine', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '故事', 'gùshi', 'noun', 'story; tale', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '小说', 'xiǎoshuō', 'noun', 'novel; fiction', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '历史', 'lìshǐ', 'noun', 'history', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '问题', 'wèntí', 'noun', 'question; problem', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '办法', 'bànfǎ', 'noun', 'way; method; solution', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '时候', 'shíhou', 'noun', 'time (canonical pinyin form)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '公司', 'gōngsī', 'noun', 'company; firm', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '银行', 'yínháng', 'noun', 'bank', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '邮局', 'yóujú', 'noun', 'post office', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '公园', 'gōngyuán', 'noun', 'park', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '城市', 'chéngshì', 'noun', 'city', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '农村', 'nóngcūn', 'noun', 'countryside; village', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '路上', 'lùshang', 'noun', 'on the road; on the way', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '自行车', 'zìxíngchē', 'noun', 'bicycle', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '地铁站', 'dìtiězhàn', 'noun', 'subway station', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '一下', 'yíxià', 'classifier', '(do sth) once; briefly', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '一点儿', 'yìdiǎnr', 'classifier', 'a little; a bit', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '非常', 'fēicháng', 'adverb', 'very; extremely', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '特别', 'tèbié', 'adverb', 'especially; particular', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '奇怪', 'qíguài', 'adjective', 'strange; odd', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '害怕', 'hàipà', 'verb', 'to be afraid', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '难过', 'nánguò', 'adjective', 'sad; feeling bad', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '着急', 'zháojí', 'adjective', 'worried; anxious', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '希望', 'xīwàng', 'verb', 'to hope; to wish', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '记得', 'jìde', 'verb', 'to remember', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '忘记', 'wàngjì', 'verb', 'to forget', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '开始', 'kāishǐ', 'verb', 'to begin; start', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '准备', 'zhǔnbèi', 'verb', 'to prepare', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '帮助', 'bāngzhù', 'verb', 'to help', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '告诉', 'gàosu', 'verb', 'to tell', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '说话', 'shuōhuà', 'verb', 'to speak; to talk', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '听见', 'tīngjiàn', 'verb', 'to hear (a sound)', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '看见', 'kànjiàn', 'verb', 'to see; to catch sight of', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '洗澡', 'xǐzǎo', 'verb', 'to take a shower or bath', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.'),
  ('zh', '做饭', 'zuòfàn', 'verb', 'to cook a meal', 'en', 'community', NULL, 'mit', 'Core lexicon written for this seed: high-frequency everyday vocabulary for the pinyin/segmentation layer (HSK 3-4), transcribed by the project team - verify before relying on it.')
ON CONFLICT (language_code, term) DO NOTHING;
