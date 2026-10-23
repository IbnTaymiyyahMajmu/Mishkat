# Surah introductions — where things stand

What you have ruled on, what I did with each ruling, and what is still open.
The section letters are the ones you answered by, so they have not moved.

A page is at `/read/<n>/about/`, and its text is `src/content/intros/<n>.json`.
After any correction: `npm run lock:intros`.

| Section | Status |
|---|---|
| **A** Which works are quoted | **Settled** — "fine, I'm happy with it" |
| **B** Hadith gradings | **Ruled: al-Albānī's grading; nothing weak or fabricated given or mentioned; a grading I could not see in his book stays, underlined, with a note.** Applied. One word for you to check (B2) |
| **C** Occasions with no graded chain | **Ruled: keep what the majority relate; tell you who holds the rest.** Thirteen kept; **four for you to decide** (C2) |
| **D** Where each surah came down | **Settled** — "that's fine" |
| **E** Dating | **Ruled: mark the doubt, give the reason on hover.** Done |
| **F** Reports told in the prose | Mostly closed by the ruling on B. Twenty-nine sentences still carry a sign |
| **G** Wording | **Open** — you have not said |
| **H** What I did not do | **Open** |
| **I** The stories, told in full | **New.** Seventeen written from the hadith texts; three things to look at |

**What is not in doubt**, so you need not look at it:

- The 591 Arabic quotations. Each is found in the site's copy of the book by
  the lock script and printed as the copy has it.
- The counted facts — ayat, words, pages, juzʾ, the place in the order.
- The hadith *numbers* for all six books, checked against an open corpus —
  apart from the two in B4.

---

## B. Hadith — what the ruling did

**"Take the grading from al-Albānī. Weak or fabricated hadith: don't include
or mention it."**

193 narrations are now given across the 114 pages:

| How it stands | How many | What the page prints |
|---|---:|---|
| In al-Bukhārī or Muslim | 147 | *Ṣaḥīḥ* |
| Graded ṣaḥīḥ, outside the two | 34 | "Ṣaḥīḥ according to al-Albānī" — 33 of them; one has no grading of his that I could find (B3) |
| Ḥasan | 10 | "Ḥasan according to al-Albānī" |
| A Companion's own saying | 2 | His grading of the chain, and that it is a Companion's saying |

### B1. What was changed

- **Every grading outside the two Ṣaḥīḥs now reads as al-Albānī's alone.**
  Where a page used to say "Ḥasan gharīb, said al-Tirmidhī; ṣaḥīḥ according
  to al-Albānī", it now says "Ṣaḥīḥ according to al-Albānī". For the four
  Sunan the grading is the one an open hadith corpus records for him, and I
  ran every narration and every occasion cited from those four books against
  it again after the change: they agree, except the one in B2.
- **One narration was taken out**: on 4 al-Nisāʾ, Ibn Masʿūd's "five ayat in
  al-Nisāʾ dearer to me than the world" (al-Ḥākim; its chain is broken).
- **The notes that named weak reports are gone.** Twenty-one pages carried a
  paragraph saying "the hadith that Yā-Sīn is the heart of the Qurʾan is
  weak", and the like. All removed: 2, 5, 6, 11, 12, 18, 20, 23, 24, 36, 44,
  53, 55, 56, 59, 67, 69, 76, 97, 98, 99. Four more kept only the part that
  was not about a weak report (9, 16, 17, 22). The eight notes that remain
  (7, 9, 13, 15, 16, 17, 22, 25) say things like "the fifteenth ayah is an
  ayah of prostration"; the heading over them now reads **A note**, not *A
  caution*.
- **Occasions of revelation removed** — six:

  | Page | The occasion | Why |
  |---|---|---|
  | 15 al-Ḥijr | "Proclaim what you are commanded" ended the hidden years | Abū ʿUbaydah from his father, whom he did not hear |
  | 18 al-Kahf | The three questions from the rabbis of Yathrib | Ibn Isḥāq; an unnamed narrator in the chain |
  | 18 al-Kahf | "I will tell you tomorrow" | The same report |
  | 38 Ṣād | "One word" — Quraysh at Abū Ṭālib's sickbed | al-Tirmidhī 3232; al-Albānī: its chain is weak |
  | 38 Ṣād | A paragraph saying the stories told of Dāwūd's trial are unsound | It gave no report; it only said the reports are weak |
  | 13 al-Raʿd | Arbad ibn Qays and the thunderbolt | No sound chain that I know of. **Put back this round**, by your rule on C: it is the majority's saying — see C1 |

- **Things told in the prose and now gone**:

  | Page | What was there |
  |---|---|
  | 18 al-Kahf | "What was happening" was built on the three questions. Rewritten, four new paragraphs, from the surah itself and from what is in Muslim. **Please read it** — it is the largest piece of new writing |
  | 20 Ṭā-Hā | ʿUmar setting out to kill the Prophet ﷺ and reading the opening of Ṭā-Hā. The page no longer dates the surah by his Islam |
  | 6 al-Anʿām | That it came down in one night with seventy thousand angels |
  | 12 Yūsuf | "No reproach upon you today", as said to Quraysh at the Conquest. The page still sets the two moments side by side, without the quotation |
  | 15 al-Ḥijr | The end of the secret call, in the account of when it came down |
  | 17 al-Isrāʾ | One phrase in the fifth paragraph |
  | 36 Yā-Sīn | That the man was called Ḥabīb and the town was Antioch |
  | 38 Ṣād | The opening rewritten without the scene at Abū Ṭālib's bedside; the period moved to the middle years in Makkah |
  | 69 al-Ḥāqqah | ʿUmar hearing the surah before his Islam |
  | 86 al-Ṭāriq | The report in Aḥmad. The account is two paragraphs now |

The lock script now refuses a report ranked weak, and a sentence marked
`{weak}`, so one cannot come back by accident.

### B2. Abū Bakr's wager (30 al-Rūm) — rebuilt on the hadith you named

You pointed me to **al-Tirmidhī 3194**, the narration of Niyār ibn Mukram
al-Aslamī. The occasion is now told in full from it — Abū Bakr crying the
ayat through the quarters of Makkah, the stake, the six years, the seventh —
with Ibn ʿAbbās's shorter report (3193) set after it.

One thing differs from what you wrote, and I have printed what I found, not
what I was told, so that you can correct me:

| Hadith | You said | What I found |
|---|---|---|
| 3194, Niyār ibn Mukram | Ṣaḥīḥ according to al-Albānī | **Ḥasan** according to al-Albānī (*Ṣaḥīḥ Sunan al-Tirmidhī*, as al-Durar al-Saniyyah indexes it). "Ḥasan ṣaḥīḥ gharīb" is al-Tirmidhī's own grading of it |
| 3193, Ibn ʿAbbās | — | **Ṣaḥīḥ** according to al-Albānī, by the same index |

So the page says: "Niyār ibn Mukram al-Aslamī: al-Tirmidhī (3194); ḥasan
according to al-Albānī. Ibn ʿAbbās: Aḥmad and al-Tirmidhī (3193); ṣaḥīḥ
according to al-Albānī." It is marked *Graded ṣaḥīḥ* on the strength of Ibn
ʿAbbās's report, underlined, with a note saying which grading belongs to
which. **If you have the book and it says ṣaḥīḥ for 3194, tell me and I will
change the one word.**

This also settles the conflict I raised last time: the open corpus's "Daif"
on 3193 and 3194 is wrong; the index has ṣaḥīḥ and ḥasan.

### B3. Gradings of his that I found by search, not in his books

**You ruled: they stay, and the page shows it.** Each of these gradings is
now underlined with a dotted line, and a small **?** beside it opens the
sentence: "This is al-Albānī's grading as an index of his works records it;
it has not yet been checked here against the printed book." For the two
reports told in the prose (17 and 19) the same sign follows the sentence.
When a grading has been seen in the book, the note comes off: it is one
field, `caveat`, in the page's file.

I cannot open dorar.net or sunnah.com directly; both refuse automated
reading. A search engine can read their index, and these come from that.
Each agrees with what I remembered, but **none has been seen on the page of
the book**.

| Page | The report | What the page prints | Found as |
|---|---|---|---|
| 12 Yūsuf | Saʿd: "If only you would tell us stories" (occasion) | Ṣaḥīḥ according to al-Albānī (*Ṣaḥīḥ Mawārid al-Ẓamʾān*, 1462) | Ibn Ḥibbān 6209. Ibn Ḥajar: ḥasan |
| 16 al-Naḥl | Ibn Masʿūd: the most comprehensive ayah is 16:90 | Its chain is ḥasan according to al-Albānī (*Ṣaḥīḥ al-Adab al-Mufrad*, 376) | **The number is the likeliest match, not a certain one** |
| 17 al-Isrāʾ | ʿĀʾishah: some who had believed fell away after the Night Journey (in the prose) | Told plainly, with no sign | *al-Silsilah al-Ṣaḥīḥah*, 306. Others fault the chain (Muḥammad ibn Kathīr al-Ṣanʿānī from Maʿmar). It carried a "related" sign before; I removed it on his grading |
| 18 al-Kahf | Whoever recites al-Kahf on Friday, a light shines for him between the two Fridays | Ṣaḥīḥ according to al-Albānī (*Ṣaḥīḥ al-Jāmiʿ*, 6470) | — |
| 19 Maryam | Jaʿfar reciting from Maryam before the Negus (in the prose) | Told plainly, with no sign | Umm Salamah, through Ibn Isḥāq and Aḥmad. al-Albānī: its chain is ṣaḥīḥ (*Fiqh al-Sīrah*, p. 115) |
| 67 al-Mulk | Ibn Masʿūd: it protects from the punishment of the grave | Ḥasan according to al-Albānī (*Ṣaḥīḥ al-Targhīb*) | I found two numbers for it, 1475 and 1589, so **the page prints none** |
| 103 al-ʿAṣr | Two Companions would not part until one had recited it to the other | Ṣaḥīḥ according to al-Albānī (*al-Silsilah al-Ṣaḥīḥah*, 2648) | — |
| 113 al-Falaq | Jibrīl brought the two surahs of refuge down when he ﷺ was bewitched (occasion) | Ṣaḥīḥ according to al-Albānī (*al-Silsilah al-Ṣaḥīḥah*, 2761) | Zayd ibn Arqam. It was "related, not graded" before. The same hadith without the two surahs is al-Nasāʾī 4080, which the corpus also has as ṣaḥīḥ from him |

Two have **no grading of al-Albānī that I could find**, and stand on another
scholar's:

| Page | The report | What the page prints |
|---|---|---|
| 5 al-Māʾidah | ʿĀʾishah to Jubayr ibn Nufayr: it is the last surah revealed; hold lawful what it makes lawful | "Ṣaḥīḥ by the standard of al-Bukhārī and Muslim, said al-Ḥākim, and al-Dhahabī agreed" |
| 36 Yā-Sīn | al-ʿĀṣ ibn Wāʾil and the crumbled bone (occasion) | "al-Ḥākim, who graded it ṣaḥīḥ" |

Both stay, by your ruling, underlined, with the note: "No grading by
al-Albānī was found for this report. The grading given is al-Ḥākim's, and
al-Dhahabī agreed with it."

And three things in the notes rest on my memory of the Muwaṭṭaʾ, not on a
grading: on 13, Ibn al-Zubayr's words on hearing thunder; on 22, that
prostrating twice in al-Ḥajj is reported from ʿUmar and his son; on 16, that
16:90 is read at the close of the Friday sermon in much of the Muslim world
(a statement about practice, not a report).

### B4. Two numbers in Ṣaḥīḥ Muslim the corpus could not confirm

| Page | Hadith | Cited as | Why it is unconfirmed |
|---|---|---|---|
| 46 al-Aḥqāf | Saʿd: "I never heard the Prophet ﷺ say of anyone walking the earth that he is of the people of the Garden, except ʿAbd Allāh ibn Salām" | Muslim 2483 | The corpus goes from 2482 to 2484 |
| 54 al-Qamar | The idolaters of Quraysh came disputing about the decree, and 54:47–49 came down | Muslim 2656 | The corpus has it at 2657, and is one out for the three before it |

I believe both are right by ʿAbd al-Bāqī's count. Please look them up.

### B5. A sentence of mine about the gradings, in your site's name

Under *Sources* on every page:

> Every hadith here says where it is recorded and how it is graded. What is
> in al-Bukhārī or Muslim is marked ṣaḥīḥ. Outside the two, the grading
> followed is al-Albānī's; where none of his was found, the scholar who
> graded it is named. A report known to be weak or fabricated is not given
> here at all. […]

Change a word of it, or all of it.

---

## C. Occasions with no graded chain — what your rule did

**"If they are accepted by the majority of Ahl al-Sunnah wa-l-Jamāʿah then
keep; otherwise let me know who accepts them and I'll decide."**

I took "the majority" as something I could count. The site holds seven
commentaries of transmitted reports by scholars of Ahl al-Sunnah — al-Ṭabarī,
al-Baghawī, Ibn al-Jawzī, al-Qurṭubī, Ibn Kathīr, al-Suyūṭī (*al-Durr
al-Manthūr*) and al-Shawkānī. For each occasion I searched all seven under
that ayah, and looked for any of them saying in words that it is the
majority's saying. An occasion is kept if most of the seven relate it, or one
of them says the majority hold it.

137 occasions are now on the pages: 98 in al-Bukhārī or Muslim, 16 graded
ṣaḥīḥ, 6 ḥasan, and 17 related without a graded chain.

### C1. Kept — the majority relate them (13)

Each still prints *Related, not graded* under it; its source line now says
who relates it.

| Page | About | The occasion | Of the seven | Said in words |
|---|---|---|---:|---|
| 13 al-Raʿd | 13:13 | Arbad ibn Qays and the thunderbolt | 6 | Ibn al-Jawzī: "this is the saying of the majority" |
| 18 al-Kahf | 18:28 | The nobles and the poor | 6 | — |
| 20 Ṭā-Hā | 20:1–2 | "Only to make him miserable" | 6 | — |
| 29 al-ʿAnkabūt | 29:1–3 | Those who were turned back | 5 | — |
| 41 Fuṣṣilat | 41:1–13 | ʿUtbah ibn Rabīʿah | 5 | — |
| 50 Qāf | 50:38 | "No weariness touched Us" | 7 | — |
| 70 al-Maʿārij | 70:1–2 | al-Naḍr ibn al-Ḥārith asked for it | 6 | Ibn al-Jawzī: "the position of the majority, among them Ibn ʿAbbās and Mujāhid" |
| 74 al-Muddaththir | 74:11–26 | al-Walīd ibn al-Mughīrah | 7 | al-Qurṭubī: "the commentators hold that he is al-Walīd ibn al-Mughīrah" |
| 78 al-Nabaʾ | 78:1–3 | What they were asking one another | 4 | — |
| 92 al-Layl | 92:17–21 | Abū Bakr al-Ṣiddīq | 5 | Ibn Kathīr: some reported the commentators' agreement on it |
| 104 al-Humazah | the surah | One man, or every such man | 6 | al-Qurṭubī: that it is general "is the saying of the majority". The page now says so |
| 108 al-Kawthar | the surah | al-ʿĀṣ ibn Wāʾil: "a man cut off" | 7 | Ibn al-Jawzī: Ibn ʿAbbās, Saʿīd ibn Jubayr, Mujāhid and Qatādah |
| 109 al-Kāfirūn | the surah | A year for a year | 7 | — |

**One of these I had taken out last time and have put back: Arbad and the
thunderbolt (13).** I removed it because I know of no sound chain for it.
By the rule you have now given, it returns: six of the seven relate it and
Ibn al-Jawzī calls it the majority's saying. If you would rather the earlier
ruling governed — a report with weak chains is left out even when the
commentators relate it — say so, and it goes again, and so would 109.

### C2. Not the majority's — yours to decide (4)

| Page | What it is | Who relates or holds it | Against it |
|---|---|---|---|
| 13 al-Raʿd, 13:13 | A second account of the thunderbolt: Anas — a tyrant among the Arabs, called to Allah three times, who asked what Allah is made of | al-Ṭabarī, Ibn al-Jawzī, Ibn Kathīr (3 of 7). Abū Yaʿlā and al-Bazzār record it; al-Haythamī says al-Bazzār's men are trustworthy. I recall al-Albānī grading it ṣaḥīḥ (*Ẓilāl al-Jannah*, 692) and could not confirm it | Only three relate it. It now stands beside the Arbad account, not in place of it |
| 37 al-Ṣāffāt, 37:102–107 | "Which son" — the page gives Ibn Kathīr's case that the son to be sacrificed was Ismāʿīl | Ismāʿīl: Ibn Kathīr, who argues it at length from the order of the ayat; it is also the position of Ibn Taymiyyah and Ibn al-Qayyim | **al-Qurṭubī says "most of them said: the one to be sacrificed was Isḥāq"**, and names al-ʿAbbās, Ibn ʿAbbās and Ibn Masʿūd; al-Ṭabarī also preferred Isḥāq. The page gives one side only. Tell me whether to keep it as it is, give both, or take it out |
| 102 al-Takāthur | "Counting the dead" — two accounts | (a) Some of the Jews: Qatādah — in al-Baghawī, Ibn al-Jawzī, al-Qurṭubī, al-Suyūṭī, al-Shawkānī. (b) Banū ʿAbd Manāf and Banū Sahm counting their graves: Ibn al-Sāʾib al-Kalbī and Muqātil — in al-Baghawī, Ibn al-Jawzī, al-Qurṭubī, al-Shawkānī | Neither is called the majority's. A third (two clans of the Helpers) is in Ibn Kathīr and al-Suyūṭī. And al-Kalbī and Muqātil are not narrators the scholars of hadith rely on |
| 112 al-Ikhlāṣ | "Three reports of who asked" — the second of them: ʿĀmir ibn al-Ṭufayl | al-Baghawī and Ibn al-Jawzī only (2 of 7), from Ibn ʿAbbās | The other two reports in that entry are widely related (the idolaters: ḥasan, above it on the page; the rabbis: 6 of 7). I would drop ʿĀmir's and keep the rest |

All four are still on the pages, marked *Related, not graded*, until you say.

---

## E. Dating — what the ruling did

**"The dates you are unsure of: add a marker, and the reason for the doubt,
so that when they hover over it they are made aware."**

A small dashed **?** now follows anything dated or counted that is not
certain. Resting the pointer on it, touching it on a phone, or tabbing to it
opens the reason under the line. It is checked at desktop and phone width, in
the day and night themes.

**On every page**, in the line over the timeline:

| After | The reason shown |
|---|---|
| "53rd of the 114 surahs to come down" | The order of revelation is the one printed at the head of each surah in the Egyptian muṣḥaf, which rests on lists transmitted from Ibn ʿAbbās and Jābir ibn Zayd. It places a surah by where it began. Many surahs came down in parts, over years, and the scholars treat the list as a guide, not a certainty. |
| "the last years in Makkah" | "First", "middle" and "last" are an estimate, made from the surah's place in the traditional order and from what it speaks of. No date is transmitted for most surahs. |

**On particular pages** — eight:

| Page | After the words | The reason shown |
|---|---|---|
| 3 Āl ʿImrān | "Ibn Kathīr dates their coming to the ninth year" | This is Ibn Kathīr's dating of the delegation. The middle of the surah is about Uḥud, in the third year; so the surah did not come down at one time, and which part came first is not settled. |
| 5 al-Māʾidah | "He ﷺ lived some eighty days more" | Eighty-one nights is the figure usually given, from Ibn Jurayj. It is not from a graded hadith. |
| 8 al-Anfāl | "on the seventeenth of Ramaḍān in the second year" | The seventeenth is the date most of the scholars of sīrah give. Other days of that Ramaḍān are also reported. |
| 8 al-Anfāl | "two horses and seventy camels" | These figures are from the sīrah, as Ibn Isḥāq gives them. They are not from a graded hadith. |
| 12 Yūsuf | "the period in which the Prophet ﷺ lost Khadījah and his uncle Abū Ṭālib" (in two places) | No report dates this surah. That it belongs to those years follows only from its place in the traditional order of revelation, which is a guide and not a certainty. |
| 17 al-Isrāʾ | "about a year before the Hijrah" (in two places) | The reports of when the Night Journey took place differ by years. About a year before the Hijrah is the saying most often given; Ibn Isḥāq tells of the Journey before the deaths of Khadījah and Abū Ṭālib. |

The sixth date I had listed — 15 al-Ḥijr and the end of the secret call —
needed no marker: the report was weak, and it is gone (B1).

The reasons are my wording. Each is the text between `{?` and `}` in the
page's file; change any of them there. **If there is a date on some other
page that you would have marked, tell me the page.**

---

## F. Reports told in the prose

The ruling on B closed most of this: the stories with weak chains are out
(B1), and two were found to be graded sound by al-Albānī and lost their sign
(B3: 17 and 19).

What remains is **30 sentences on 27 pages** that tell of something the
commentators or the scholars of sīrah relate, each followed by a small ◇ and
explained in a key under the account. They are the prose side of section C,
and whatever you decide there I will carry through here.

| Page | The sentence ends… |
|---|---|
| 3 | …sixty riders strong, and pressed one question: if ʿĪsā is not the son of God, then who was his father? |
| 9 | …a desert Arab who heard this surah recited and said: I think this is among the last of what came down. |
| 13 | …one of whom was burned by a bolt out of a clear summer sky. · …at the third, a bolt fell on him from a cloud over his head. |
| 20 | …three reports of what its opening came down about, and they point the same way. |
| 21 | …people going about their amusements while the account draws closer. |
| 25 | …about ʿUqbah ibn Abī Muʿayṭ, who had begun to listen and was turned back by a friend's scorn. |
| 29 | …those who were tortured for their faith, ʿAmmār among them. |
| 30 | …the Persians had no scripture…; the Byzantines were a people of a Book. |
| 31 | …the tales of the Persian kings… (al-Naḍr ibn al-Ḥārith) |
| 36 | …a scene the commentators tie to a particular man. |
| 41 | …Ibn Kathīr gives the story at the head of the surah, from several routes. |
| 54 | …ʿUmar is reported to have wondered what host was meant. |
| 55 | …Ibn al-Jawzī relates from Muqātil that this surah came down in reply. |
| 61 | …some had asked for fighting to be prescribed and then hung back when it was. |
| 68 | …most say al-Walīd ibn al-Mughīrah. |
| 70 | …al-Naḍr ibn al-Ḥārith, in the view of Ibn ʿAbbās, Mujāhid and the majority; others said Abū Jahl. |
| 72 | …on his return from Ṭāʾif, in the tenth year of the mission. |
| 74 | …Abū Jahl is reported to have mocked it: nineteen — surely ten of you can deal with each of them. |
| 78 | …arguing and disputing over it, and the surah came down. |
| 92 | …why not free strong men who could protect you? · …Abū Bakr is simply the first of the community to whom it applies. |
| 102 | …went out to the graveyard to count their dead. |
| 104 | …al-ʿĀṣ ibn Wāʾil; al-Walīd ibn al-Mughīrah; Umayyah ibn Khalaf, who tortured Bilāl. |
| 105 | …set out north with an army and an elephant. · …The elephant, the reports say, knelt and would not go forward. |
| 107 | …the commentators name several men it was said to be about. |
| 108 | …Ibn Kathīr gathers the reports. |
| 109 | …the reports name the men: al-Walīd ibn al-Mughīrah, al-ʿĀṣ ibn Wāʾil, al-Aswad ibn al-Muṭṭalib, Umayyah ibn Khalaf. |
| 112 | …by rabbis who asked what kind of thing He was and who would inherit from Him. |

I did not mark what is plainly history as the scholars of sīrah transmit it —
the campaigns, who was at Badr — and *Sources* says such things are not graded
here.

---

## G. Wording — **open**

### G1. The ayat inside the prose are my paraphrase

Where a paragraph says *"We did not create the heaven and the earth in play"*,
that English is mine, written to sit in a sentence. It is not any published
translation. The reader's own chosen translation is what appears under the key
ayah and in the reader. If you want the prose to quote one translation
throughout instead, name it.

### G2. The attributes of Allah are stated as the text states them

No interpretation is offered anywhere. These are the places, so that you can
read the exact English:

| Page | The words |
|---|---|
| 7, 10, 13, 20, 25, 32, 57 | "then rose over the Throne" (for *istawā ʿalā l-ʿarsh*) |
| 5 al-Māʾidah | "rather, both His hands are outstretched" |
| 11 Hūd | "The Hand of Allah is full… in His Hand is the balance" (hadith) |
| 50 Qāf | "until the Lord of might places His Foot in it" (hadith) |
| 2 al-Baqarah | "His Kursī extends over the heavens and the earth"; "there is the Face of Allah" |
| 76 al-Insān | "for the Face of Allah" |
| 6 al-Anʿām | "I seek refuge in Your Face" (hadith) |
| 10 Yūnus | "He will lift the veil… looking upon their Lord" (hadith) |
| 39 al-Zumar | "The earth is wholly in His grip and the heavens are rolled up in His right hand"; and the rabbi's words, which the Prophet ﷺ confirmed, that Allah "will place the heavens on a finger" (hadith) |

"Rose over" is the rendering I would most like confirmed.

### G3. Small things

- Scholars' names are written without assimilation — *al-Ṭabarī*, *al-Shawkānī*
  — throughout.
- ﷺ follows a mention of the Prophet. No formula follows a Companion's name in
  the English; the Arabic quotations keep whatever their book has.

---

## H. What I did not do

- **Hold the occasions against a ṣaḥīḥ collection of them.** al-Wādiʿī's
  *al-Ṣaḥīḥ al-Musnad min Asbāb al-Nuzūl* is the yardstick; the site's library
  does not hold it. C1 is a count of who relates each report, which is what
  you asked for; it is not a grading.
- **See al-Albānī's gradings in his own books.** For the four Sunan they are
  as an open corpus records them; for the eight in B3, as a search found them.
- **Use four works that are on the approved list.** al-Ṭabarī, Ibn al-Qayyim,
  al-Shinqīṭī and Ibn ʿUthaymīn are allowed and not yet quoted. The copy of the
  last three covers only some surahs. What I would do with them, if you want
  it: a short part on each page they reach — "What the scholars drew from it" —
  with two or three sentences of theirs in Arabic and what each says in
  English. It is a real piece of work and I did not begin it without asking.
- **Anything in Pashto, Persian or Spanish.** The introductions are in English
  only. The labels around them exist in all four languages so that the site
  builds, and the sentence in B5 was changed in all four; those three
  translations are unread by anyone who speaks the language.

## I. The stories, told in full

**"The more you can expand on stories the better; the more detailed they are
the happier I am. Of course it has to be reliable."**

Seventeen accounts are now told at length — about 9,400 words between them —
on fifteen pages. Each is set as a passage of its own under its title, with a
hairline down its edge.

**How each was written, so that you can judge "reliable":** I opened the
Arabic text of the hadith in the open corpus, by its number, read it through,
and told it in order in English. Nothing in a story is from memory, and
nothing is in a story that its narrator did not say. Where I left something
out it was for length; the places are noted below. The words in quotation
marks are my English for the Arabic, not a published translation.

| Page | The story | Told from | Standing |
|---|---|---|---|
| 8 al-Anfāl | The plea before Badr; the angel's whip; "On, Ḥayzūm!" | ʿUmar and Ibn ʿAbbās: Muslim 1763 | Ṣaḥīḥ |
| 8 al-Anfāl | The captives: Abū Bakr's counsel, ʿUmar's, and the weeping the next day | The same hadith | Ṣaḥīḥ |
| 9 al-Tawbah | Kaʿb ibn Mālik and the fifty nights | Kaʿb himself: al-Bukhārī 4418 | Ṣaḥīḥ |
| 17 al-Isrāʾ | **New entry.** The Night Journey as he ﷺ told it: al-Burāq, Jerusalem, the seven heavens, the Lote Tree, the fifty prayers made five | Anas: Muslim 162 | Ṣaḥīḥ |
| 18 al-Kahf | **New entry.** Mūsā and al-Khiḍr as he ﷺ told it: why Mūsā set out, the fish, the sparrow at the edge of the ship | Ubayy ibn Kaʿb: al-Bukhārī 4725 | Ṣaḥīḥ |
| 24 al-Nūr | The slander, in ʿĀʾishah's own telling | ʿĀʾishah: al-Bukhārī 4750 | Ṣaḥīḥ |
| 30 al-Rūm | Abū Bakr's wager | Niyār ibn Mukram: al-Tirmidhī 3194; Ibn ʿAbbās: 3193 | See B2 |
| 33 al-Aḥzāb | Anas ibn al-Naḍr at Uḥud | Anas: al-Bukhārī 2805 | Ṣaḥīḥ |
| 33 al-Aḥzāb | The choice — what came before it, and "He sent me as a teacher, and one who makes things easy" | Jābir: Muslim 1478 | Ṣaḥīḥ |
| 48 al-Fatḥ | **New entry.** The truce at al-Ḥudaybiyah: the camel that knelt, Suhayl and the document, Abū Jandal in his chains, ʿUmar's questions, Umm Salamah's counsel, Abū Baṣīr | al-Miswar and Marwān: al-Bukhārī 2731 | Ṣaḥīḥ |
| 58 al-Mujādilah | Khawlah, in her own words, and the expiation | Abū Dāwūd 2214 | Ḥasan according to al-Albānī |
| 60 al-Mumtaḥanah | Ḥāṭib's letter | ʿAlī: al-Bukhārī 4274 | Ṣaḥīḥ |
| 63 al-Munāfiqūn | What set it off: the quarrel, and "Let people not say that Muḥammad kills his companions" | Jābir: al-Bukhārī 4905 | Ṣaḥīḥ |
| 66 al-Taḥrīm | ʿUmar's own account of the two wives, and the mark of the mat on his ﷺ side | Ibn ʿAbbās from ʿUmar: al-Bukhārī 4913 | Ṣaḥīḥ |
| 72 al-Jinn | The jinn barred from heaven, and what they found at Nakhlah | Ibn ʿAbbās: al-Bukhārī 773 | Ṣaḥīḥ |
| 85 al-Burūj | The boy, the monk and the king | Ṣuhayb: Muslim 3005 | Ṣaḥīḥ |
| 96 al-ʿAlaq | The beginning of revelation: Ḥirāʾ, Khadījah's words, Waraqah | ʿĀʾishah: al-Bukhārī 3 | Ṣaḥīḥ |

**Three things for you to look at:**

1. **Three of them are not occasions of revelation.** The Night Journey (17),
   Mūsā and al-Khiḍr (18) and the boy and the king (85) are the Prophet's ﷺ
   own telling of what the surah tells. They sit in the same list, under
   "What came down about what", with titles that say what they are. If you
   want them under a heading of their own, it is a small change.
2. **What I left out**, for length. From al-Ḥudaybiyah: the envoys who came
   between ʿUrwah and Suhayl, ʿUrwah’s exchanges with Abū Bakr and
   al-Mughīrah, and the believing women who came afterwards (their ayah is
   on 60 al-Mumtaḥanah). From the slander: the Helper woman who sat weeping
   with her, and Ḥamnah’s part. From the choice: ʿUmar’s words about his own
   wife are summarised, not quoted. From Mūsā and al-Khiḍr: the opening,
   where Ibn ʿAbbās refutes Nawf al-Bikālī. From Kaʿb’s hadith: that he kept
   his share at Khaybar.
3. **A story I did not expand because I could not read its text**: Jaʿfar
   before the Negus (19 Maryam). It is in Aḥmad's *Musnad*, which the corpus
   does not hold, and I will not tell a story at length from memory. If you
   can give me the text, I will.

**What else could be told the same way**, all from al-Bukhārī or Muslim, if
you want more: the death of Abū Ṭālib (9 and 28), the funeral of ʿAbd Allāh
ibn Ubayy in ʿUmar's telling (9), ʿĀʾishah's necklace and the ayah of
tayammum (5), the delegation of Banū Tamīm (49), the guest of the Helper
(59), the famine of Quraysh (44), the call from al-Ṣafā (26 and 111), the
judgement between al-Zubayr and the Helper (4), the people of the trench in
the longer form of Aḥmad.

---

## Settled — kept here for the record

### A. Which works are quoted

- **al-Qurṭubī** stays. He is quoted 86 times on 82 pages, only for what he
  relates, and each quotation says so under it: "Quoted for what he relates,
  not for creed", leading to a paragraph in *Sources*.
- **Ibn al-Jawzī** stays, quoted for reports of place and occasion only.
- **Not quoted at all**, and refused by the lock script: al-Rāzī, al-Bayḍāwī,
  *al-Jalālayn*, Ibn ʿĀshūr. They remain on the site's tafsir pages.
- **al-Suyūṭī's** reports in *al-Durr al-Manthūr* are shown under "The same,
  in other works" (115 of them), each with the line "A report he gathers; its
  chain is not graded here."

### D. Where each surah came down

- Eleven pages say "differed over" and do not choose: 13, 22, 55, 76, 83, 97,
  100, 108, 112, 113, 114. They report who said what.
- Every other verdict was held against al-Baghawī, *al-Durr al-Manthūr* and
  *Fatḥ al-Qadīr*. Where one of them differs (61, 76, 83, 98, 99) the page
  shows it. On 110 al-Naṣr the copy of al-Baghawī heads the surah "Makkan";
  no one else does, and I left that off the page as a slip of the edition.
- Where a page says "Makkan, except ayat 68–70", it reports a saying and has
  not weighed it.
