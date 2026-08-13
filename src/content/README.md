# Local content

Everything in this folder **overrides** what the site would otherwise pull from
the Quran.com corpus. It exists so that the parts of the product that ought to
be written by a person — above all the introduction to each surah — can be,
without touching a line of application code.

Files here are imported at build time, so they ship inside the static export.
Nothing is fetched at runtime.

---

## `surah-intros.json`

The Quran.com chapter-information text is a stopgap. It is uneven in length,
inconsistent in register, and for many surahs it is a couple of sentences.
Anything you put here replaces it entirely for that surah, and the site labels
it with the source you give rather than "Quran.com chapter information".

Shape:

```jsonc
{
  "intros": {
    "1": {
      "title": "Al-Fātiḥah",              // optional; the surah name is used if absent
      "source": "Written for Mishkāt",     // printed under the introduction — required
      "sourceUrl": "https://…",            // optional; makes the source a link
      "revealed": "Meccan",                // optional; overrides the corpus
      "themes": ["Praise", "Guidance"],    // optional; shown as tags
      "paragraphs": [
        "First paragraph of the introduction.",
        "Second paragraph."
      ],
      "arabicParagraphs": [                 // optional; set right-to-left, after the English
        "الفقرة الأولى."
      ]
    }
  }
}
```

Rules the renderer applies:

- `paragraphs` is plain text, not HTML. Line breaks inside a string are
  collapsed; use separate array entries for separate paragraphs.
- `source` is mandatory for every entry. An introduction without a stated
  source is exactly the thing this product is trying not to publish.
- A surah with no entry falls back to the corpus text, still attributed.

Add surahs one at a time. There is no need to fill all 114 before the site is
useful — each entry improves the surah it belongs to and nothing else.
