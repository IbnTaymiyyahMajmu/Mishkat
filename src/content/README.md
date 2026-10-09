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
    "evidence": [{ "work": "zad-almaseer", "ayah": 1, "quote": "…" }],
    // the same finding as other works record it, each with what it says in English
    "attested": [{ "work": "baghawi", "ayah": 1, "quote": "…", "says": "Makkan." }]
  },
  "setting": ["…", "…"],          // what was happening — paragraphs
  "occasions": [{ "ayat": [23, 24], "title": "…", "text": "…", "story": ["…", "…"], "source": "…",
                  "rank": "agreed", "caveat": "…", "evidence": { … } }],
  "aim": "…",                     // English of al-Mukhtaṣar's statement of the surah's purpose
  "themes": ["…", "…"],
  "outline": [{ "from": 1, "to": 8, "title": "…", "summary": "…" }],
  "keyAyah": { "ayah": 10, "why": "…" },
  "virtues": [{ "text": "…", "arabic": "…", "narrator": "…", "source": "…",
                "refs": [{ "book": "muslim", "number": "809" }], "grade": "Ṣaḥīḥ" }],
  "virtuesNote": "…",             // something else worth knowing: an ayah of prostration, a practice of the Companions
  "before": "…", "after": "…",    // its link to the surah either side of it in the muṣḥaf
  "notable": [{ "ayah": 10, "to": 12, "label": "…" }],
  "sources": ["Ibn Kathīr, Tafsīr al-Qurʾān al-ʿAẓīm", "…"]
}
```

Rules the files keep to:

- **Prose is plain text**, not HTML. A reference written `18:10` inside it
  becomes a link to that ayah.
- **A hadith is given only if it is authentic**, and says where it is recorded
  and how it is graded. Outside the two Ṣaḥīḥs **the grading is al-Albānī's**
  — "Ṣaḥīḥ according to al-Albānī", with the book and number where the hadith
  is not in the four Sunan. Where no grading of his has been found, the
  scholar who did grade it is named, and the file is listed for review.
- **A weak or fabricated report is neither given nor mentioned** — not as a
  narration, not as an occasion, not in the prose, and not in a note saying
  that it is weak. The owner's ruling: it is left out. A surah with nothing
  authentic narrated about it in particular has an empty `virtues`, and the
  page says so. The lock script refuses `"rank": "weak"` and `{weak}`.
- **Every report says how it stands**, in `rank`, on each narration and each
  occasion: `agreed` (in al-Bukhārī or Muslim), `sahih`, `hasan`, `companion`
  (a Companion's own saying), `disputed`, or `reported` (related by the
  commentators with no graded chain). The page prints a word for each, and
  beside anything that is not ṣaḥīḥ a sentence saying what that means. The
  lock script will not accept `agreed` unless the source names one of the two
  Ṣaḥīḥs.
- **A sentence of the account that tells of such a report ends with its mark**
  — `…turned back by a friend’s scorn.{reported}` — one of `{reported}`,
  `{disputed}`, `{hasan}`. It is printed as a small sign after the sentence,
  with a key under the account.
- **A date or a figure that is not certain is followed by the reason** —
  `…about a year before the Hijrah{?The reports differ by years…}`. The page
  prints a small question mark there, and shows the reason to a pointer that
  rests on it, a finger that touches it, or a reader that tabs to it. The
  reason is a full sentence; the lock script refuses a bare `{?}`.
- Marks and doubts belong in `setting`, `revelation.detail` and
  `revelation.when` only.
- **An occasion is told in full where the report is long enough to be told.**
  `text` is then the opening paragraph and `story` the rest, paragraph by
  paragraph. A story is written from the text of the hadith its `source`
  names, read in Arabic, and from nothing else: no detail is added that the
  narrator did not give, and nothing is taken from memory. The same section
  holds a few accounts that are not occasions of revelation but the Prophet's
  ﷺ own telling of what a surah tells — the Night Journey, Mūsā and al-Khiḍr,
  the boy and the king.
- **A grading that needs a word about itself carries a `caveat`** — on a
  narration or an occasion. Two kinds exist: the grading is al-Albānī's but
  was taken from an index of his works and not yet seen in the printed book;
  or no grading of his was found and another scholar's is given. The page
  underlines the grading and puts the sentence under a small sign beside it.
  When the grading has been checked in the book, delete the `caveat`.
- **An occasion with no graded chain (`reported`) stays only where the
  majority of the commentators relate it** — the owner's ruling. Its `source`
  then says who relates it, or quotes the commentator who calls it the saying
  of the majority. One that is a minority report is put to the owner.
- **`refs`** name a collection (`bukhari`, `muslim`, `tirmidhi`, `abudawud`,
  `nasai`, `ibnmajah`) and a number, and become a look-up link. Ṣaḥīḥ Muslim
  is cited by ʿAbd al-Bāqī's numbering.
- **`outline` covers the surah exactly**: from ayah 1 to the last, nothing
  missing and nothing twice. The medallion at the head of the page is drawn
  from it.
- **`place: "disputed"`** is for a real difference among the early
  authorities, not for a surah with a few excepted ayat.

### The works an introduction may quote

Only works by scholars of Ahl al-Sunnah wa-l-Jamāʿah. The list is in
`scripts/lock-intros.mjs` (`QUOTABLE`), and a quotation from anything else is
an error — the script will not write the file, and the deploy will not
publish it.

| Work | Author | Quoted for |
|---|---|---|
| Jāmiʿ al-bayān | al-Ṭabarī (d. 310) | transmitted reports, with their chains |
| Maʿālim al-tanzīl | al-Baghawī (d. 516) | where each surah came down |
| Zād al-masīr | Ibn al-Jawzī (d. 597) | the sayings on place and occasion, gathered |
| al-Jāmiʿ li-aḥkām al-Qurʾān | al-Qurṭubī (d. 671) | **transmitted reports only** — what he relates about place, time and names; never a matter of creed |
| Tafsīr Ibn al-Qayyim | Ibn al-Qayyim (d. 751) | — not yet quoted |
| Tafsīr al-Qurʾān al-ʿaẓīm | Ibn Kathīr (d. 774) | reports, their gradings, the setting |
| al-Durr al-manthūr | al-Suyūṭī (d. 911) | **reports only** — who recorded what from which Companion; he does not grade them, and neither does the page |
| Fatḥ al-qadīr | al-Shawkānī (d. 1250) | his summary of where a surah came down |
| Aḍwāʾ al-bayān | al-Shinqīṭī (d. 1394) | — not yet quoted |
| Tafsīr Ibn ʿUthaymīn | Ibn ʿUthaymīn (d. 1421) | — not yet quoted |
| al-Mukhtaṣar fī al-tafsīr | Markaz Tafsīr | the aim of each surah |

The site's library also holds *Mafātīḥ al-ghayb* (al-Rāzī), *Anwār al-tanzīl*
(al-Bayḍāwī), *Tafsīr al-Jalālayn* and *al-Taḥrīr wa-l-tanwīr* (Ibn ʿĀshūr).
They are kept for readers of the tafsir pages and are **not** on the list: each
interprets the attributes of Allah by the way of kalām, and an introduction is
not the place to send a reader into that.

al-Qurṭubī stays on the list by the owner's decision, with a condition: every
quotation from him carries a line under it — "Quoted for what he relates, not
for creed" — which leads to a paragraph in Sources saying why. *al-Durr
al-Manthūr* is marked in the same spirit: each report taken from it says that
its chain is not graded here.

`attested` entries each carry `says`: a line of English stating what the
Arabic states, so that a reader with no Arabic is not shown a quotation he
cannot check against anything.

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
