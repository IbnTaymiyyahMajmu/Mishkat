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

**Status.** Seven works are served **per ayah** from Quran.com: Ibn Kathīr
(abridged), Maʿārif al-Qurʾān, Tazkirul Qurʾān, al-Saʿdī, al-Ṭabarī, al-Qurṭubī,
al-Muyassar.

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

**Also worth naming**: which works you actually want. The current seven were
chosen from what the corpus offers, not from a decision you made. Tafsir.app's
selection is a good reference for what a serious reader expects.

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

## 4. Your own translation preferences

**Status.** Six translations offered: Saheeh International (default), Abdel
Haleem, Khattab (The Clear Qur'an), Taqi Usmani, Pickthall, Yusuf Ali.

**What I need from you.** Which translations should be on the list, and which
should be the default — this is an editorial decision, not a technical one, and
I picked the current six from what the corpus offers. Adding one is a single
line in `src/lib/quran/resources.ts` if it exists in the corpus; supplying your
own text is the same delivery shape as the tafsir above.

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
- **Range repeat.** Repeat-ayah and repeat-surah work. Repeat *a selected range*
  (the master prompt asks for it) needs no new data, only build time.

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
  needs the page/line data plus the matching font (a QCF/`KFGQPC` glyph font,
  which is licensed separately). Say the word and I will scope it.

---

## 7. Non-data decisions I need from you

Not data, but blocking in the same way:

1. **Domain and hosting.** The site is a static export — it will run free on
   GitHub Pages, Cloudflare Pages or Netlify. If it is served from a sub-path
   (`user.github.io/mishkat`), set `NEXT_PUBLIC_BASE_PATH=/mishkat` at build.
2. **Accounts.** Notes and bookmarks are device-local, with export/import, and
   the storage layer is written so a sync backend drops in behind an interface
   without touching a screen (`src/lib/store/backend.ts`). When you want
   accounts, Supabase's free tier is the natural fit. Say when.
3. **The name.** "Mishkāt" came from the design handoff. Confirm or replace it —
   it appears in the header, the page titles and the storage keys.
4. **Licensing and attribution page.** The site names its sources in Settings.
   Before it is public it should carry the actual licence text for each corpus
   it uses. Send me the terms you are operating under.

---

## What I do not need

To be explicit, so you do not spend effort on them:

- The Qur'anic text itself — Uthmānī text and word segmentation are in place.
- Word-by-word transliteration and gloss — in place.
- Surah names, ayah counts, revelation place — in place, and baked into the
  build so the site does not depend on a third party being up.
