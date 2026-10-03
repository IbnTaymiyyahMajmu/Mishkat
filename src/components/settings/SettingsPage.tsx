"use client";

import { useRef, useState } from "react";
import { useSettings, type Theme } from "@/lib/store/settings";
import { useLibrary } from "@/lib/store/library";
import { useToast } from "@/components/Toast";
import { ARABIC_FONTS, GLOSS_LANGUAGES, MAX_TRANSLATIONS, RECITERS } from "@/lib/quran/resources";
import { translationName } from "@/lib/quran/translations";
import { FILED_EDITIONS, TRANSLATION_FILES } from "@/lib/quran/translationFiles";
import { TranslationLibrary } from "@/components/translations/TranslationLibrary";
import { useCatalogue } from "@/components/translations/useTranslationShelf";
import { TAFSIR_LIBRARY } from "@/lib/quran/tafsir";
import { TAFSIR_APP, TAFSIR_APP_MIRRORED_COUNT, TAFSIR_APP_WORKS } from "@/lib/quran/tafsirApp";
import { TAFSIR_CDN } from "@/lib/quran/tafsirCdn";
import { TafsirLibrary } from "@/components/tafsir/TafsirShelf";
import { useTafsirShelf } from "@/components/tafsir/useTafsirShelf";
import { localIntroCount } from "@/lib/content";
import styles from "./SettingsPage.module.css";

/**
 * The ayah the translations are shown rendering here, where there is no ayah
 * in front of the reader to use: "So remember Me; I will remember you." Short
 * enough to take in eight of, and translators put it eight ways.
 */
const SAMPLE_AYAH = "2:152";

const LIGHTS: { id: Theme; label: string }[] = [
  { id: "day", label: "Day — bright paper" },
  { id: "evening", label: "Evening — sepia lamplight" },
  { id: "night", label: "Night — dark ground" },
];

export function SettingsPage() {
  const { settings, update, reset } = useSettings();
  const { notes, bookmarks, exportJson, importJson, clearAll } = useLibrary();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const intros = localIntroCount();

  const tafsir = useTafsirShelf();
  // Read for the names in the table of sources below: the library asks for
  // the catalogue, and this is how the table hears that it has arrived.
  useCatalogue();
  const fromCorpus = TAFSIR_LIBRARY.filter((w) => w.id.startsWith("q:")).length;

  const download = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mishkat-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Exported");
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const added = importJson(await file.text(), "merge");
      toast(`Imported ${added.notes} notes and ${added.bookmarks} bookmarks`);
    } catch {
      toast("That file could not be read as a Mishkāt export.");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="page-shell">
      <div className={styles.body}>
        <header className={styles.head}>
          <div className="kicker">Preferences</div>
          <h1 className={styles.title}>Reading settings</h1>
        </header>

        <Section
          title="Translation"
          note={`The Arabic is the Qur’an; what follows is a translation of its meaning, and the translator is always named beneath it. Up to ${MAX_TRANSLATIONS} can be set under each ayah, in any of the languages the corpus holds — chosen here by how each renders one ayah, or beside any ayah in the reader under “Other translations”.`}
        >
          <div className={styles.tafsirLibrary}>
            <TranslationLibrary verseKey={SAMPLE_AYAH} showAyah />
          </div>
        </Section>

        <Section
          title="Reading light"
          note="The same three lamps are in the bar at the top of every page. The light is the reader’s choice rather than the operating system’s: a muṣḥaf is often read in a dark room on a device set to light, and as often on a bright morning on one set to dark."
        >
          <div className={styles.chips}>
            {LIGHTS.map((light) => (
              <Chip
                key={light.id}
                on={settings.theme === light.id}
                onClick={() => update({ theme: light.id })}
              >
                {light.label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Typography">
          <div className={styles.grid}>
            <div className="field">
              <label htmlFor="arabic-size">Arabic size · {settings.arabicSize}px</label>
              <input
                id="arabic-size"
                type="range"
                min={26}
                max={72}
                step={2}
                value={settings.arabicSize}
                onChange={(e) => update({ arabicSize: +e.target.value })}
                className={styles.range}
              />
              <div dir="rtl" className={styles.arabicSample}>
                ٱلْحَمْدُ لِلَّهِ
              </div>
            </div>

            <div className="field">
              <label htmlFor="trans-size">Translation size · {settings.transSize}px</label>
              <input
                id="trans-size"
                type="range"
                min={12}
                max={26}
                step={1}
                value={settings.transSize}
                onChange={(e) => update({ transSize: +e.target.value })}
                className={styles.range}
              />
              <div className={styles.transSample} style={{ fontSize: `${settings.transSize}px` }}>
                All praise is due to Allah.
              </div>
            </div>

            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Arabic typeface</label>
              <div className={styles.chips}>
                {ARABIC_FONTS.map((f) => (
                  <Chip key={f.id} on={settings.arabicFont === f.id} onClick={() => update({ arabicFont: f.id })}>
                    {f.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="reader-width">Reader width · {settings.readerWidth}px</label>
              <input
                id="reader-width"
                type="range"
                min={640}
                max={1100}
                step={20}
                value={settings.readerWidth}
                onChange={(e) => update({ readerWidth: +e.target.value })}
                className={styles.range}
              />
            </div>
          </div>
        </Section>

        <Section title="Word-by-word">
          <div className={styles.toggles}>
            <Toggle on={settings.showTranslit} onClick={() => update({ showTranslit: !settings.showTranslit })}>
              Transliteration
            </Toggle>
            <Toggle on={settings.showWbw} onClick={() => update({ showWbw: !settings.showWbw })}>
              Word meanings
            </Toggle>
            <Toggle on={settings.showTranslation} onClick={() => update({ showTranslation: !settings.showTranslation })}>
              Full translation
            </Toggle>
          </div>

          {/* The meanings under the words are a translation too, and the corpus
              has them in more languages than English. */}
          <div style={{ marginTop: 22 }}>
            <div className="field">
              <label>Word meanings in</label>
            </div>
            <div className={styles.chips}>
              {GLOSS_LANGUAGES.map((g) => (
                <Chip
                  key={g.id}
                  on={settings.glossLanguage === g.id}
                  onClick={() => update({ glossLanguage: g.id })}
                  title={"name" in g ? g.name : undefined}
                >
                  {g.label}
                </Chip>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div className="field">
              <label>Layout</label>
            </div>
            <div className={styles.chips}>
              <Chip on={settings.layout === "rows"} onClick={() => update({ layout: "rows" })}>
                Flowing
              </Chip>
              <Chip on={settings.layout === "stacked"} onClick={() => update({ layout: "stacked" })}>
                Spaced per word
              </Chip>
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div className="field">
              <label>Highlight style</label>
            </div>
            <div className={styles.chips}>
              {(["both", "tint", "underline"] as const).map((h) => (
                <Chip key={h} on={settings.wordHighlight === h} onClick={() => update({ wordHighlight: h })}>
                  {h === "both" ? "Tint and underline" : h === "tint" ? "Tint only" : "Underline only"}
                </Chip>
              ))}
            </div>
          </div>
        </Section>

        <Section
          title="Reciter"
          note="Recitation streams from the Quran.com audio CDN. Every reciter here carries word-level timings, so the word being recited lights up as it is read."
        >
          <div className={styles.chips}>
            {RECITERS.map((r) => (
              <Chip key={r.id} on={settings.reciterId === r.id} onClick={() => update({ reciterId: r.id })}>
                {r.label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section
          title="Tafsir"
          note={`Which works you keep to hand. They are the tabs of the tafsir panel and of the tafsir page; any other is one press away there under “All works”. The mark at the end of a row keeps a work or puts it away.`}
        >
          <div className={styles.tafsirLibrary}>
            <TafsirLibrary shelf={tafsir.shelf} onToggle={tafsir.toggle} />
          </div>
          <p className={styles.sectionNote} style={{ marginTop: 14 }}>
            The classical library is {TAFSIR_APP.name}’s ({TAFSIR_APP.nameArabic}) — digitised and
            proofread by {TAFSIR_APP.by} — and is kept on this site with their permission. The two short
            works in English are read from the {TAFSIR_CDN.name}; the rest from the Quran.com corpus.
          </p>
        </Section>

        <Section
          title="Your library"
          note="Notes and bookmarks live in this browser. Export them before clearing your browsing data, or to carry them to another device."
        >
          <p className={styles.stat}>
            {notes.length} {notes.length === 1 ? "note" : "notes"} · {bookmarks.length}{" "}
            {bookmarks.length === 1 ? "bookmark" : "bookmarks"}
          </p>
          <div className={styles.chips}>
            <button className="btn btn-secondary" onClick={download} disabled={!notes.length && !bookmarks.length}>
              Export everything
            </button>
            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
              Import a file
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} hidden />
            {confirmClear ? (
              <>
                <span className={styles.confirm}>Delete all notes and bookmarks?</span>
                <button className="btn btn-ghost" onClick={() => setConfirmClear(false)}>
                  Keep
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    clearAll();
                    setConfirmClear(false);
                    toast("Library cleared");
                  }}
                >
                  Delete
                </button>
              </>
            ) : (
              <button className="btn btn-ghost" onClick={() => setConfirmClear(true)}>
                Clear the library
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => { reset(); toast("Settings reset"); }}>
              Reset settings
            </button>
          </div>
        </Section>

        <Section title="Sources in this build">
          <table className="table">
            <thead>
              <tr>
                <th>Layer</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={styles.layer}>Qur&rsquo;anic text</td>
                <td className={styles.source}>
                  Uthmānī muṣḥaf, Quran.com corpus (Tanzil / King Fahd Complex lineage). Quran data
                  provided by{" "}
                  <a href="https://quran.foundation" target="_blank" rel="noopener noreferrer">
                    Quran Foundation
                  </a>
                  .
                </td>
              </tr>
              <tr>
                <td className={styles.layer}>Translation</td>
                <td className={styles.source}>
                  {settings.translationIds.map((id) => translationName(id) || `Translation ${id}`).join(" · ")}
                  {" — "}each its translator&rsquo;s, as published, sourced through Quran Foundation
                  {FILED_EDITIONS.length > 0 && (
                    <>
                      ; except {FILED_EDITIONS.map((e) => e.name).join(", ")}, which the corpus no longer
                      carries and which is read from{" "}
                      <a href={TRANSLATION_FILES.href} target="_blank" rel="noopener noreferrer">
                        {TRANSLATION_FILES.name}
                      </a>
                    </>
                  )}
                </td>
              </tr>
              <tr>
                <td className={styles.layer}>Word-by-word</td>
                <td className={styles.source}>Quran.com word corpus — form, transliteration, gloss</td>
              </tr>
              <tr>
                <td className={styles.layer}>Tafsir</td>
                <td className={styles.source}>
                  {fromCorpus} works served per ayah by the Quran.com
                  corpus, and two short works in English — al-Mukhtaṣar and al-Jalālayn — from the{" "}
                  <a href={TAFSIR_CDN.href} target="_blank" rel="noopener noreferrer">
                    {TAFSIR_CDN.name}
                  </a>
                  ; each attributed to its book, author and translator
                </td>
              </tr>
              <tr>
                <td className={styles.layer}>Classical tafsir</td>
                <td className={styles.source}>
                  {TAFSIR_APP_WORKS.length} works from{" "}
                  <a href={TAFSIR_APP.href} target="_blank" rel="noopener noreferrer">
                    {TAFSIR_APP.name}
                  </a>{" "}
                  ({TAFSIR_APP.nameArabic}, by {TAFSIR_APP.by}) —{" "}
                  {TAFSIR_APP_MIRRORED_COUNT === TAFSIR_APP_WORKS.length
                    ? "the four mother works and the leading work of each other kind, kept on this site with their permission and shown in Arabic under each author’s name, with a link back"
                    : `${TAFSIR_APP_MIRRORED_COUNT} kept on this site with their permission; the rest linked to`}
                </td>
              </tr>
              <tr>
                <td className={styles.layer}>Root &amp; morphology</td>
                <td className={styles.source}>
                  The Quranic Arabic Corpus (Kais Dukes, University of Leeds) — root, lemma, part
                  of speech and grammar per segment, served by al-nuqta
                </td>
              </tr>
              <tr>
                <td className={styles.layer}>Lexicons</td>
                <td className={styles.source}>
                  Twelve classical works by root — Ibn Fāris, al-Rāghib, Ibn Manẓūr&rsquo;s Lisān
                  al-ʿArab, al-Zabīdī&rsquo;s Tāj al-ʿArūs, Lane and others — each shown in Arabic
                  under its author&rsquo;s name, with a link to read it at the source
                </td>
              </tr>
              <tr>
                <td className={styles.layer}>Recitation</td>
                <td className={styles.source}>
                  Quran.com audio CDN, with word-level timing segments
                </td>
              </tr>
              <tr>
                <td className={styles.layer}>Surah introductions</td>
                <td className={styles.source}>
                  {intros > 0
                    ? `${intros} of 114 written locally; the rest fall back to Quran.com chapter information`
                    : "Quran.com chapter information — none written locally yet"}
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {note && <p className={styles.sectionNote}>{note}</p>}
      {children}
    </section>
  );
}

function Chip({
  on,
  onClick,
  title,
  children,
}: {
  on: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button className={`btn ${styles.chip} ${on ? styles.chipOn : ""}`} onClick={onClick} aria-pressed={on} title={title}>
      {children}
    </button>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={styles.toggle} onClick={onClick} aria-pressed={on}>
      <span className={`${styles.track} ${on ? styles.trackOn : ""}`}>
        <span className={styles.knob} />
      </span>
      {children}
    </button>
  );
}
