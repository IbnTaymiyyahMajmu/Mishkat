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
revelation order or length) · reader · muṣḥaf view · notes · bookmarks ·
settings · search overlay.

**The landing page.** One ayah, chosen by the date and turning over once a day,
set in gold on a lit niche — a lamp above the top edge of the screen, its halo,
the shaft it throws down the page, and the embers rising past it, all of it CSS
and none of it in React's way. Each of the twelve ayat carries the state of mind
it answers, and that is printed beside it. Below the fold, deliberately far
below it, the whole muṣḥaf: 114 surahs in the order they are bound, the thirty
juz, or the order in which they were revealed.

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
    highlight.ts        the word painter
    notes.ts            note bodies and their quote markers
  content/              locally authored content that overrides the corpus
```

Three decisions shape most of the code:

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
