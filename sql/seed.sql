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
