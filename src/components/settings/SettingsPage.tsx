"use client";

import { useRef, useState } from "react";
import { useSettings, type Theme } from "@/lib/store/settings";
import { useLibrary } from "@/lib/store/library";
import { useToast } from "@/components/Toast";
import { ARABIC_FONTS, RECITERS, TAFSIRS, TRANSLATIONS } from "@/lib/quran/resources";
import { localIntroCount } from "@/lib/content";
import styles from "./SettingsPage.module.css";

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
          note="The Arabic is the Qur’an; what follows is a translation of its meaning, and the translator is always named beneath it."
        >
          <div className={styles.chips}>
            {TRANSLATIONS.map((t) => (
              <Chip key={t.id} on={settings.translationId === t.id} onClick={() => update({ translationId: t.id })}>
                {t.label}
              </Chip>
            ))}
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

        <Section title="Tafsir" note="Which works open in the study panel. Selecting several compares them side by side.">
          <div className={styles.chips}>
            {TAFSIRS.map((t) => {
              const on = settings.tafsirIds.includes(t.id);
              return (
                <Chip
                  key={t.id}
                  on={on}
                  onClick={() => {
                    const next = on
                      ? settings.tafsirIds.filter((x) => x !== t.id)
                      : [...settings.tafsirIds, t.id];
                    update({ tafsirIds: next.length ? next : settings.tafsirIds });
                  }}
                >
                  {t.name}
                  {t.lang === "ar" ? " · ع" : ""}
                </Chip>
              );
            })}
          </div>
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
                  Uthmānī muṣḥaf, Quran.com corpus (Tanzil / King Fahd Complex lineage)
                </td>
              </tr>
              <tr>
                <td className={styles.layer}>Translation</td>
                <td className={styles.source}>
                  {TRANSLATIONS.find((t) => t.id === settings.translationId)?.label}
                </td>
              </tr>
              <tr>
                <td className={styles.layer}>Word-by-word</td>
                <td className={styles.source}>Quran.com word corpus — form, transliteration, gloss</td>
              </tr>
              <tr>
                <td className={styles.layer}>Tafsir</td>
                <td className={styles.source}>
                  Seven works served per ayah, each attributed to its book and author
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

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`btn ${styles.chip} ${on ? styles.chipOn : ""}`} onClick={onClick} aria-pressed={on}>
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
