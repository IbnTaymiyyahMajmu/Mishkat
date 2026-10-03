# Data needed

What the site is missing, why it matters, and what a usable delivery looks like.

Everything here is **content**, not code. The application already has a slot for
each item; supplying the data fills the slot. Where something is currently
falling back to the Quran.com corpus, the site says so on screen rather than
passing it off as its own.

Ordered by how much each one improves the product per unit of effort.

---

## 1. Surah introductions — the one you already spotted

**Status.** Falling back to Quran.com's `chapter_info`. You are right that it is
not enough: it is uneven (some surahs get four paragraphs, some get two
sentences), inconsistent in register, and written for a different product.

**Where it goes.** `src/content/surah-intros.json`. Schema and a worked example
are in `src/content/README.md`. Anything you put there replaces the fallback for
that surah and is attributed to the source you name.

**What to send.** Per surah:

| Field | Required | Notes |
|---|---|---|
| `paragraphs` | yes | Plain text, one string per paragraph. 3–6 paragraphs reads well. |
| `source` | yes | Printed under the introduction. An unattributed introduction is not published — the loader drops entries without it. |
| `sourceUrl` | no | Makes the attribution a link. |
| `revealed` | no | `"Meccan"` / `"Medinan"`, if you want to override the corpus. |
| `themes` | no | 2–4 short tags, shown beside the surah name. |
| `arabicParagraphs` | no | Set right-to-left after the English. |

**Useful shape for each introduction**, if you want a house style: when and where
it was revealed and what was happening; the central subject; how it is
structured; its relation to the surahs either side of it; anything specifically
narrated about reciting it.

**Volume.** 114 entries. It is worth saying clearly: these can arrive one at a
time. Each entry improves its own surah and nothing else breaks. Start with the
ones people open most — al-Fātiḥah, al-Baqarah, Yā-Sīn, al-Kahf, al-Raḥmān,
al-Mulk, and juz' 'amma.

**Format I can take directly.** JSON in the schema above, or a spreadsheet with
columns `surah, source, sourceUrl, revealed, themes, paragraph1..paragraph6` —
I will convert it.

---

## 2. Tafsir corpora, as texts rather than as an API

**Status.** Twenty-two works, from three places, shown as one library. Five are
served **per ayah** from Quran.com: Ibn Kathīr (abridged), Maʿārif al-Qurʾān,
Tazkirul Qurʾān, al-Saʿdī, al-Muyassar. Two short works in English come from the
Tafsir API. Fifteen works in Arabic are held on the site itself: the thirteen of
the classical shelf, and the Arabic of those two short works. The last two
sources are set out at the end of this section.

**Two limits this creates.**

1. **No tafsir search.** The Tafsir tab in the search overlay is present but
   disabled, and says why. Searching inside tafsir needs the works as text to
   index; an endpoint that answers "what does Ibn Kathīr say about 2:255"
   cannot answer "where does Ibn Kathīr discuss *ribā*".
2. **Abridgements.** What is served for Ibn Kathīr is the abridged English, not
   the full Arabic.

**What to send.** For each work: the full text keyed by ayah (`surah:ayah` →
passage), plus the edition metadata — book title, author, death date, editor,
publisher, year, and the licence or permission under which it can be shown.
JSON, JSONL, SQLite or plain files in a per-surah folder all work equally well.

**Which works** is now your decision rather than the corpus's, for the
classical shelf: see below. The five from Quran.com are still what that corpus
happened to offer.

### The Tafsir API — two short works in English

`github.com/spa5k/tafsir_api` is a collection of 123 tafsir editions as static
files that any site may read. You asked whether it would help; it does, for
English, which tafsir.app has none of. Two editions are taken, each checked
ayah against ayah first:

| Work | Why |
|---|---|
| **al-Mukhtaṣar** (Markaz Tafsīr), in English | A plain paragraph per ayah. It is now the first thing a new reader sees, so that opening tafsir answers at once |
| **al-Jalālayn**, translated by Feras Hamza | The most widely taught short tafsir, phrase by phrase |

**What was left, and why** — the collection is uneven, and this is worth
knowing before anyone reaches for more of it:

- Its **Arabic** editions are the same texts tafsir.app holds, without the
  record of which ayat a passage covers, and with ayat missing inside grouped
  passages. tafsir.app is the better source for all of them.
- Its **Asbāb al-Nuzūl** is corrupted: several ayat carry another book's text
  under al-Wāḥidī's name (the entry on 2:2 is from a Sufi commentary), and 55
  entries in al-Baqarah alone have damaged characters. Showing it would put
  words in his mouth, so it is not shown.
- Its other **al-Jalālayn** has lost its punctuation.
- Its English **Ibn Kathīr, Maʿārif and Tazkirul** are the three Quran.com
  already serves here, with their headings intact.
- The four **Sufi commentaries** — al-Tustarī, al-Qushayrī, Kāshānī, Kashf
  al-Asrār — are not sound either. Its al-Qushayrī and its Kāshānī serve the
  same text on ten of nineteen ayat sampled, its Kāshānī and its Asbāb
  al-Nuzūl the same on eleven of twelve, and in all four most entries have
  damaged characters — quotation marks and long vowels turned to `�` and `Ì`.
  Something there is under the wrong name, and it cannot be told from the
  files which.
- **Tanwīr al-Miqbās** is there in Arabic and in English, on every ayah, with
  damaged characters in about a quarter of the entries sampled. It is left out
  on other grounds as well: it is printed as the tafsir of Ibn ʿAbbās,
  and the chain it rests on is one the hadith scholars reject. Whether it
  belongs on this site, and under what description, is an editorial call and
  it is yours; it is one entry in `src/lib/quran/tafsir.ts`.

**Rights.** The repository's licence covers the collection, not the
translations in it, which are their translators' and publishers'. So these two
are read from the CDN and credited — translator named, source linked — and are
not copied into the site. If you want them held here as the classical library
is, that needs the publishers' word: Markaz Tafsīr for al-Mukhtaṣar, and the
Royal Aal al-Bayt Institute for Hamza's al-Jalālayn.

### tafsir.app — copied here, with Nuqayah's permission

**Status: done.** You asked for tafsir.app (الباحث القرآني, by Nuqayah) as the
source, obtained their permission to copy it, and then said which of it you
wanted: not everything, but the main work of each kind. Fifteen works are now
this site's own data — 337 MB.

**The shelf.** tafsir.app sorts its tafsir by what each sets out to do. All
four of its mother works are here, and Ibn ʿUthaymīn from the contemporary, as
you asked. For the rest I took one from each kind — the one that kind is best
known by:

| Kind (as tafsir.app names it) | Work | Why this one |
|---|---|---|
| The mother works · أمّهات | al-Ṭabarī, al-Baghawī, al-Qurṭubī, Ibn Kathīr | Yours: all four |
| Gathering the opinions · جمع الأقوال | Zād al-masīr, Ibn al-Jawzī | Sets every view side by side and names who held it; shorter and more ordered than al-Māwardī |
| Encyclopaedic · موسوعات | Mafātīḥ al-ghayb, al-Rāzī | The one the later encyclopaedic works, al-Ālūsī included, draw on |
| Concise · مركّزة العبارة | Anwār al-tanzīl, al-Bayḍāwī | The one you named, and the standard teaching text of its kind |
| Gathered from his works · منتقاة | Ibn al-Qayyim | The other, Ibn Taymiyya's, is not served ayah by ayah — every ayah sampled came back empty |
| Transmitted reports · آثار | al-Durr al-manthūr, al-Suyūṭī | The classical gathering of the reports from the early generations |
| General · عامّة | Fatḥ al-qadīr, al-Shawkānī | Joins narration and reasoning; the most used of the group |
| Language and rhetoric · لغة وبلاغة | al-Taḥrīr wa-l-tanwīr, Ibn ʿĀshūr | The fullest on balāgha, and takes in what al-Zamakhsharī began |
| The Qurʾan by the Qurʾan · أخرى | Aḍwāʾ al-bayān, al-Shinqīṭī | The work of that method |
| Contemporary · معاصرة | Ibn ʿUthaymīn | Yours |

**And two short works**, taken for a different reason: **al-Mukhtaṣar** and
**al-Jalālayn**. They are the two whose English the site already had, so
holding their Arabic makes each a work that can be read in either language.
They sit under "Briefly" on the Arabic shelf, with al-Muyassar and al-Saʿdī.

One that was close and is a line to add: **al-Kashshāf** (the foundation of the
linguistic school). Three do not cover every ayah, because
their authors did not: Ibn al-Qayyim (2,067 ayat), Aḍwāʾ al-bayān (2,320) and
Ibn ʿUthaymīn (3,456); the panel says so when a work has nothing on an ayah.

Every ayah also links to tafsir.app itself, where the other thirty works can be
opened on it.

Two of the Quran.com works were dropped as a result — its al-Ṭabarī and
al-Qurṭubī — since the site now holds both in a fuller form.

**How it is held.** `scripts/mirror-tafsir.mjs` copies each work into
`public/tafsir/<work>/`, so it ships inside the static export and is read
without anyone else's server being up:

| File | What it is |
|---|---|
| `index.json` | For each surah, which ayah each file of passages begins at |
| `<surah>-<ayah>.json` | The passages themselves, about 200 KB of text to a file |
| `about.json` | What tafsir.app records about the work: the author's own preface, and what was said of it |
| `../SOURCE.md` | Where all of it came from, work by work |

`src/content/tafsir-mirror.json` is the script's record of what was copied —
passages, size, a checksum of the text — and is how the build knows which works
it holds.

**What the copy is, exactly.** Each passage is stored as tafsir.app served it,
unaltered, against the ayat it covers: an author who takes fourteen ayat
together is stored once against all fourteen, and the panel says so. Editors'
footnotes and the printed editions' page markers are kept in the copy; the
panel sets the footnotes apart and leaves the page markers out, and that can be
decided differently later without copying anything again.

**Keeping it right.**

- `npm run mirror:tafsir` copies everything; name works to copy only those. It
  can be stopped and run again — a surah already fetched is not fetched twice.
- `npm run mirror:tafsir -- --verify` reads the copy back and checks it against
  the record: every file present, every passage in order, no ayah with two
  passages, the text matching its checksum. The deploy workflow runs it, so a
  copy that is incomplete does not get published.
- To take in corrections Nuqayah make later, run it again with `--force`.

**What I need from you on this.**

1. **Keep their permission in writing**, with the terms — whether it covers
   this site alone, and whether they want a particular form of credit. The
   credit is in the tafsir panel, on the settings page and in
   `public/tafsir/SOURCE.md`; if they would word it differently, it is three
   strings in `src/lib/quran/tafsirApp.ts`.
2. **Committing it.** The copy is 337 MB in about 2,800 files. That fits
   GitHub Pages, which publishes sites up to 1 GB, and it is what the deploy
   workflow expects to find in the repository. It will make the repository a
   few hundred megabytes heavier to clone; if you would rather it lived
   somewhere else — a repository of its own, or object storage — say so and I
   will set that up instead.
3. **Changing the shelf.** The list is `src/lib/quran/tafsirWorks.json`. Add a
   line and run `npm run mirror:tafsir` to take a work in; delete a line and
   run it to take one out — the script removes what the list no longer names.
4. **The rest of tafsir.app.** It also holds works of aḥkām, iʿrāb, qirāʾāt
   and gharīb, and the lexicons. None of that is copied. It answers different
   questions from tafsir and would want a place beside the word study.

**English for the Arabic works — what there is, and what there is not.** You
asked for every Arabic work to have its English, taken from the Tafsir API, and
said you have permission to use it in full. So the whole collection was gone
through: all 123 editions opened and read, two ayat from each, rather than taken
by their names. The names are what mislead. Its list calls its editions "Tafsir
al-Tabari", "Tafseer Al Qurtubi", "Tafsir Al-Razi" — English titles on Arabic
texts. What is actually inside, for the works on this site's shelves:

| Work | In the collection |
|---|---|
| al-Ṭabarī, al-Baghawī, al-Qurṭubī | Arabic only |
| Ibn al-Jawzī, al-Rāzī, al-Bayḍāwī, Ibn al-Qayyim, al-Durr al-manthūr, Fatḥ al-qadīr, Ibn ʿĀshūr, Aḍwāʾ al-bayān, Ibn ʿUthaymīn | Arabic only |
| al-Muyassar | Arabic only |
| al-Saʿdī | Arabic, and Russian, Urdu, Persian, Turkish, Indonesian, Albanian. No English |
| **Ibn Kathīr** | Arabic, and **English, abridged** |
| **al-Jalālayn** | Arabic, and **English** |
| **al-Mukhtaṣar** | Arabic, and **English** (and some thirty other languages) |

Thirteen of the 123 are in English at all. Five were already here. Of the other
eight, two are second copies of ones already here, five are damaged (above), and
one is Tanwīr al-Miqbās.

So three of the Arabic works have an English to be had, and all three are now
held in both languages. Each carries a switch — Arabic, English — and a way to
set the two side by side; the list marks them "+ English". For Ibn Kathīr that
was already so. For al-Jalālayn and al-Mukhtaṣar the English was here and the
Arabic was not, so their Arabic was copied in from tafsir.app.

**Decided: it stays there.** The other fourteen have no English in this
collection because none has been published whole, and you chose to leave them
as their authors wrote them rather than licence partial translations or
machine-translate. So the library is two shelves — English, five works; Arabic,
seventeen — shown one at a time, and nothing on the Arabic shelf apologises for
being in Arabic.

**Now possible, and not yet built: searching the tafsir.** Limit 1 above was
that the works were not held as text. Fifteen of them now are. A search across
them wants an index built at copy time rather than 337 MB scanned in a browser;
it is build work, not data. Say the word.

**Still there, as a fallback.** A work that is in the catalogue but not copied
is read through `NEXT_PUBLIC_TAFSIR_APP_BASE` if that is set (see
`scripts/tafsir-proxy.mjs`), and is a link to tafsir.app if it is not. With
every work in the catalogue copied, neither is used.

---

## 3. Morphology and the lexicons — **connected**

**Status: done.** The word study panel now breaks a word into its segments and
names the grammar of each, shows the root with its lemmas and its count across
the muṣḥaf, and prints the classical lexicon entries for that root — Arabic
first, translation under it, each under its author's own name and death date.

**And a page for reading it on.** A panel beside the text is the wrong shape for
several thousand words of Ibn Manẓūr, so `/study/?w=1:2:3` gives one word the
whole screen: the ayah it stands in with the word marked, the segments set apart
and colour-keyed by role, the root with its figures and every lemma grown from
it, every ayah the root occurs in with the carrying words marked, all the
lexicon entries in full, the Semitic cognates, and the sources. A rail down the
side says where you are and jumps between them. The panel links into it — into
the particular entry, if the reader was reading one.

It is one exported page, not 77,430: the word is a query rather than a path.

**Where it comes from.** Two layers, one API:

| Layer | Source |
|---|---|
| Grammar, root, lemma | The Quranic Arabic Corpus (Kais Dukes, Language Research Group, University of Leeds), decoded out of Buckwalter |
| Lexicons | Twelve classical works by root: al-Jawharī, Ibn Fāris, Ibn Sīda, al-Rāghib al-Iṣfahānī, al-Zamakhsharī, al-Rāzī, **Ibn Manẓūr (Lisān al-ʿArab)**, al-Fayyūmī, **al-Zabīdī (Tāj al-ʿArūs)**, **Lane**, Salmoné, and others |
| Cognates | Sister-Semitic attestations, kept in their own section and labelled as comparative philology rather than lexicography |

Both are served by **al-nuqta** (`al-nuqta.com`), a keyless open API. The one
file that knows this is `src/lib/quran/lexicon.ts`; replacing it replaces the
source and touches nothing else.

**What is deliberately not taken from it.** The same API also serves
machine-written prose — `ai_meaning` on a word, `ai-translation` on an ayah,
`detailed_meaning` and `primary_meaning` on a root. None of it is requested and
none of it is shown. A claim about the language carries the name of whoever
made it, or it does not appear. Where a root has no lexicon entry, the panel
says so and offers the scans instead.

**What is still worth deciding.**

1. **Licence.** The corpus's terms permit use "in any website or application,
   provided its source is clearly indicated, and a link is made to
   corpus.quran.com" — both are on the panel and in Settings. al-nuqta
   describes itself as non-commercial; if this site ever is not, that needs
   confirming with them.
2. **Hardening.** Morphology is currently a live call. The corpus is a 3 MB
   text file that could be baked into the build instead, which would make the
   breakdown work offline and survive that API being down. Say the word.
3. **Coverage.** Sampled across the muṣḥaf, 99% of roots have at least one
   lexicon entry and 87% have Lisān al-ʿArab specifically. The rest fall back
   to the scanned pages.

**Still open from the original ask:** "other occurrences of this word" is still
matched on the surface form, not on the root. The root is now known, so this is
build time rather than data.

---

## 4. Translations — **connected**

**Status: done.** There used to be six, in English, typed into a list. There is
now the corpus's whole catalogue, read from it when the library is opened: 125
translations in 66 languages, with one more read from your own files.

**What a reader gets.**

- **Up to four under each ayah**, in the order they choose, each under its
  translator's name. The first is the one a bookmark is saved in, a note quotes
  and the search looks through.
- **The translators' footnotes.** They were being cut out. A translation's
  marks are now in its text, and each opens its note in place, under the ayah —
  Saheeh International annotates 79 ayat of al-Baqarah alone. Words a translator supplied
  are in italics, as printed; a qirāʾa variant is noted as one.
- **Choosing by reading.** "Other translations", under any ayah, opens that
  ayah as every translator in a language rendered it, one under another, with a
  pin beside each. It is the comparison and the picker at once, and it steps
  through the surah with the text. The same list is on the settings page.
- **Any script.** A translation written right to left is set right to left, in
  the Naskh the site keeps for Arabic-script prose, by its own letters rather
  than by its language's name — the corpus has Urdu in Latin letters.
- **Word meanings in nine languages** — English, Urdu, Bengali, Hindi,
  Indonesian, Turkish, Persian, Tamil and Ingush. These are the ones the corpus
  has glossed word by word; it answers in English for any other.
- **Changing translation no longer takes the Arabic down.** The translations
  are their own request, laid over the text. Al-Baqarah in a new translation is
  100 KB, where it was 1.6 MB of words fetched again.

**What I found on the way, and fixed.**

- **The Clear Qur'an was gone.** The site listed it; the corpus had stopped
  carrying it, at its publisher's request (the Foundation's own notice says so).
  A reader who had chosen it had nothing under the Arabic and no word why. See
  below for what it reads from now.
- **Answers were kept for ever.** A surah opened once in a translation was
  shown from the browser's copy indefinitely, corrections and withdrawals
  notwithstanding. They are kept a week, which is also what the Foundation's
  terms allow. Offline, the old copy is still read; if the corpus says a thing
  is no longer there, the copy goes.
- **A shelf that outlives its catalogue.** If a translation a reader keeps is
  ever taken out of the corpus, it comes off their shelf and they are told
  which, and what they are reading in its place.

### The Clear Qur'an — read from your `quran-json` fork

You published a fork of `ReflectsLight/quran-json` as files and asked for it to
be used. It is: `src/lib/quran/translationFiles.ts`. The Clear Qur'an keeps the
number it had in the corpus, so it stands on the English shelf with the rest
and a reader who had it chosen still does.

**Checked before it was wired in.** All 114 files opened: 6,236 ayat, every one
numbered as the muṣḥaf numbers it, none empty, each file naming Dr. Mustafa
Khattab. The text is his sentences without his footnotes — the files do not
have them — and the library says so where the translation is listed.

**What was left, and why.** The fork has five other languages. All five are
translations the corpus already has, with their footnotes, which these files
lack: French is Hamidullah's, Italian Piccardo's, Dutch Siregar's, Persian is
Taji Kal Dari's (the README says Ansarian; the files say otherwise), and the
Portuguese, which the files do not name, is El-Hayek's. Taking them would put
each on its shelf twice, the second time poorer.

**The part that is yours to settle, and should be settled before the site is
public.** The Foundation did not drop this translation; its publisher had it
removed. The fork is a copy taken from quran.com before that, and its own
licence note is one line: "The translators hold the copyright for the
translated content." So reading it from a fork changes where the text comes
from, not whose it is. Two consequences:

1. **Permission.** Showing it wants the publisher's word. As far as I know that
   is the Book of Signs Foundation, of the Al-Furqaan Foundation
   (theclearquran.org) — confirm who holds the rights before writing to them.
   I have not seen a permission; it is in on your instruction.
2. **The Foundation's programme.** Its requirements for listed applications ask
   that "corrections, removals, or restrictions made upstream should be
   reflected promptly". Showing a translation it was asked to remove, from a
   copy of its own earlier data, is the kind of thing a review for production
   access could raise. If that access matters more, taking this out is one
   entry in `translationFiles.ts` and one line in `resources.ts`.

**What I still need from you on translations.**

1. **The default.** Saheeh International, as before. Say if it should be
   another.
2. **The head of the English shelf.** Nine are named in
   `src/lib/quran/resources.ts` and lead the shelf in that order; everything
   else follows by name. It is an editorial list and it is yours.
3. **How many at once.** Four. It is one number in the same file.

---

## 5. Recitation — what is already there, and what is not

**Status: working, and better than the prototype.** Eleven reciters stream from
the Quran.com audio CDN, and every one of them carries **word-level timing
segments**, so the word being recited lights up as it is read. The design
prototype faked this with a timer and no audio.

**What is missing.**

- **Reciter selection is yours to make.** Eleven are listed; say which you want.
- **Self-hosting.** Audio currently comes from Quran.com's CDN. If you want the
  files on your own storage — for reliability, or because you have recordings
  that are not in that corpus — send the files plus a per-ayah timing manifest
  (`surah:ayah` → `[wordIndex, wordPosition, startMs, endMs][]`).

**Range repeat — done.** A passage can now be looped from the transport: from
one ayah to another, each ayah a chosen number of times, the passage a chosen
number of times or until stopped, with an optional silence after each ayah to
recite it back in. It needed no new data. Which passage is being looped is kept
for the sitting only; the counts are remembered with the other settings.

---

## 6. Things the corpus gives you that we are not yet showing

No new data needed — these are already in the payload and simply have no screen
yet. Flagging them so you can say whether you want them:

- **Juz', hizb, rubʿ and page number** per ayah (page and juz' are shown in the
  word study panel; nothing browses by them yet).
- **Sajdah markers** — ayat of prostration are flagged in the data and not
  surfaced.
- **Revelation order** — shown as a tag and as a sort option in the index.
- **Muṣḥaf page layout.** The muṣḥaf view lays out a *surah* continuously. Laying
  out the *actual 604 pages* of the Madīnah muṣḥaf, with the correct line breaks,
  needs the page/line data plus the matching font. I had this down as licensed
  separately; the Foundation's documentation settles it. The glyph fonts are on
  its CDN, a file to a page, and its terms let an application cache or bundle
  them provided it keeps a developer account and credits the Foundation. See §8.

---

## 7. Non-data decisions I need from you

Not data, but blocking in the same way:

1. **Domain and hosting.** The site is a static export — it will run free on
   GitHub Pages, Cloudflare Pages or Netlify. If it is served from a sub-path
   (`user.github.io/mishkat`), set `NEXT_PUBLIC_BASE_PATH=/mishkat` at build.
2. **Accounts.** Notes and bookmarks are device-local, with export/import, and
   the storage layer is written so a sync backend drops in behind an interface
   without touching a screen (`src/lib/store/backend.ts`). When you want
   accounts, Supabase's free tier is one fit. The Quran Foundation's is
   another, and may be the better: a reader signs in with their Quran.com
   account and their bookmarks, notes and reading progress are the ones they
   already have there. See §8.
3. **The name.** "Mishkāt" came from the design handoff. Confirm or replace it —
   it appears in the header, the page titles and the storage keys.
4. **Licensing and attribution page.** The site names its sources in Settings.
   Before it is public it should carry the actual licence text for each corpus
   it uses. Send me the terms you are operating under.

---

## 8. The Quran Foundation API — where it stands

You created an application in the Foundation's Developer Console and gave me
its client id and secret, and asked me to go through all of its documentation.
I took down all 461 pages and the six OpenAPI files behind them. The guides,
the terms, the FAQ and the content and search references I read in full; the
account APIs, which are some three hundred pages of one endpoint each, I went
through by their specification. This is what they add up to.

### What the credentials are

**They are pre-live credentials.** Tested, not assumed: the pre-live token
endpoint issues a token for them; the production one answers `invalid_client`.

Pre-live is the Foundation's testing ground, and its corpus is small on
purpose: **al-Fātiḥah and al-Baqarah, and fourteen translations** — Saheeh
International is not among them. Every other surah answers "not found". So
these credentials prove the wiring. They cannot run the site.

**What the site reads today** is therefore what it always has: the same corpus
at its open address, `api.quran.com`, which needs no key and has all of it. The
Foundation's own migration guide says the two are the same paths and the same
answers behind a different door, and I checked that against live responses.
Nothing a reader sees depends on the key.

### What is built, ready for production access

- **`scripts/qf-relay.mjs`** — the server the Foundation requires. Its rule is
  flat: "A browser or mobile app must not embed a Content API client_secret."
  This site is a static export, so anything in it is in every reader's browser.
  The relay holds the secret, asks for the token, shares one token until it is
  about to lapse, retries once on a 401, answers only this site's address, and
  passes on only the Content API's own paths. It is one file that runs locally
  (`npm run relay:qf`) and unchanged as a Cloudflare Worker.
- **One switch.** `NEXT_PUBLIC_QF_RELAY` set to the relay's address and the
  whole site reads the corpus through it. The deploy workflow passes it from a
  repository variable, `QF_RELAY`.
- **Tested end to end** on pre-live, from the site's own address in a browser:
  the surah with its words and timings, a translation with footnotes, the
  catalogue and the side-by-side renderings all came back through the relay in
  the shapes the site reads.

**Where the secret is.** In `.env.local`, which git ignores. It is not in the
built site: I searched the export for it after building. It must never be given
a `NEXT_PUBLIC_` name, and must never be a variable of the build — only of the
relay.

### What I need from you

1. **Ask for production access.** Developer Console → your application →
   request production permissions for the `content` scope. It comes with
   production credentials of its own; pre-live ones do not carry over.
2. **Ask for `search` at the same time** if you want the search screen moved
   too. I tested it: this client is refused that scope. Search is a separate
   product there, with a different answer shape; until it is granted the search
   screen stays on the open address, and says so in `api.ts`.
3. **Somewhere to run the relay.** A free Cloudflare Workers account is enough.
   Say when you have one and I will write the Worker's config; the code is done.
4. **A privacy policy and terms of use page.** The Foundation's terms require
   both to be publicly reachable for any application using the API. The site
   has neither yet. Its privacy position is simple — no account, no analytics,
   nothing leaves the browser — and I can draft both for you to approve.
5. **Treat the secret as shown once.** It was pasted into a chat. Production
   will issue a new one; put that one straight into the relay's settings.

### The terms that bind once the key is used

Read in full, `legal/developer-terms`, last updated 2026-09-26. The ones that
shaped this work:

| Term | What it means here |
|---|---|
| A copy may be kept one week | Done: the browser's copies now lapse after seven days, and the relay's after six |
| No "prepackaged database or build-time bundle" of its content | **Translations cannot be mirrored into the site the way the tafsir library was.** They are read live. This is the main reason the relay exists rather than a build-time copy |
| Removals upstream are to be reflected | Done for the corpus's own catalogue; see §4 on The Clear Qur'an, which cuts the other way |
| Credit: "Quran data provided by Quran Foundation", and each translation under its own name | Done: in the library, and in Settings → Sources |
| The browser is asked not to machine-translate the pages | Done: the page says so, and the Arabic and the translations are marked |
| Fonts and muṣḥaf images may be cached or bundled, with credit | Opens the 604-page muṣḥaf — below |
| A breach is reported to them within 24 hours | Yours to know |

### What else is there, that Mishkāt does not use yet

You asked me to look for anything being missed. In the order I would take them:

1. **The 604-page muṣḥaf.** `pages/lookup` gives the ayat on each page, each
   word carries its line number, and the King Fahd glyph fonts are on the
   Foundation's CDN a file to a page — in three generations, the newest with
   tajwīd colour built into the glyphs. The terms allow bundling them. This is
   the "Muṣḥaf page layout" item of §6, now unblocked.
2. **Accounts, through Quran.com.** The User APIs carry bookmarks, collections,
   notes, reading sessions, goals, streaks and preferences for a signed-in
   Quran.com reader. Sign-in is OAuth2 with PKCE, and an application
   registered as "Frontend" needs no secret for it — yours is registered as
   "Backend", so this would be a second registration. One caution from the
   documentation: calls to these APIs from a page on another site "may be
   rejected", in which case they go through the same relay. A reader's
   bookmarks here would be their bookmarks on Quran.com and in every other
   application that uses it. `src/lib/store/backend.ts` was written for a
   backend to drop into.
3. **Tajwīd colouring.** `quran/verses/uthmani_tajweed` marks each letter with
   its rule. A reading option, and a teaching one.
4. **Hadith on an ayah.** `hadith_references/by_ayah` — the hadith that cite or
   explain an ayah, with a count per range so the reader can show where there
   are any. Not served at the open address; needs production access.
5. **Answers on an ayah.** `answers/by_ayah` — scholars' answers to questions
   about an ayah. Same: production only.
6. **Surah introductions in other languages.** `resources/chapter_infos` lists
   five: English (Maudūdī's, which is what §1's fallback has been all along —
   the site should name him), Urdu, Tamil, Malayalam, Italian.
7. **Other scripts.** IndoPak, which South Asian readers learned on, and its
   Nastaʿlīq form; the simplified Imlāʾī, which is the one to search.
8. **Whole-surah recitation.** `chapter_recitations` — one file to a surah
   with every word timed, from a longer list of reciters than the eleven here.
   No gap between ayat because there is no join.
9. **Reading offline.** The Content Sync endpoints let translations, tafsir
   and word meanings be kept on a device past the week, provided they are
   synced every seven days. That is the sanctioned route to a muṣḥaf that works
   on a plane.
10. **Reflections.** Quran Reflect's lessons and reflections on an ayah, from
    its verified contributors.
11. **A listing.** Quran.com/apps lists applications that pass its review. The
    requirements are the terms above, plus a named contact and a support route.

**Not worth taking.** The JavaScript SDK (`@quranjs/api`): its server half
does what the relay does in two hundred lines, and its browser half is for the
account APIs only. The analytics endpoint: the site has none, by design.

**One thing the documentation gets wrong, so that you are not misled by it.**
Its examples use translation `131` throughout — The Clear Qur'an — which the
same documentation's update notice says has been removed. The examples are
stale; the notice is right.

---

## What I do not need

To be explicit, so you do not spend effort on them:

- The Qur'anic text itself — Uthmānī text and word segmentation are in place.
- Word-by-word transliteration and gloss — in place.
- Surah names, ayah counts, revelation place — in place, and baked into the
  build so the site does not depend on a third party being up.
