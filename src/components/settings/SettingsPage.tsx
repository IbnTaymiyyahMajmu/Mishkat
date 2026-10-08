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
import written from "@/content/intros-written.json";
import { LOCALES, useLocale, type MessageKey } from "@/lib/i18n";
import styles from "./SettingsPage.module.css";

/**
 * The ayah the translations are shown rendering here, where there is no ayah
 * in front of the reader to use: "So remember Me; I will remember you." Short
 * enough to take in eight of, and translators put it eight ways.
 */
const SAMPLE_AYAH = "2:152";

const LIGHTS: { id: Theme; label: MessageKey }[] = [
  { id: "day", label: "light.day" },
  { id: "evening", label: "light.evening" },
  { id: "night", label: "light.night" },
];

const HIGHLIGHTS = [
  { id: "both", label: "settings.highlightBoth" },
  { id: "tint", label: "settings.highlightTint" },
  { id: "underline", label: "settings.highlightUnderline" },
] as const;

/** A link out to a source, for the sentences in the table that name one. */
const out = (href: string) =>
  function Out(words: string) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {words}
      </a>
    );
  };

export function SettingsPage() {
  const { settings, update, reset } = useSettings();
  const { notes, bookmarks, exportJson, importJson, clearAll } = useLibrary();
  const toast = useToast();
  const { t, rich, chosen, setLocale, arabicScript } = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);


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
    toast(t("common.exported"));
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const added = importJson(await file.text(), "merge");
      toast(t("toast.imported", { notes: added.notes, bookmarks: added.bookmarks }));
    } catch {
      toast(t("toast.importFailed"));
    } finally {
      e.target.value = "";
    }
  };

  const shelved = settings.translationIds
    .map((id) => translationName(id) || t("translations.unnamed", { id }))
    .join(" · ");

  return (
    <div className="page-shell">
      <div className={styles.body}>
        <header className={styles.head}>
          <div className="kicker">{t("settings.kicker")}</div>
          <h1 className={styles.title}>{t("settings.title")}</h1>
        </header>

        {/* The language of the site's own words, and of nothing else. It is
            here and not in the bar at the top because it is a setting; and it
            is first, because a reader who cannot read the page cannot be asked
            to scroll it looking for the setting that would let them. Each
            language is named in itself, for the same reason. */}
        <Section title={t("language.title")} note={t("language.note")}>
          <div className={styles.chips}>
            {LOCALES.map((l) => (
              <Chip key={l.id} on={chosen === l.id} onClick={() => setLocale(l.id)} title={l.name}>
                <span lang={l.id}>{l.label}</span>
              </Chip>
            ))}
          </div>
        </Section>

        <Section title={t("settings.translation")} note={t("settings.translationNote", { max: MAX_TRANSLATIONS })}>
          <div className={styles.tafsirLibrary}>
            <TranslationLibrary verseKey={SAMPLE_AYAH} showAyah />
          </div>
        </Section>

        <Section title={t("settings.light")} note={t("settings.lightNote")}>
          <div className={styles.chips}>
            {LIGHTS.map((light) => (
              <Chip
                key={light.id}
                on={settings.theme === light.id}
                onClick={() => update({ theme: light.id })}
              >
                {t(light.label)}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title={t("settings.typography")}>
          <div className={styles.grid}>
            <div className="field">
              <label htmlFor="arabic-size">{t("settings.arabicSize", { px: settings.arabicSize })}</label>
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
              <label htmlFor="trans-size">{t("settings.transSize", { px: settings.transSize })}</label>
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
                {t("settings.transSample")}
              </div>
            </div>

            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>{t("settings.typeface")}</label>
              <div className={styles.chips}>
                {ARABIC_FONTS.map((f) => (
                  <Chip key={f.id} on={settings.arabicFont === f.id} onClick={() => update({ arabicFont: f.id })}>
                    {f.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="reader-width">{t("settings.width", { px: settings.readerWidth })}</label>
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

        <Section title={t("settings.wbw")}>
          <div className={styles.toggles}>
            <Toggle on={settings.showTranslit} onClick={() => update({ showTranslit: !settings.showTranslit })}>
              {t("settings.translit")}
            </Toggle>
            <Toggle on={settings.showWbw} onClick={() => update({ showWbw: !settings.showWbw })}>
              {t("settings.meanings")}
            </Toggle>
            <Toggle on={settings.showTranslation} onClick={() => update({ showTranslation: !settings.showTranslation })}>
              {t("settings.fullTranslation")}
            </Toggle>
          </div>

          {/* The meanings under the words are a translation too, and the corpus
              has them in more languages than English. */}
          <div style={{ marginTop: 22 }}>
            <div className="field">
              <label>{t("settings.meaningsIn")}</label>
            </div>
            <div className={styles.chips}>
              {GLOSS_LANGUAGES.map((g) => (
                <Chip
                  key={g.id}
                  on={settings.glossLanguage === g.id}
                  onClick={() => update({ glossLanguage: g.id })}
                  title={"name" in g ? g.name : undefined}
                >
                  <span lang={g.id}>{g.label}</span>
                </Chip>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div className="field">
              <label>{t("settings.layout")}</label>
            </div>
            <div className={styles.chips}>
              <Chip on={settings.layout === "rows"} onClick={() => update({ layout: "rows" })}>
                {t("settings.layoutFlowing")}
              </Chip>
              <Chip on={settings.layout === "stacked"} onClick={() => update({ layout: "stacked" })}>
                {t("settings.layoutSpaced")}
              </Chip>
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div className="field">
              <label>{t("settings.highlight")}</label>
            </div>
            <div className={styles.chips}>
              {HIGHLIGHTS.map((h) => (
                <Chip key={h.id} on={settings.wordHighlight === h.id} onClick={() => update({ wordHighlight: h.id })}>
                  {t(h.label)}
                </Chip>
              ))}
            </div>
          </div>
        </Section>

        <Section title={t("settings.reciter")} note={t("settings.reciterNote")}>
          <div className={styles.chips}>
            {RECITERS.map((r) => (
              <Chip key={r.id} on={settings.reciterId === r.id} onClick={() => update({ reciterId: r.id })}>
                {arabicScript ? r.labelArabic : r.label}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title={t("settings.tafsir")} note={t("settings.tafsirNote")}>
          <div className={styles.tafsirLibrary}>
            <TafsirLibrary shelf={tafsir.shelf} onToggle={tafsir.toggle} />
          </div>
          <p className={styles.sectionNote} style={{ marginTop: 14 }}>
            {t("settings.tafsirCredit", {
              name: TAFSIR_APP.name,
              nameArabic: TAFSIR_APP.nameArabic,
              by: TAFSIR_APP.by,
              cdn: TAFSIR_CDN.name,
            })}
          </p>
        </Section>

        <Section title={t("settings.library")} note={t("settings.libraryNote")}>
          <p className={styles.stat}>
            {t("common.notes", { count: notes.length })} · {t("common.bookmarks", { count: bookmarks.length })}
          </p>
          <div className={styles.chips}>
            <button className="btn btn-secondary" onClick={download} disabled={!notes.length && !bookmarks.length}>
              {t("settings.exportAll")}
            </button>
            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
              {t("settings.importFile")}
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} hidden />
            {confirmClear ? (
              <>
                <span className={styles.confirm}>{t("settings.clearAsk")}</span>
                <button className="btn btn-ghost" onClick={() => setConfirmClear(false)}>
                  {t("common.keep")}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    clearAll();
                    setConfirmClear(false);
                    toast(t("toast.libraryCleared"));
                  }}
                >
                  {t("common.delete")}
                </button>
              </>
            ) : (
              <button className="btn btn-ghost" onClick={() => setConfirmClear(true)}>
                {t("settings.clear")}
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => { reset(); toast(t("toast.settingsReset")); }}>
              {t("settings.reset")}
            </button>
          </div>
        </Section>

        <Section title={t("settings.sources")}>
          <table className="table">
            <thead>
              <tr>
                <th>{t("settings.layer")}</th>
                <th>{t("settings.source")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={styles.layer}>{t("settings.src.text")}</td>
                <td className={styles.source}>
                  {rich("settings.src.textValue", { link: out("https://quran.foundation") })}
                </td>
              </tr>
              <tr>
                <td className={styles.layer}>{t("settings.src.translation")}</td>
                <td className={styles.source}>
                  {FILED_EDITIONS.length > 0
                    ? rich(
                        "settings.src.translationFiled",
                        { link: out(TRANSLATION_FILES.href) },
                        {
                          names: shelved,
                          filed: FILED_EDITIONS.map((e) => e.name).join(", "),
                          from: TRANSLATION_FILES.name,
                        },
                      )
                    : t("settings.src.translationValue", { names: shelved })}
                </td>
              </tr>
              <tr>
                <td className={styles.layer}>{t("settings.src.wbw")}</td>
                <td className={styles.source}>{t("settings.src.wbwValue")}</td>
              </tr>
              <tr>
                <td className={styles.layer}>{t("settings.src.tafsir")}</td>
                <td className={styles.source}>
                  {rich(
                    "settings.src.tafsirValue",
                    { link: out(TAFSIR_CDN.href) },
                    { count: fromCorpus, cdn: TAFSIR_CDN.name },
                  )}
                </td>
              </tr>
              <tr>
                <td className={styles.layer}>{t("settings.src.classical")}</td>
                <td className={styles.source}>
                  {rich(
                    TAFSIR_APP_MIRRORED_COUNT === TAFSIR_APP_WORKS.length
                      ? "settings.src.classicalAll"
                      : "settings.src.classicalSome",
                    { link: out(TAFSIR_APP.href) },
                    {
                      count: TAFSIR_APP_WORKS.length,
                      kept: TAFSIR_APP_MIRRORED_COUNT,
                      name: TAFSIR_APP.name,
                      nameArabic: TAFSIR_APP.nameArabic,
                      by: TAFSIR_APP.by,
                    },
                  )}
                </td>
              </tr>
              <tr>
                <td className={styles.layer}>{t("settings.src.morphology")}</td>
                <td className={styles.source}>{t("settings.src.morphologyValue")}</td>
              </tr>
              <tr>
                <td className={styles.layer}>{t("settings.src.lexicons")}</td>
                <td className={styles.source}>{t("settings.src.lexiconsValue")}</td>
              </tr>
              <tr>
                <td className={styles.layer}>{t("settings.src.recitation")}</td>
                <td className={styles.source}>{t("settings.src.recitationValue")}</td>
              </tr>
              <tr>
                <td className={styles.layer}>{t("settings.src.intros")}</td>
                <td className={styles.source}>
                  {t("settings.src.introsValue", { count: (written as number[]).length })}
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
