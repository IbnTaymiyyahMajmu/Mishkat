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

**Notes.** Written against any ayah, with ayat quoted into them and the two kept
visually distinct. Notes are grouped by surah, searchable, and exportable.

**Muṣḥaf view.** One click from the reader. The surah as continuous Uthmānī
text, no translation, no transliteration, no word rows — without changing a
single setting, and restoring nothing on the way back.

**Recitation.** Real audio from eleven reciters, with the word being recited lit
as it is read, using the corpus's word-timing segments.

**Tafsir.** Seven works, opened per ayah, compared side by side, each under its
own book and author, never merged into one answer.

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
Quran.com v4 corpus at runtime, cached in the browser's Cache Storage so a
second visit to a surah costs no network at all. `src/lib/quran/api.ts` is the
only file that knows this; everything above it speaks in chapters, verses, words
and passages.

Anything written into `src/content` overrides the corpus and is attributed to
whoever wrote it.

## Privacy

Bookmarks, notes and settings live in the browser and nowhere else. There is no
account, no analytics and no server. `src/lib/store/backend.ts` defines the
interface a sync backend would implement; every record already carries a stable
id, an `updatedAt` and a deletion tombstone, so two devices could be merged
without one silently overwriting the other.
