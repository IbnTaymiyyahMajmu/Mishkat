# Local content

What the site says in its own voice, kept apart from the application code so
that it can be read, corrected and replaced by a person without touching a
component.

Files here are imported at build time, so they ship inside the static export.
Nothing in this folder is fetched at runtime.

---

## `intros/<n>.json` — the introduction to each surah

One file to a surah, `1.json` to `114.json`. Each is shown at
`/read/<n>/about/`, and its first two lines (`epithet`, `lede`) sit under the
surah's name in the reader.

An introduction says three kinds of thing, and the page keeps them apart:

| Kind | Where it comes from | Who answers for it |
|---|---|---|
| **Counted** | `src/lib/quran/surahFacts.ts`, generated from the corpus by `npm run gen:facts` — ayat, words, pages, juzʾ, place in the order of revelation | The muṣḥaf. Not in these files at all. |
| **Quoted** | An `evidence` entry: Arabic from a tafsir this site holds a copy of (`public/tafsir/`) | The author quoted. The words are found in the copy by machine and printed as the copy has them — see *Locking*. |
| **Written** | Everything else: the English prose | Whoever wrote it. It lists its sources, and it is the part that needs a reader of knowledge. |

The shape is `Intro` in `src/lib/intros/types.ts`, which is the reference. In
brief:

```jsonc
{
  "surah": 18,
  "epithet": "…",                 // a line, 70 characters at most
  "lede": "…",                    // a paragraph, 460 characters at most
  "names": [{ "arabic": "…", "name": "…", "meaning": "…", "note": "…" }],
  "revelation": {
    "place": "makkah",            // makkah | madinah | disputed
    "verdict": "Makkan, by agreement",
    "detail": "…",                // who said so, and the exceptions they named
    "period": "makkah-middle",    // makkah-|madinah- early|middle|late
    "when": "…",
    "evidence": [{ "work": "zad-almaseer", "ayah": 1, "quote": "…" }]
  },
  "setting": ["…", "…"],          // what was happening — paragraphs
  "occasions": [{ "ayat": [23, 24], "title": "…", "text": "…", "source": "…", "evidence": { … } }],
  "aim": "…",                     // English of al-Mukhtaṣar's statement of the surah's purpose
  "themes": ["…", "…"],
  "outline": [{ "from": 1, "to": 8, "title": "…", "summary": "…" }],
  "keyAyah": { "ayah": 10, "why": "…" },
  "virtues": [{ "text": "…", "arabic": "…", "narrator": "…", "source": "…",
                "refs": [{ "book": "muslim", "number": "809" }], "grade": "Ṣaḥīḥ" }],
  "virtuesNote": "…",             // weak or fabricated reports people quote, and why they are not above
  "before": "…", "after": "…",    // its link to the surah either side of it in the muṣḥaf
  "notable": [{ "ayah": 10, "to": 12, "label": "…" }],
  "sources": ["Ibn Kathīr, Tafsīr al-Qurʾān al-ʿAẓīm", "…"]
}
```

Rules the files keep to:

- **Prose is plain text**, not HTML. A reference written `18:10` inside it
  becomes a link to that ayah.
- **A hadith is given only if it is authentic**, and says where it is recorded
  and how it is graded, and by whom when the grading is not that of the two
  Ṣaḥīḥs. A weak or fabricated report that is widely quoted goes in
  `virtuesNote`, named as such. A surah with nothing authentic narrated about
  it in particular has an empty `virtues`, and the page says so.
- **`refs`** name a collection (`bukhari`, `muslim`, `tirmidhi`, `abudawud`,
  `nasai`, `ibnmajah`) and a number, and become a look-up link. Ṣaḥīḥ Muslim
  is cited by ʿAbd al-Bāqī's numbering.
- **`outline` covers the surah exactly**: from ayah 1 to the last, nothing
  missing and nothing twice. The medallion at the head of the page is drawn
  from it.
- **`place: "disputed"`** is for a real difference among the early
  authorities, not for a surah with a few excepted ayat.

### Locking

```
npm run lock:intros     # find every quotation, rewrite it from the copy, check every file
npm run check:intros    # the same, changing nothing; fails if anything would change
```

`scripts/lock-intros.mjs` looks for each `evidence.quote` in the named work's
passage on the named ayah — by its letters alone, so a quotation typed without
vowels still finds itself — and replaces it with the copy's own text. A
quotation that is not there is an error. It also checks the shape of every
file, and that every ayah mentioned exists. The deploy runs the check.

Run `lock:intros` after editing any file here.

## `surah-aims.json`, `intros-written.json`, `ayah-words.json`

Generated; do not edit.

- `surah-aims.json` — the sentence with which *al-Mukhtaṣar fī al-Tafsīr*
  opens each surah (من مقاصد السورة), lifted from the mirrored copy by
  `lock:intros`. Printed in Arabic above the English `aim`.
- `intros-written.json` — which surahs have a file. Settings → Sources counts
  them.
- `ayah-words.json` — the number of words in each ayah, written by
  `gen:facts`. The medallion places each ayah's tick by it.
