// npm run android                build the site for the app and copy it in
// npm run android -- --apk       …then build an APK to install on a phone
// npm run android -- --release   …then build the signed bundle for Google Play
//
// The Android app is this site, carried inside it (capacitor.config.ts). The
// export it carries differs from the one GitHub Pages serves in three things
// only. It is served from the root of https://localhost, so it has no base
// path, whatever the deploy uses. That address is the phone's own, which
// nobody else can open, so a link the reader copies to send to someone names
// the site on the web instead — NEXT_PUBLIC_SITE_URL, read by the reader's
// "copy link". And the page runs to the edges of the screen, under the status
// bar and the gesture bar, as an app's screens do — NEXT_PUBLIC_EDGE_TO_EDGE,
// read by the viewport in layout.tsx.
//
// Then `cap sync` copies the export into android/app/src/main/assets/public,
// where the app reads it from.
//
// The Android SDK is found through ANDROID_HOME, or, failing that, where
// Android Studio and the command-line tools put it on Windows. The release
// bundle is signed with the upload key named in android/keystore.properties;
// neither the key nor that file is ever committed. Google Play signs what it
// hands to phones with its own key, and this one only proves an upload came
// from us — but an upload signed with any other key is refused, so keep a
// copy of both files somewhere safe.

import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ANDROID = join(ROOT, "android");
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ibntaymiyyahmajmu.github.io/Mishkat";

const apk = process.argv.includes("--apk");
const release = process.argv.includes("--release");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit", ...options });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, [join(ROOT, "node_modules/next/dist/bin/next"), "build"], {
  env: { ...process.env, NEXT_PUBLIC_BASE_PATH: "", NEXT_PUBLIC_SITE_URL: SITE, NEXT_PUBLIC_EDGE_TO_EDGE: "1" },
});
run(process.execPath, [join(ROOT, "node_modules/@capacitor/cli/bin/capacitor"), "sync", "android"]);

if (!apk && !release) process.exit(0);

// Gradle reads the SDK's whereabouts from local.properties, which is the
// machine's own and is not committed.
const sdk =
  process.env.ANDROID_HOME ??
  process.env.ANDROID_SDK_ROOT ??
  [join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk"), join(homedir(), "Library/Android/sdk"), join(homedir(), "Android/Sdk")].find(
    (dir) => existsSync(dir),
  );
if (!sdk) {
  console.error("No Android SDK found. Install Android Studio, or set ANDROID_HOME to the SDK.");
  process.exit(1);
}
const local = join(ANDROID, "local.properties");
if (!existsSync(local)) writeFileSync(local, `sdk.dir=${sdk.replaceAll("\\", "/")}\n`);

if (release && !existsSync(join(ANDROID, "keystore.properties"))) {
  console.error("No android/keystore.properties: a release has to be signed with the upload key. See android/README.md.");
  process.exit(1);
}

const tasks = release ? ["bundleRelease", "assembleRelease"] : ["assembleDebug"];
if (process.platform === "win32") {
  // A .bat file only runs through a shell, which is not always allowed to look
  // in the folder it is started in: so the whole path, quoted, as one command
  // line. Nothing in it comes from outside.
  run(`"${join(ANDROID, "gradlew.bat")}" ${tasks.join(" ")} --console=plain`, [], { cwd: ANDROID, shell: true });
} else {
  run("./gradlew", [...tasks, "--console=plain"], { cwd: ANDROID });
}

const outputs = release
  ? ["app/build/outputs/bundle/release/app-release.aab", "app/build/outputs/apk/release/app-release.apk"]
  : ["app/build/outputs/apk/debug/app-debug.apk"];
for (const file of outputs) console.log(`\n  ${join(ANDROID, file)}`);
