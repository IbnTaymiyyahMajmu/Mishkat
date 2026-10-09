# Mishkāt

A Qur'an reading and study site. Read the text, see every word's meaning and
transliteration light up with it, open the classical tafsir beside the ayah,
write your own notes against it, listen to the recitation, and keep your place.

> **مِشْكَاةٍ** — the niche that holds the lamp, from 24:35.

**Status: in active development.** The site is incomplete and changing; what is
described below is the shape of the work, not a finished product.

---

## What is here

**Screens.** Home · surah index (114, filterable, sortable by muṣḥaf order,
revelation order or length) · reader · an introduction to each surah · muṣḥaf
view · notes · bookmarks · settings · search overlay.

**Four languages for finding your way around.** The site's own words — its
menus, labels, buttons and messages — can be had in English, Pashto, Persian or
Spanish, chosen under **Language** at the head of the settings page. That is all
the choice changes. The translation under each ayah, the word meanings and the
tafsir are chosen where they always were and are left exactly as the reader has
them. Pashto and Persian turn the whole page to read from the right.

Outside English, a surah is named in Arabic and nothing else: الملك, not
"Al-Mulk · The Sovereignty". A reader who does not read English cannot tell
"Ta Ha" from "Al-Mulk", and can read طه and الملك whatever language the rest
of the page is in. A surah is still *found* by any of its names — typing `kahf`
or `کهف` reaches الكهف in every language.

**The landing page.** One ayah, chosen by the date and turning over once a day,
set in gold on a lit niche — a lamp above the top edge of the screen, its halo,
the shaft it throws down the page, and the embers rising past it, all of it CSS
and none of it in React's way. Each of the twelve ayat carries the state of mind
it answers, and that is printed beside it. Below the fold, deliberately far
below it, the whole muṣḥaf: 114 surahs in the order they are bound, the thirty
juz, or the order in which they were revealed.

**An introduction to every surah.** Under each surah's name in the reader is a
line and a paragraph, and a way through to a page of its own
(`/read/<n>/about/`): where and when it came down, with the scholars' words
for it in Arabic; where it falls among the 114 in the order of revelation,
drawn as a river with the Hijrah marked on it; what was happening; what it is
for, as *al-Mukhtaṣar* states it; the surah passage by passage; what is
authentically narrated about it, and what is commonly quoted and is not; its
names; and its neighbours. At the head is a medallion drawn from the surah
itself — a band for each passage, as long as the passage is, and a tick for
the end of every ayah.

What is counted on that page is generated, and what is quoted is found in the
site's copy of the book and printed as the copy has it (`npm run lock:intros`;
the deploy checks it). The English prose was written for this site from the
works each page lists, and is waiting on a reader of knowledge —
`DATA-NEEDED.md` §1.

**Word by word.** Hovering an Arabic word lights the Arabic, its transliteration
and its gloss together. So does keyboard focus, and so does a tap on a phone —
where the first tap links the three and the second opens the word study.

**Translations.** The whole of the corpus's catalogue — some 125 translations in
66 languages — rather than a fixed handful. Up to four are set under each ayah,
in the reader's order, each under its translator's name; a translation in Urdu
or Persian is set right to left in a face for it. The translators' footnotes are
kept: a mark in the text opens its note in place, under the ayah. Words a
translator supplied are in italics, as printed.

A translation is chosen by reading it. **Other translations**, under any ayah,
opens that ayah as every translator in a language rendered it, one under
another; the pin beside one sets it under every ayah from then on. The same
list is on the settings page. Changing translation changes what is under the
Arabic and leaves the Arabic where it is: the translations are their own
request, laid over the text (`useSurahTranslations`), not part of it. The
meaning under each word can be had in nine languages.

One translation is not the corpus's: The Clear Qur'an, which it stopped carrying,
is read from a `quran-json` collection published as files
(`src/lib/quran/translationFiles.ts`) and says so where it is listed.

**Getting around.** A line pinned to the top of the reader says which surah and
ayah is on screen, with a hairline under it that fills as the surah is read.
Pressing it (or `g`) opens the navigator: type `11` for an ayah, `2 255` for a
reference, `kahf 10` or `yaseen` for a surah however it is spelled, `juz 30`
for a part — or pick, with every surah listed on one side and the ayat of the
one picked laid out on the other, each a place to tap. The reader's own marks
are on it: where they are, where they stopped in each surah, and what they
bookmarked or wrote on. On a phone, where there is no rail, this is how ayah 200
is reached without scrolling past the 199 before it.

**Notes.** Written against any ayah, with ayat quoted into them and the two kept
visually distinct. Notes are grouped by surah, searchable, and exportable.

**Muṣḥaf view.** One click from the reader. The surah as continuous Uthmānī
text, no translation, no transliteration, no word rows — without changing a
single setting, and restoring nothing on the way back.

**Recitation.** Real audio from eleven reciters, with the word being recited lit
as it is read, using the corpus's word-timing segments.

**Memorising.** A passage can be looped from the transport: from one ayah to
another, each ayah recited a chosen number of times, the passage gone over a
chosen number of times or until stopped — and, optionally, a silence after each
ayah as long as the ayah itself, to recite it back in. The passage offered runs
from the ayah being recited to the end of its rukūʿ, and the stretch being
looped is drawn on the reader's rail.

**Tafsir.** Twenty-two works in one library, opened on any ayah, each under its
own book and author and never merged into one answer.

*What there is.* In English: al-Mukhtaṣar and al-Jalālayn for a short answer,
and the abridged Ibn Kathīr, Maʿārif al-Qurʾān and Tazkirul Qurʾān at length. In
Arabic, briefly: al-Mukhtaṣar, al-Jalālayn, al-Muyassar and al-Saʿdī. And the
classical library, in the
Arabic its authors wrote: the four mother works — al-Ṭabarī, al-Baghawī,
al-Qurṭubī and Ibn Kathīr in full — and the leading work of each other kind of
tafsir, thirteen in all. Every work says in a line what it is, so one can be
chosen by a reader who has never heard of it.

*Across the languages.* The library is two shelves, English and Arabic, and
shows one at a time: the one the work being read is on, until the reader turns
to the other. Three works are held in both — al-Mukhtaṣar, al-Jalālayn and Ibn
Kathīr — and each carries a switch between its Arabic and its English, and a
way to set the two side by side.

*Getting to it.* **Tafsir** in the site's menu opens the tafsir page on the
ayah last being read. And each ayah has a **Tafsir →** under its translation. That opens
the panel beside the text on the work last being read, with the others kept to
hand as tabs and the whole library behind one button. Next and previous move
the panel and the text together, stepping past a run of ayat the author took
as one. For reading at length, `/tafsir/?v=2:255` gives the passage a page: the
ayah at its head, a measure to read in, the text at a size the reader sets, the
library down the side, and any second work set beside the first.

*How it is set.* The Qurʾan being commented on is in the accent, so the phrase
under discussion is found before the discussion of it. The editors' footnotes
are folded to a numbered mark that opens them — or set out in place, if the
reader prefers — a line of poetry is centred as verse, an
author who takes several ayat together is said to, and each classical work
opens on what its author said he set out to do.

*Where it comes from.* The Arabic library is [tafsir.app](https://tafsir.app)'s
— الباحث القرآني, digitised and proofread by Nuqayah — kept on this site with
their permission as static files under `public/tafsir`; `npm run mirror:tafsir`
copies the works named in `src/lib/quran/tafsirWorks.json`, and
`npm run mirror:tafsir -- --verify` checks the copy. The two short English works
are read from the [Tafsir API](https://github.com/spa5k/tafsir_api); the rest
from the Quran.com corpus. `src/lib/quran/tafsir.ts` is where the three are made
into one library.

---

## How it is put together

Next.js 16 (App Router) · React 19 · TypeScript · plain CSS with design tokens.
No CSS framework: the handed-over "Classical" design system is the source of
truth for the look, and the Arabic typography needs direct control.

```
src/
  app/                  routes; every surah is a pre-rendered page
  components/
    reader/             the reader, its verses, and the three study panels
    mushaf/             continuous-text view
    notes/              composer, card, body renderer, notes page
    search/             the command-palette overlay
  lib/
    quran/              corpus client, types, resources, useSurah
    store/              settings, library (bookmarks + notes), chapters
    audio/              recitation with word-level following
    i18n/               the language of the site's own words: the provider,
                        the list of languages, and a file of messages for each
    highlight.ts        the word painter
    notes.ts            note bodies and their quote markers
  content/              locally authored content that overrides the corpus
```

Four decisions shape most of the code:

**The word highlight is painted onto the document, not rendered.** A long surah
is thousands of word nodes; driving the highlight through React state means
re-rendering that tree on every mouse move. `src/lib/highlight.ts` instead
inserts four CSS rules once and rewrites only their *selectors*. Hover and the
recitation both feed it, and React never hears about either.

**Type size and face are CSS custom properties on the document**, so dragging
the size slider does not re-render a verse.

**Async state is stamped with the request it answers.** `useSurah`, the muṣḥaf
loader and the search dialog each hold one state object carrying the request it
belongs to, and derive "loading" by comparing that against what is being asked
for now. Nothing is cleared before a fetch, so no screen ever shows the previous
surah under the current surah's heading.

**The language is a setting, not a route.** The site is exported as plain files
and there is no server to hand a Pashto reader a Pashto page, so the language is
kept in the browser with the reading light and is applied the same way: a script
in `<head>` turns the document to face the right way before anything is painted,
and `LocaleProvider` (`src/lib/i18n`) puts the words on it. English is part of
the application; each other language is its own file, fetched only by the
readers who read it. `messages/en.ts` is the measure — every other file is typed
as "each of those keys and nothing else", so a sentence added to a screen fails
the build until it has been said in all four. Adding a language is one entry in
`locales.ts` and one file beside it. The stylesheets state their sides as start
and end rather than left and right, which is what lets one set of them serve a
page read in either direction.

## Where the data comes from

The Uthmānī text, word data, translations, tafsir and audio come from the
Quran.com v4 corpus — the Quran Foundation's — at runtime, kept in the browser's
Cache Storage for a week so a second visit to a surah costs no network at all.
`src/lib/quran/api.ts` is the only file that knows this; everything above it
speaks in chapters, verses, words and passages.

That corpus is served at two addresses. `api.quran.com` answers anyone and is
what the site reads by default. `apis.quran.foundation` is the same corpus
behind the Foundation's developer programme, asked for with a token — and the
client secret that buys the token cannot be put in a static site. So it is held
by a relay, `scripts/qf-relay.mjs`: credentials in `.env.local` (never with a
`NEXT_PUBLIC_` prefix), `npm run relay:qf` beside `npm run dev`, and
`NEXT_PUBLIC_QF_RELAY` set to the relay's address tells the site to read through
it. The same file runs unchanged as a Cloudflare Worker. See DATA-NEEDED.md §8
for where the credentials stand.

Anything written into `src/content` overrides the corpus and is attributed to
whoever wrote it.

## Privacy

Bookmarks, notes and settings live in the browser and nowhere else. There is no
account, no analytics and no server. `src/lib/store/backend.ts` defines the
interface a sync backend would implement; every record already carries a stable
id, an `updatedAt` and a deletion tombstone, so two devices could be merged
without one silently overwriting the other.
