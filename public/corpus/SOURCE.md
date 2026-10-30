# Where these files come from

They are worked out by `scripts/build-ulum.mjs` from the morphology of the
**[Quranic Arabic Corpus](https://corpus.quran.com)** (Kais Dukes, Language
Research Group, University of Leeds), as corrected and rendered in Arabic by
[mustafa0x/quran-morphology](https://github.com/mustafa0x/quran-morphology) at
commit `8f38b39`. The corpus is free software under the GNU
General Public License; its tags are kept here exactly as it writes them.

- `morph/<surah>.json` — every word of every ayah, segment by segment.
- `roots.json` — each root's lemmas, their kinds and counts.
- `echo/<surah>.json` — runs of three or more words an ayah shares, word for
  word, with another.
- `sahih/<surah>.json` — the hadith of al-Bukhārī, Muslim, Abū Dāwūd, al-Tirmidhī,
  al-Nasāʾī and Ibn Mājah that Ibn Kathīr quotes on each passage, by the number his
  editor gives, in the text and translation of
  [fawazahmed0/hadith-api](https://github.com/fawazahmed0/hadith-api), kept only
  where the text matches what he quotes. Those of the four Sunan carry al-Albānī's
  grading as that corpus gives it, and one without a grading is left out.
