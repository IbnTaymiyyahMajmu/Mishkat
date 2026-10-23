# Mishkāt on Google Play — what to put in the Console

Drafts for the store listing and for *App content*. Everything here is yours to
change; what is stated as fact about the app was checked against it on
2026-10-22.

## Store listing

**App name** (30 characters at most)

> Mishkāt — Read the Qur'an

**Short description** (80 at most)

> The Qur'an word by word, with the classical tafsir and the recitation beside it.

**Full description** (4,000 at most)

> Mishkāt — the niche that holds the lamp, from 24:35 — is a quiet place to
> read the Qur'an, and to understand what you read.
>
> **Word by word.** Every Arabic word is set over its transliteration and its
> meaning. Tap a word to light all three together; tap again to study it — its
> root, its form, and every other place it comes.
>
> **Recitation.** Eleven reciters, with each word lit as it is recited. It goes on
> with the screen off, with its controls on the lock screen and your headphones.
> Loop a passage to learn it — each ayah as many times as you choose, with a
> silence after it to recite it back.
>
> **Tafsir.** Twenty-two works in one library, opened on any ayah, each under its
> own book and author. In English: al-Mukhtaṣar, al-Jalālayn, the abridged Ibn
> Kathīr, Maʿārif al-Qurʾān. In Arabic: the mother works — al-Ṭabarī, al-Baghawī,
> al-Qurṭubī and Ibn Kathīr in full — and the leading work of each kind of tafsir.
> The Arabic library is on your phone, and opens without a connection.
>
> **Translations.** Some 125 translations in 66 languages, up to four under each
> ayah, with their translators' footnotes.
>
> **An introduction to every surah**: where and when it came down, what was
> happening, what it is for, and the surah passage by passage.
>
> **The muṣḥaf view**, for reading the Arabic alone. **Notes and bookmarks**,
> written against any ayah and kept on your phone. **A khatm plan**, to read the
> whole in the time you set yourself.
>
> **Three lights** to read by — day, evening and night — chosen by you rather
> than by your phone.
>
> No account, no adverts, no tracking. What you write and where you stopped stay
> on your phone.

**Category**: Books & Reference. **Tags**: Qur'an, Islam, tafsir.

**Contact email** (shown on the listing): MishkatQuran@outlook.com — the same
address the privacy page gives for questions.

**Pictures** (`store/`): `icon-512.png` for the icon, `feature.png` for the
feature graphic, and the six in `screenshots/` for the phone, in their order.

## App content

**Privacy policy** — required; the Console wants an address:
`https://ibntaymiyyahmajmu.github.io/Mishkat/privacy/`. It is the site's own
privacy page (`src/components/privacy/PrivacyPage.tsx`), true of the site and
the app alike, in the reader's language, and linked from Settings. It is live
once the change that adds it has been deployed — merged into `main`.

**App access** — all of it, with no sign-in.

**Ads** — none.

**Content rating** — the questionnaire, as a reference app: no violence, no
sexual content, no profanity, no gambling, no user-to-user communication, no
sharing of location. Expect *Everyone*.

**Target audience** — the simplest course is *13 and over*. Choosing ages under
13 as well brings the app under Google's Families policy, which asks more of it.

**Data safety** — what the app does, for answering the form:

- It has no account, no analytics, no advertising and no crash reporting, and
  sends nothing to the people who make it.
- Bookmarks, notes, the place in each surah and the settings are kept on the
  phone only.
- To show what is asked for it fetches from other services: the text,
  translations, word data and search from api.quran.com; the recitations from
  verses.quran.com and everyayah.com; The Clear Qur'an from a GitHub Pages
  address. A search sends the words searched for to api.quran.com to be answered.
  Nothing identifies the reader beyond what any web request carries.

The careful answer is *Data collected: In-app search history* (sent to answer a
search, not shared, not used for anything else, encrypted in transit, optional —
search is not needed to use the app), and nothing else collected or shared. If
Google's guidance at the time treats a query passed straight to a service to be
answered as not collected, *No data collected* is the answer.

**Foreground service** (*Policy → App content → Foreground service
permissions*) — `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, under *Media playback*:

> Mishkāt plays recitations of the Qur'an. The foreground service runs only
> while a recitation the user started is playing, so that it goes on when the
> screen is off or another app is open; it shows the recitation's notification
> with its controls the whole time, and stops when the recitation pauses or the
> player is closed.

and a link to a short video: start a recitation, lock the phone, show it still
playing with its controls on the lock screen.

**Government app, financial features, health, news** — no.
