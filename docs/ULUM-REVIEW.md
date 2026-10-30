# The ayah study — where things stand

The page from the Āyat al-Kursī handoff, at `/ayah/?v=2:255`, for all 6,236
ayat. This sheet is what you have to look at and rule on. The section letters
are for answering by, and will not move.

| Section | Status |
|---|---|
| **A** What was left out of the handoff | **Ruled: stays out** |
| **B** Who is on the shelf | **Ruled** — see the section; one question left on al-Jaṣṣāṣ |
| **C** Weak reports | **Ruled: shown, and labelled** (L) |
| **D** The Sunnah column | **Ruled: the Sunan added**, with al-Albānī's gradings |
| **E** The generations of the reports | **Ruled: the list stands, bare names resolved** |
| **F** The sentences of an ayah | **Ruled: every scholar's count shown** |
| **G** The fourth school | **Ruled: the column stands** |
| **H** Page numbers | **Ruled: citing by ayah is fine** |
| **I** The mirror's permission | **Ruled: verbal permission, cite the sources** |
| **J** The other three languages | **Ruled: kept as they are** |
| **K** Where the scholars differ | Built on your rulings; al-Māwardī removed |
| **L** Weak reports, labelled | Built on your rulings |
| **M** What each scholar was | **New, please check the list** |

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
| The Companions and Followers, from three books (E) | 5,162 | 82.8% |
| Qatāda | 4,679 | 75.0% |
| Runs of words shared with another ayah | 3,964 | 63.6% |
| Differences the books record (K) | 3,279 | 52.6% |
| The readings, any of the four books | 2,830 | 45.4% |
| The Sunnah column, the Ṣaḥīḥs and Sunan | 2,865 | 45.9% |
| Rulings, any book | 2,157 | 34.6% |
| Rulings, any of the four schools | 1,639 | 26.3% |
| Occasions of revelation, al-Wāḥidī | 539 | 8.6% |

---

## A. What was left out of the handoff, and why

**Ruled 2026-10-30: it stays out.** You said the handoff's data were guides to help,
not something to take. So its English tafsīr, summaries, positions, page numbers,
madd bars and "counted in the ayah" are not on the site. Chapter eleven holds the
books' own benefits instead.

## B. Who is on the shelf

**Ruled 2026-10-30.** Eleven books were added in a shelf of their own
(`src/lib/quran/ulumWorks.json`): the grammars of al-Naḥḥās, al-Samīn, al-Ṣāfī,
Darwīsh, al-Daʿʿās, al-Iʿrāb al-muyassar and al-Kharrāṭ, and the readings of Ibn
al-Jazarī, al-Kirmānī and al-Abyārī.

1. **Al-Rāzī, Ibn ʿĀshūr and Abū al-Suʿūd stay**, labelled (M). You said to "add them
   in"; the study page has them. I have **not** changed the introductions.
2. **Al-Samīn** is labelled Ashʿarī in creed and Shāfiʿī in fiqh. **Al-Naḥḥās** is
   labelled Ahl al-Sunnah, as you ruled, whatever tafsir.app's label says.
3. **Al-Māwardī is off the page.** He stays in the tafsir library, where he was
   before this work; say if you want him out of that too.
4. **Al-Kirmānī: two different men.** Our book is *Mafātīḥ al-aghānī* by Abū al-ʿAlāʾ
   al-Kirmānī (d. after 563 AH), a Ḥanafī. The *Lubāb al-tafāsīr* and *Gharāʾib
   al-tafsīr* you described are by Tāj al-Qurrāʾ Maḥmūd ibn Ḥamza al-Kirmānī, which is
   not on the shelf. I still checked ours as you asked, on every creed-sensitive word
   across its 657 passages. One passage goes against Ahl al-Sunnah: at 6:114 he says
   the Qurʾān was not truly sent down («ظاهره مجاز… بل القرآن تنزيل وإنزال لا منزل»).
   It is **left out**, and a note on that ayah says so. The rest is readings.
5. **Al-Iʿrāb al-muyassar's author is not confirmed.** One listing ties a book of
   nearly that name to Muḥammad al-Ṭayyib al-Ibrāhīm, but I found no copy to compare
   the text with, and an exact-text search matched nothing. The page still says
   tafsir.app names no author. It will say his name the moment a copy matches.
6. **Al-Kashshāf, al-Akhfash and Muqātil ibn Sulaymān stay out.** A chain ending at a
   bare «مقاتل» that cannot be Ibn Ḥayyān is now taken to be him and left off (E).
   Ibn al-Jawzī's lists do name Muqātil in places, as his book wrote it.

**One question:** al-Jaṣṣāṣ, the Ḥanafī column, was also accused of leaning Muʿtazilī,
as far as I recall. You removed al-Māwardī on that ground. He has no creed label for
now. Should he stay, with what label?

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

**Ruled 2026-10-30: the Sunan are in, with al-Albānī's gradings.** 1,267 hadith from
Abū Dāwūd, al-Tirmidhī and Ibn Mājah, each matched to what Ibn Kathīr quotes, the same
test as the two Ṣaḥīḥs, and each showing al-Albānī's grade; the weak ones show it in
red. One with no grading from him is left out. Together the column reaches 2,865 ayat.

**Al-Nasāʾī has none yet**, because Ibn Kathīr's editor cites him by volume and page or
by al-Kubrā's numbers, and the corpus holds al-Mujtabā's.

**Prophetic reports elsewhere:** as you ruled, graded ones show and ungraded ones do
not. Al-Ṭabarī's editor grades some, and those appear in this column with his words.

## E. The generations of the reports

**Ruled 2026-10-30: the list stands, and bare names must be resolved.**

Chapter seven's Companions and Followers come from three books. An ayah takes the first
of them with a report of these generations on it:

| In turn | Ayat it gives | Chains |
|---|---:|---|
| Ibn Abī Ḥātim | 2,108 | Yes, with his numbers |
| al-Ṭabarī | 2,693 more | Yes |
| al-Durr al-manthūr of al-Suyūṭī | 361 more | **No**, and each says so |

That is **5,162 of the 6,236 ayat**. Tafsir.app's copy of Ibn Abī Ḥātim has only surahs
1–13 and 23–29. The 1,074 left have no report placed on them in any of the three.

The generation is read from the last link of the chain. Over each whole book:

| | Ibn Abī Ḥātim | al-Ṭabarī | al-Durr |
|---|---:|---:|---:|
| Companions | 3,453 | 6,821 | 10,504 |
| Followers | 9,177 | 20,038 | 14,442 |
| The generation after them | 1,189 | 3,169 | 1,431 |
| Prophetic, shown only if graded | 432 | 1,110 | 6,114 |
| Not placed | 2,079 | 3,567 | 5,183 |

**How a bare name is resolved** (`BARE` in `src/lib/ulum/read.ts`), and the card says
what the chain itself wrote:

- «عبد الله» is Ibn Masʿūd, the usage of the Kūfan chains.
- «علي» is ʿAlī ibn Abī Ṭālib, and «جابر» is Jābir ibn ʿAbd Allāh.
- «سعيد» is Ibn Jubayr, or Ibn al-Musayyab from Qatāda and al-Zuhrī.
- «مقاتل» is Ibn Ḥayyān from Bukayr or in Ibn Abī Ḥātim, and otherwise left off.
- «عن أبيه» follows the son: Ibn Ṭāwūs's father is Ṭāwūs, Hishām's is ʿUrwa, and so on.

These are conventions, so a rare exception can be wrong. The reports still unplaced are
mostly thousands of rarely named men, not bare names. A fuller list could be taken from
Ibn Ḥajar's *Taqrīb al-tahdhīb*, which gives every narrator's generation.

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

**Ruled 2026-10-30:** every scholar's count is shown, and none is dropped. Where a
commentator states a number, chapter three now sets the counts side by side in each
one's colour: on 2:255, al-Ṣāfī's seven beside Ibn Kathīr's and al-Jazāʾirī's ten. The
sentences drawn stay al-Ṣāfī's, because his is the only list that gives each sentence
on every ayah. No book records which count is strongest, so the page does not say.

## G. The fourth school

**Ruled 2026-10-30:** the column stands as "the places they quote the ayah", and
Ibn Taymiyya and Ibn al-Bannāʾ stay out.

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

**Ruled 2026-10-30:** citing by ayah with a link is acceptable.

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

**Ruled 2026-10-30:** they stay as they are.

The page's words are in Spanish, Persian and Pashto, 305 sentences or so, by me
and unreviewed, Pashto most of all. The chapter names and grammar terms in the
English-only term tables (`src/components/ulum/terms.ts`) stay in English in
every language, with the transliterated term.

## K. Where the scholars differ

**Your rulings of 2026-10-30:** on every ayah, state what each scholar said. Where they
differ, show it, distinct by colour, for grammarians too. Air out every view, then say
what the majority hold, or the consensus, or which scholar called which view strongest.

**Where it comes from.** Writing this myself would be my judgement of what each held.
These books record it, and al-Māwardī is gone as you ruled:

| | Lists it states | Read whole | Views naming who held them |
|---|---:|---:|---:|
| al-Ṭabarī, «اختلف أهل التأويل» | 720 | 84.4% | 88.2% |
| Ibn al-Jawzī, Zād al-masīr | 4,789 | 84.5% | 71.6% |
| al-Samʿānī | 515 | 47.8% | 8.4% |
| al-Qurṭubī | 856 | 17.6% | 32.9% |
| al-Shinqīṭī | 548 | 46.0% | 13.4% |
| al-Samīn, the grammar | 4,059 | 53.4% | 11.9% |

Together they give **3,279 of the 6,236 ayat** a recorded difference, down from 4,180
with al-Māwardī.

**How it shows.** Each question is a card in a deck: the book, the phrase, what they
differ on, then each view in its colour with its names. Where a book says a view is
strongest, the majority's, or agreed on, the view says so and says who said it (23,
222 and 11 of Ibn al-Jawzī's). Al-Ṭabarī's own judgement stands beneath in his words.

**What it does not do:**

1. **It does not guess which view al-Ṭabarī's judgement means.** I tried, and it
   marked the wrong view at 21:104. A wrong mark would put words in his mouth, so his
   judgement stands in his own words and the reader sees what he chose.
2. **A list that cannot be read whole is not shown.** A short list would misstate the
   book. So the 2,957 ayat with none are not ayat without difference.
3. **The same view can appear under two books**, as I do not merge their lists.
4. **Chapter eight's other commentators are not sorted into views**, as no book of
   theirs lists them. Their words stand side by side, each in his colour.
5. **Scholars keep one colour across the ayah study, the tafsir page and the lexicons
   on the word study page.** The word study page has the colours but no differences.

## L. Weak reports, labelled

**Your ruling of 2026-10-30:** weak reports may be shown if they are labelled weak, with
why, clearly and visibly. The introductions keep their rule: nothing weak goes in them.

A red box on the report says what is wrong, whether in the chain or the text, and who
says so. Inside a commentator's running text, in chapter eight and on the tafsir page,
a named weak route is underlined with a small red mark that opens the same reason.

| Who says so | Ibn Abī Ḥātim | al-Ṭabarī | al-Durr |
|---|---:|---:|---:|
| al-Suyūṭī, *al-Itqān* 4:239, on the routes from Ibn ʿAbbās | 475 | 1,352 | 142 |
| The editor's note in the copy | 0 | 152 | 0 |
| The chain itself names no one at a link | 177 | 1,531 | 106 |

1. **Most reports carry no label, and that does not mean they are sound.** About 3,900
   of some 80,000 are marked. The rest say "not graded here".
2. **Running text is marked only where a route is named** in a form the page can read.
   A weak report told another way is not marked.
3. **"Unnamed narrator" is what the chain shows**, not a scholar's grading.

## M. What each scholar was

**Your ruling of 2026-10-30:** label each scholar for what he was, so the reader follows
with discernment. The labels sit beside his name wherever he is cited
(`src/lib/ulum/scholars.ts`). **Apart from al-Samīn and al-Naḥḥās, these are from my own
knowledge, not checked in a source. Please correct any.**

| Creed | Scholars |
|---|---|
| Ahl al-Sunnah | al-Ṭabarī, Ibn Abī Ḥātim, al-Naḥḥās, Ibn Qutayba, al-Baghawī, al-Samʿānī, Ibn Qudāma, Ibn Kathīr, Ibn Mufliḥ, al-Shinqīṭī, Ibn ʿUthaymīn, al-Jazāʾirī, al-Ṭarīfī |
| Ashʿarī | al-Harrāsī, Ibn al-ʿArabī, al-Rāzī, al-Qurṭubī, al-Samīn, al-Biqāʿī, al-Suyūṭī, Ibn ʿĀshūr |
| Māturīdī | Abū al-Suʿūd |
| No creed label | Ibn al-Jawzī, al-Jaṣṣāṣ, al-Wāḥidī, Makkī, Ibn al-Jazarī, al-Kirmānī, the modern grammarians |

Fiqh is shown where it is known: Ḥanafī, Mālikī, Shāfiʿī, Ḥanbalī, or al-Ṭabarī's own
school. **Ibn al-Jawzī has no creed label** because I did not want to word it wrongly:
he was Ḥanbalī, and criticised by Ḥanbalīs for his interpretation of the attributes.
