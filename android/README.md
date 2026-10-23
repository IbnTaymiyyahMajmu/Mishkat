# Mishkāt for Android

The Android app is the site, carried inside an app. [Capacitor](https://capacitorjs.com)
puts the static export into it and serves it from the phone itself, so every
page, the tafsir library, the word timings and the introductions are there
without a network; what the site fetches from elsewhere — the verses, the
translations, the recitations, search — it still fetches, exactly as it does in
a browser.

Nothing in `src/` knows it is in an app, with two exceptions, both set by the
build: a link copied to send to someone names the site on the web rather than
the phone's own address (`NEXT_PUBLIC_SITE_URL`), and the page runs under the
system bars (`NEXT_PUBLIC_EDGE_TO_EDGE`, read by the viewport in layout.tsx). Everything the app adds is in four
Java files under `app/src/main/java/io/github/ibntaymiyyahmajmu/mishkat/`:

- **`Pages`** answers each page's address with that page. The export is a
  folder to a page (`read/2/index.html`), and Capacitor, being made for
  single-page apps, would answer any address without a file extension with the
  home page — so a reload, or any page opened by its address, would have shown
  the home page under another page's name.
- **`Shell`** lets the page run to the edges of the screen, under the status
  bar and the gesture bar, as an app's own screens do — the site keeps its words
  clear of them itself, through `env(safe-area-inset-*)`, in the app's build — and
  draws the bars' icons light over a dark page and dark over a light one, as the
  page reports from the colour of its own ink at each edge. It makes Back go back
  a page, and leave the app from the first; and has the splash screen open on
  the light the reader last chose (Android 13 and later).
- **`Recitation`** and **`RecitationService`** keep a recitation playing when the
  app is out of sight, with its notification, the lock screen's controls and a
  headset's buttons. The site already tells a browser all of this through the
  Media Session API, and Chrome does the rest; Android's WebView has no such API,
  so the app gives the page one and does what Chrome would. Without it a
  recitation stopped within a minute of the app leaving the screen.

The icon is the lamp alight on the night sky, as `public/now-playing.jpg` draws
it; it and the splash screen are vectors in `app/src/main/res/drawable`.

## Building

You need Node 24, a JDK 21, and the Android SDK (platform 36 and build tools),
either through Android Studio or the command-line tools. The SDK is found
through `ANDROID_HOME`, or where Android Studio puts it.

```bash
npm run android                  # export the site for the app and copy it in
npm run android -- --apk         # …and build an APK to install on a phone
npm run android -- --release     # …and build the signed bundle for Google Play
```

The APK lands in `app/build/outputs/apk/debug/app-debug.apk`; the release in
`app/build/outputs/bundle/release/app-release.aab` (for Google Play) and
`app/build/outputs/apk/release/app-release.apk` (to hand to someone directly).
`npx cap open android` opens the project in Android Studio.

To try it on a phone, turn on USB debugging and `adb install -r` the APK, or copy
the APK across and open it (Android asks you to allow installing it).

The app carries a copy of the site, so a change to the site reaches the app only
with a new release of it — except for what the site fetches live, which is
always current.

## The version

The app's version is `package.json`'s. Google Play takes an upload only if its
version code is higher than the last one's, and the code is made from the
version — `1.2.3` is `10203` — so raise the version for every upload.

## The upload key

A release is signed with the upload key in `android/mishkat-upload.jks`, whose
passwords are in `android/keystore.properties`. **Neither is in git, and neither
should be.** Keep a copy of both somewhere safe — a password manager, an offline
drive. Google Play signs what it gives to phones with its own key ("Play App
Signing", the default for a new app); this one only proves an upload came from
you. If it is lost, Google can be asked to accept a new one, but that takes
days.

To use a different key, put its path, alias and passwords in
`keystore.properties`:

```
storeFile=mishkat-upload.jks
storePassword=…
keyAlias=upload
keyPassword=…
```

## Publishing on Google Play

1. **A developer account** at play.google.com/console — a one-off fee and an
   identity check. A new *personal* account has to run a closed test with at
   least twelve testers for fourteen days before it can publish to everyone; an
   *organisation* account does not. The Console says which applies and the
   current numbers.
2. **Create the app**: name *Mishkāt*, an app, free.
3. **App content** (Policy → App content). The answers are drafted in
   [STORE.md](STORE.md):
   - a **privacy policy** at a public address — required, even for an app that
     collects nothing. It is the site's own page,
     `https://ibntaymiyyahmajmu.github.io/Mishkat/privacy/`, once deployed;
   - **data safety**, **content rating**, **target audience**, **ads** (none);
   - the **foreground service** declaration: the app uses
     `FOREGROUND_SERVICE_MEDIA_PLAYBACK` so that a recitation goes on with the
     screen off. Google asks what it is for and for a short video of it — start
     a recitation, lock the phone, show it still playing and the controls on the
     lock screen.
4. **Store listing**: the copy is in STORE.md, the pictures in `store/` — the
   512 px icon (`icon-512.png`), the feature graphic (`feature.png`) and six
   phone screenshots (`screenshots/`).
5. **Testing → Internal testing**: upload `app-release.aab`, add testers by
   email, and install from the link the Console gives. Then closed testing, if
   the account needs it, and then production.

The pictures are made from `store/icon.svg` and `store/feature.html` by a
headless browser:

```bash
msedge --headless=new --hide-scrollbars --window-size=1024,500 --screenshot=feature.png feature.html
```

and the screenshots are the emulator's, cut to 1080 × 2160, since Google Play
takes nothing taller than twice its width.

### Before it is public

Google Play takes an app down when someone shows it carries their work without
leave, so the rights in [DATA-NEEDED.md](../DATA-NEEDED.md) want settling first —
above all The Clear Qur'an (§4), for which no permission from its publisher has
been shown. The app also *carries* the tafsir library, which is a copy handed to
every phone that installs it rather than one served from a website; it is worth
having Nuqayah's permission in writing, and saying that it covers an app.
