-- =====================================================================
-- Linguarium seed data
--
-- Seeds fall into two honest categories:
--   1. Public-domain classics (provenance 'verified', source_ref given).
--      These are real, checkable texts used to demonstrate the reading
--      environment.
--   2. Demonstration content written by this project (provenance
--      'community', source_ref 'Linguarium demonstration content').
--      It illustrates format and features only. Replace it with real,
--      properly licensed content before running a production community.
--
-- Content provenance levels used across the app:
--   verified   - checked against the cited source
--   community  - community maintained, not independently verified
--   automated  - produced by automatic analysis (e.g. difficulty scores)
--   ai         - AI generated, explicitly unverified
--   user       - the user's own notes or imports
-- =====================================================================

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
INSERT INTO knowledge.shared_texts (language_code, title, body, author, license, provenance, source_ref) VALUES
  (
    'la',
    'De Bello Gallico I.1 (opening)',
    $$Gallia est omnis divisa in partes tres, quarum unam incolunt Belgae, aliam Aquitani, tertiam qui ipsorum lingua Celtae, nostra Galli appellantur. Hi omnes lingua, institutis, legibus inter se differunt. Gallos ab Aquitanis Garumna flumen, a Belgis Matrona et Sequana dividit. Horum omnium fortissimi sunt Belgae.$$,
    'Gaius Iulius Caesar',
    'public-domain',
    'verified',
    'Commentarii de Bello Gallico, book 1, chapter 1 (composed ~50 BCE, public domain)'
  ),
  (
    'de',
    'Hänsel und Gretel (opening)',
    $$Vor einem großen Walde wohnte ein armer Holzhacker mit seiner Frau und seinen zwei Kindern. Das Bübchen hieß Hänsel und das Mädchen Gretel. Er hatte wenig zu beißen und zu brechen, und einmal, als große Teuerung ins Land kam, konnte er das tägliche Brot nicht mehr schaffen. Wie er sich nun abends ins Bett legte und seine Sorgen nachdachte, sprach er zur Frau: "Was soll aus uns werden? Wie können wir unsere Kinder ernähren, da wir für uns selbst nichts mehr haben?"$$,
    'Brüder Grimm',
    'public-domain',
    'verified',
    'Kinder- und Hausmärchen, no. 15, 1857 edition (public domain)'
  ),
  (
    'en',
    'The North Wind and the Sun',
    $$The North Wind and the Sun were disputing which was the stronger, when a traveler came along wrapped in a warm cloak. They agreed that the one who first succeeded in making the traveler take his cloak off should be considered stronger than the other. Then the North Wind blew as hard as he could, but the more he blew the more closely did the traveler fold his cloak around him. At last the North Wind gave up the attempt. Then the Sun shone out warmly, and immediately the traveler took off his cloak. And so the North Wind was obliged to confess that the Sun was the stronger of the two.$$,
    'Aesop (Perry 46)',
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
    'unspecified (demo)',
    'community',
    'Original demonstration text written for this project. Simple sentences used to showcase the reading environment for a minimal constructed language.'
  )
ON CONFLICT DO NOTHING;

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
ON CONFLICT DO NOTHING;
