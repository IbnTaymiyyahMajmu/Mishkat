# The ayah study — where things stand

The page from the Āyat al-Kursī handoff, at `/ayah/?v=2:255`, for all 6,236
ayat. This sheet is what you have to look at and rule on. The section letters
are for answering by, and will not move.

| Section | Status |
|---|---|
| **A** What was left out of the handoff, and why | **For you to confirm** — the positions matrix is now K |
| **B** Who is on the shelf | **For you to confirm** — al-Samīn, al-Rāzī, Ibn ʿĀshūr and others |
| **C** Weak reports inside the books | **Ruled: show them, labelled**, with why (L) |
| **D** The Sunnah tier | **For you to confirm** |
| **E** The generations of the reports | **For you to confirm** — a list to check. Al-Durr is **ruled in, labelled** |
| **F** The sentences of an ayah | **For you to confirm** |
| **G** The fourth school | **Added, for you to confirm**. Ibn Taymiyya and Ibn al-Bannāʾ are **ruled out** |
| **H** Page numbers | **For you to confirm** |
| **I** The mirror's permission | **Ruled: verbal permission, cite the sources** |
| **J** The other three languages | Unreviewed, as before |
| **K** Where the scholars differ | **New, for you to confirm** |
| **L** Weak reports, labelled | **New, for you to confirm** |

**What is not in doubt**, so you need not look at it:

- Every sentence of the books on the page is the book's, exactly as tafsir.app
  serves it, and each links to the same place on tafsir.app. The Ḥanbalī column is
  the exception: it is read from OpenITI and links to Shamela (G).
- The counts: roots, lemmas, occurrences, shared phrases, words per commentator.
- That a reader sees "not recorded" only when the book was opened and has nothing.
  Offline in the app, the page says the books could not be reached.

`npm run check:ulum` measures how well the books are read, over the whole
Qurʾān. As it stands:

| Book | Remarks | Found on their words |
|---|---:|---:|
| al-Iʿrāb al-muyassar | 20,288 | 99.8% |
| al-Jadwal, the words | 58,883 | 99.7% |
| al-Jadwal, the forms | 3,945 | 99.3% |
| al-Jadwal, the sentences | 22,917 | 98.2% |
| al-Samīn | 7,903 | 97.6% |
| Darwīsh, the language | 2,189 | 96.9% |
| al-Abyārī, the readings | 3,523 | 94.2% |
| al-Daʿʿās | 59,298 | 94.1% |

A remark that is not found is still shown in the book's order. It only points
at no word. These figures say a remark was set on the words it quotes; they do
not prove every placement, and the rare wrong one is possible where a short
word repeats.

**How much of the Qurʾān each chapter reaches.** Every one of the 6,236 ayat has its
page and its 77,429 words. A book that has nothing on an ayah is said to have
nothing, so these gaps are the books', not missing work:

| On the page | Ayat | Of 6,236 |
|---|---:|---:|
| Words, roots and forms; grammar; rhetoric; the five commentators; benefits; al-Biqāʿī | 6,236 | 100% |
| The Companions and Followers, from three books (E) | 5,139 | 82.4% |
| Qatāda | 4,679 | 75.0% |
| Differences the books record (K) | 4,180 | 67.0% |
| Runs of words shared with another ayah | 3,964 | 63.6% |
| The readings, any of the four books | 2,830 | 45.4% |
| The Sunnah column, al-Bukhārī and Muslim | 2,363 | 37.9% |
| Rulings, any book | 2,157 | 34.6% |
| Rulings, any of the four schools | 1,639 | 26.3% |
| Occasions of revelation, al-Wāḥidī | 539 | 8.6% |

---

## A. What was left out of the handoff, and why

Your master prompt's first rule is "repeat what a source recorded, and add
nothing of your own", and it says no machine-written gloss may pass as a
scholar's words. The handoff's own data file says its page numbers are
"indicative and must be verified". So these parts were **not** carried over:

1. **Everything in `kursi-data.js` and `ikhlas-data.js`.** Its English tafsīr,
   summaries, positions and volume and page numbers were written in the mockup
   and could not be traced. Nothing from those files is on the site.
2. **The student and scholar tafsīr, sentence by sentence.** To do this for
   6,236 ayat I would have had to write it. The books are shown instead. The
   meaning under the ayah is your chosen translation, whole.
3. **The positions matrix** (who adopts or reports which view). I could not write
   this for every ayah without judging what each commentator held. Your ruling of
   2026-10-30 asked for the differences on every ayah, and K now gives them from
   the books that record them. The measured table stays beside it.
4. **Madd bars, reader by reader.** I had no source open to cite for the
   lengths, and would have been giving them from memory.
5. **"Counted in the ayah"** (the Names of Allah in 2:255, and *nafy* and
   *ithbāt*). This was hand-compiled for one ayah and has no general source.
6. **The hand-written sayings and benefits for 2:255 and 112.** Chapter eleven
   holds five books' benefits in their own words instead, nothing composed.

**Rule on:** is this the right call? If you want summaries written for
particular ayat, I can do that as a labelled, hand-checked layer, one ayah at a
time, but not honestly for all 6,236.

## B. Who is on the shelf

You said to consult what I needed. Eleven books were added, in a shelf of their
own (`src/lib/quran/ulumWorks.json`) so the tafsir library is unchanged:

- **Iʿrāb:** al-Naḥḥās, al-Samīn al-Ḥalabī, al-Ṣāfī's al-Jadwal, Darwīsh,
  al-Daʿʿās and his colleagues, al-Iʿrāb al-muyassar, al-Kharrāṭ's al-Mujtabā.
- **Qirāʾāt:** Ibn al-Jazarī's al-Nashr and Taḥbīr al-taysīr, al-Kirmānī,
  al-Abyārī.

Points for you:

1. tafsir.app labels **al-Samīn** Ashʿarī and calls **al-Naḥḥās** "mixed". They
   are here for grammar, not creed.
2. **Chapter four** shows Ibn ʿĀshūr and Abū al-Suʿūd, and **chapter eight** has
   al-Rāzī among its five. Your introductions exclude them, but your handoff
   names al-Rāzī and Ibn ʿĀshūr, so I followed the handoff.
3. **Al-Kirmānī** is in tafsir.app's catalogue with no creed given. I have not
   looked into him.
4. **Al-Iʿrāb al-muyassar** has no author named on tafsir.app, and the page says
   so rather than guess. If you know who wrote it, tell me.
5. **Al-Kashshāf, al-Akhfash and Muqātil ibn Sulaymān stay out**, as you ruled.
   A chain ending at a bare «مقاتل», which might be him, is not given a
   generation (see E).
6. **The lexicons** are read from al-nuqta, as the word study page reads them.
   The English beside each is its translation, and the page says so.

## C. Weak reports inside the books

**Ruled 2026-10-30: show the books whole.** The study page is treated like the
tafsir page: a book is shown as its author wrote it, weak reports included. The
rule that a weak report is not given or mentioned stays with what the site
writes itself, such as the introductions. Nothing on the page changed.

The tiers that the page itself chooses are a different matter and stay as they
are: the Sunnah column holds only al-Bukhārī and Muslim (D), and Prophetic reports
stay out of the tiers (E).

What the ruling covers, for example:

- **Darwīsh on 2:255** quotes "لكل شيء سنام…" in his section on rhetoric. As far
  as I recall al-Albānī graded that hadith weak, but I have not opened his book
  to confirm it.
- **Al-Wāḥidī** gives his reports with their chains, ungraded, and the chapter
  says so.
- **Al-Nashr, Ibn al-ʿArabī, al-Biqāʿī** and every tafsir in chapter eight
  quote as their authors quoted, as the tafsir page already does.

**Extended 2026-10-30:** weak reports may be shown as long as they are labelled
weak, with why, whether in the chain or anything else, clearly and visibly. Section
L says what is labelled so far. No report was removed.

## D. The Sunnah tier

Chapter seven's Sunnah column holds **only al-Bukhārī and Muslim**, because they
need no grading beside them, and your rule is al-Albānī's grading for everything
else.

- **Which hadith bear on an ayah** is Ibn Kathīr's judgement, by way of the
  numbers his editor gives in the footnotes.
- **The text** is the collection's own, fetched by that number, with the English
  of the open hadith-api (Muḥsin Khān for al-Bukhārī, ʿAbd al-Ḥamīd Ṣiddīqī for
  Muslim).
- **A number is kept only if the hadith matches what Ibn Kathīr quotes** around
  it: 2,318 of 2,751 pass. Tried with deliberately wrong numbers, the same test
  passed about 2 in 100. So a wrong one can slip through, rarely.
- **The 433 turned away** are mostly places he only alludes to a hadith. They
  stay in his text in chapter eight. Nothing is lost, but the column can say
  "no report" where he does mention one.

**Rule on:** do you want the four Sunan added, by al-Albānī's grading? That is
possible with the same check. I left them out because you asked for his grading
and it needs care with which grades the corpus carries.

## E. The generations of the reports

Chapter seven's Companions and Followers come from three books. An ayah takes **the
first of them with a report of these generations on it**:

| In turn | Ayat it gives | Chains |
|---|---:|---|
| Ibn Abī Ḥātim | 2,098 | Yes, with his numbers |
| al-Ṭabarī | 2,675 more | Yes |
| al-Durr al-manthūr of al-Suyūṭī | 366 more | **No.** It names who collected a report and its last authority |

That is **5,139 of the 6,236 ayat**. Tafsir.app's copy of Ibn Abī Ḥātim has only
surahs 1–13 and 23–29, and is missing some ayat within those. The 1,097 left have
no report placed on them in any of the three. They fall thickest in surahs 26, 23
and 37. Every report says "not graded here", and al-Durr's also say "no chain given".
A note under the tiers says which book they came from. A tier shows five reports
and folds the rest.

The generation is read from **the last link of the chain**, against a list I wrote
(in `src/lib/ulum/read.ts`). Over each whole book:

| | Ibn Abī Ḥātim | al-Ṭabarī | al-Durr |
|---|---:|---:|---:|
| Companions | 3,307 | 6,239 | 10,205 |
| Followers | 8,844 | 19,284 | 13,775 |
| The generation after them (tagged as such) | 1,075 | 2,407 | 1,297 |
| Prophetic, **left out** of these tiers | 432 | 1,107 | 6,114 |
| Not placed, shown apart with no generation | 2,678 | 5,668 | 6,292 |

**A correction, 2026-10-30.** The reader knew only one of the ways the copy numbers
Ibn Abī Ḥātim's reports. About 5,200 of them, nearly a third, ran on inside the
report before them, under that report's authority. They now stand apart, which is
why his total rose from 11,047 to 16,336. It also did not follow chains using
«ثني» or «قال: قال». Earlier figures in this sheet were wrong.

1. **Ruled 2026-10-30: al-Durr stays, labelled.** A report with no chain cannot be
   weighed, and al-Suyūṭī gathers strong and weak alike, so it is used only where
   the other two have nothing, and each of its reports says "no chain given".
2. **Please check the list.** It is short and yours to correct. Ibn Isḥāq and
   al-Aʿmash are under the Followers, as younger Followers who saw Anas; Ibn
   Jurayj, the two Sufyāns and Muqātil ibn Ḥayyān are under the generation after.
   Added for al-Ṭabarī, from my own knowledge of them: Abū al-Ṭufayl among the
   Companions; Yazīd ibn Rūmān, ʿUbayd ibn ʿUmayr, ʿAmr ibn Maymūn, ʿAṭāʾ ibn Yasār,
   Shahr ibn Ḥawshab, al-Rabīʿ ibn Khuthaym, Shurayḥ and others among the Followers;
   Maʿmar among the generation after.
3. **A bare name that could be two men is not placed:** «عبد الله», «علي», «جابر»,
   «سعيد», «مقاتل». A scholar would resolve most of these from the chain. The page
   does not. «علي» with «رضي الله عنه» after it is placed as the Companion.
4. **Prophetic reports are not shown in the tiers** from any of the three, since
   they are ungraded. They remain in the books.
5. **A report is set on the phrase it quotes.** The copies do not always keep a
   passage to the ayat it is filed under: al-Ṭabarī's whole of al-ʿĀdiyāt stands
   under its last two. A report on a phrase outside its passage is left out rather
   than placed on the wrong ayah.
6. **I read about 60 sampled reports against their chains** and found them right
   but for unusual endings: a report al-Shaʿbī gives of ʿĀʾisha stays under
   al-Shaʿbī. That is a sample, not proof of all 88,000.

## F. The sentences of an ayah

The ayah is grouped by **al-Ṣāfī's** list of sentences: those he gives no place
in the iʿrāb, leaving out relative clauses, answers to oaths and conditions, and
explanatory clauses. The answer to a vocative counts as a sentence. A sentence
joined to another goes with it.

So **2:255 has seven sentences here, not the ten** of Ibn Kathīr and your
handoff, because he reads «لا تأخذه سنة» and «له ما في السماوات» as predicates
within the first. Al-Jazāʾirī's "ten sentences" is shown in chapter eleven as he
wrote it. Of the 6,236 ayat, 4,104 have a sentence beginning in them; the rest
run on from the ayah before.

"Nominal" or "verbal" is **mine, by rule**: the first word that is not a
particle. The page says so.

**Rule on:** is one named grammarian's count right, or do you want a different
basis?

## G. The fourth school

**Chapter nine now has all four.** The Ḥanbalī column is **al-Mughnī** of Ibn Qudāma
(d. 620 AH) and **al-Mubdiʿ** of Burhān al-Dīn Ibn Mufliḥ (d. 884 AH), two of the three
works you named on 2026-10-30. The four sit two by two on a wide screen, since four
narrow columns of Arabic read badly, and one under another on a phone.

**The column differs from the other three, and the page says so.** Those three go
through the Qurʾān, so each has a passage on an ayah. These two go by the chapters
of fiqh, so the column is **every place they quote the ayah**: the book's chapter,
the section's heading, the paragraph with the quotation marked, the section whole
on request, and the volume and page with a link to that page on Shamela.

**How a place is found.** The Shamela typing of both editions marks each quotation
with its reference: «{وأشهدوا إذا تبايعتم} [البقرة: 282]». A quotation is kept only if
its words stand in the ayah named. `npm run gen:fiqh` writes `public/fiqh` (11 MB).

| | Quotations | Stand in the ayah named | Too short to test | Failed | Ayat |
|---|---:|---:|---:|---:|---:|
| al-Mughnī | 2,503 | 2,495 | 8 | 0 | 773 |
| al-Mubdiʿ | 1,184 | 1,182 | 2 | 0 | 545 |

Together that is 882 ayat in 3,115 places, against 972 for al-Jaṣṣāṣ. Moved on by
one ayah, about 1 in 100 of the same quotations still pass, where a phrase repeats.
Sampled against Shamela's own pages, 92 of 92 places stood on the volume and page
they name. A page mark in this copy closes its page, so the page is the first mark
after a quotation, not the one before it.

What this does not prove:

1. **A quotation is not a ruling.** A place may be incidental, or another school's
   proof that Ibn Qudāma goes on to answer. On 4:23 the first place is in the book
   of hire. The page says "quoted", keeps the book's order, and ranks nothing.
2. **395 of the 3,687 quotations are phrases found in more than one ayah**, such as
   «وآتوا الزكاة». There the ayah is the edition's choice, and the place shows under
   that ayah alone.
3. **A quotation with no reference is not placed**, and I did not search for ayat
   these copies quote without marking them.
4. **The bracketed headings are the edition's or the typist's**, not the authors'.
   Where the copy runs a heading into the text, a place shows none rather than the
   last one (187 places).
5. **Al-Mubdiʿ here is the commentary alone.** OpenITI split off the text of
   al-Muqniʿ printed above it, so only what Ibn Mufliḥ repeats of it appears.

**Ruled 2026-10-30: Ibn Taymiyya stays out of the column.** *Majmūʿ al-Fatāwā* is in
the same corpus, but its copy gives no references, so there is nothing to test a
place against, and you chose not to place him by his words alone. In its
fiqh volumes (21–35) are 9,881 quotations. By their words alone 4,087 fall on one
ayah, reaching 1,514 ayat, 1,034 of them not yet in the column, while 5,138 match no
single ayah. *Daqāʾiq al-tafsīr* is a modern gathering of his tafsir and is not
about rulings.

**Ruled 2026-10-30: Ibn al-Bannāʾ stays out too.** I could not find that a book of
his called *Āyāt al-Aḥkām* exists. The lists of his works I could read do not name
it, and those lists are partial, so this does not prove there is none.

## H. Page numbers

The master prompt asks for volume and page on every claim. **The page cites by
ayah instead, with a link to the same place on tafsir.app.** The copies carry
page marks for only some works, and no volume for any, so I would have been
giving part of a reference. Ibn Abī Ḥātim's reports are cited by his own numbers,
and hadith by collection number.

The master prompt also asks that every reference be checked against the named
edition before release. **I could not do that:** I have no printed editions, and
nor have I read the books through. Everything rests on tafsir.app's digitising.

**The Ḥanbalī column does give volume and page**, of al-Mughnī (Maktabat al-Qāhira,
1968) and al-Mubdiʿ (Dār al-Kutub al-ʿIlmiyya, 1997), because Shamela's typing keeps
them. That is still the typing, not the printed book.

## I. The mirror's permission

**Ruled 2026-10-30: you have verbal permission for the books used here, and the
requirement is that the sources are cited.** That covers the eleven grammars and
books of the readings, and al-Mughnī, al-Mubdiʿ and al-Itqān. I have not seen the
permission; this records what you told me.

They are cited everywhere they appear: under each passage, in chapter twelve, in
Settings, and in each folder's `SOURCE.md`. The Ḥanbalī books and al-Itqān are also
credited to OpenITI and Shamela, and link to the page on Shamela.

Two practical points remain true. The app reads the grammars, readings and Ḥanbalī
books from the site, so **it needs a connection for them**, and **they only appear
in the app once this is deployed**. And OpenITI publishes under CC BY-NC-SA 4.0, so
if Mishkāt ever earned money that licence would need another look.

## J. The other three languages

The page's words are in Spanish, Persian and Pashto, 305 sentences or so, by me
and unreviewed, Pashto most of all. The chapter names and grammar terms in the
English-only term tables (`src/components/ulum/terms.ts`) stay in English in
every language, with the transliterated term.

## K. Where the scholars differ

**Your ruling of 2026-10-30:** on every ayah, state what each scholar said, and
where they differ show it, distinct by colour, for scholars and grammarians alike.
Leave it at that for the reader.

**Where it comes from.** Writing this myself would be my judgement of what each
held. Three books already record it: they say how many views there are on a phrase,
number them, and name who held each.

| | Lists it states | Read whole | Views naming who held them |
|---|---:|---:|---:|
| Ibn al-Jawzī, Zād al-masīr | 4,789 | 84.5% | 71.7% |
| al-Māwardī, al-Nukat wa-l-ʿuyūn | 7,678 | 94.3% | 57.3% |
| al-Samīn al-Ḥalabī, al-Durr al-maṣūn (grammar) | 4,059 | 53.4% | 12.5% |

Together they give **4,180 of the 6,236 ayat** a recorded difference, on the phrase
it is about. `npm run check:ulum` measures this.

**How it shows.** Chapter eight opens with it and chapter three has the grammarians'.
Each question gives the book, the phrase and what they differ on in the book's
words. Each view has its own colour with its names beside it, and the page chooses
nothing. Al-Ṭabarī's own judgement stands beneath, in his colour, where he gives one.
Every scholar also keeps one colour across the site, on the ayah study and in the
tafsir page's Compare view.

**What it does not do:**

1. **A list that cannot be read whole is not shown.** A list cut short would say
   there are fewer views than the book says. So about 1 in 6 of Ibn al-Jawzī's and
   about half of al-Samīn's lists are not on the page, and an ayah can differ in a
   way this does not show. The 2,056 ayat with none are not ayat without difference.
2. **The views are each book's own.** I did not merge the two books' lists, so the
   same view can appear in both.
3. **Names are read from the book's wording.** "The book names no one" means I found
   no name in the form it uses. A name written another way can be missed.
4. **Al-Māwardī** is on the page for his lists. As I recall, some scholars accused
   him of leaning to the Muʿtazila; I have not checked this in a source.
5. **The other commentators are not sorted into views.** Chapter eight still sets
   their own words side by side, each in his colour.

## L. Weak reports, labelled

**Your ruling of 2026-10-30:** a weak report may be shown if it is labelled weak and
why, clearly and visibly. A red box on the report now says what is wrong, whether in
the chain or in what it says, and who says so. Three sources, and none of them mine:

| Who says so | Ibn Abī Ḥātim | al-Ṭabarī | al-Durr |
|---|---:|---:|---:|
| al-Suyūṭī, *al-Itqān* 4:239, on the routes from Ibn ʿAbbās | 475 | 1,352 | 142 |
| The editor's note in the copy | 0 | 152 | 0 |
| The chain itself names no one at a link | 177 | 1,531 | 106 |

Al-Suyūṭī's routes are al-Kalbī from Abū Ṣāliḥ, the chain of falsehood, Juwaybir,
Bishr ibn ʿUmāra, al-Ḍaḥḥāk from Ibn ʿAbbās, and al-ʿAwfī. The same routes are marked
where Ibn al-Jawzī or al-Māwardī name them in a list of views.

1. **Most reports carry no label, and that does not mean they are sound.** About
   3,900 of some 80,000 are marked. The rest keep "not graded here".
2. **The book text is not labelled.** The labels are on the report cards and the
   lists of views. A weak report inside a commentator's running text in chapter
   eight, or on the tafsir page, is not marked.
3. **"Unnamed narrator" is what the chain shows, not a grading by a scholar.** It
   covers «حدثت عن», «عن رجل» and the like.
4. **The Sunnah column still holds only al-Bukhārī and Muslim**, and Prophetic reports
   stay out of the tiers, because nothing on the shelf grades them all.
