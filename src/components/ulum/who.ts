import type { CSSProperties } from "react";

/**
 * Each scholar's colour, the same wherever he appears, so that a reader can tell
 * at a glance whose words these are. There are ten, drawn for every light in
 * `globals.css` as `--who-1` to `--who-10`. The books that stand side by side on
 * one chapter are given different ones; a book not listed takes one by its name.
 */
const SLOT: Record<string, number> = {
  // the commentators of chapter eight, and those who list the views
  tabari: 1,
  qurtubi: 2,
  alrazi: 3,
  "ibn-katheer": 4,
  "ibn-aashoor": 5,
  "zad-almaseer": 6,
  samaani: 7,
  baghawi: 8,
  "ibn-atiyah": 9,
  "abu-alsuod": 10,
  "adwaa-albayan": 9,
  "aysar-altafasir": 3,
  // the grammarians
  aljadwal: 1,
  "iraab-daas": 2,
  "aliraab-almuyassar": 3,
  "iraab-aldarweesh": 4,
  "aldur-almasoon": 5,
  "iraab-alnahas": 6,
  "mujtaba-mushkil-iraab": 7,
  // the schools
  almabsut: 1,
  "badai-sanai": 8,
  "ilkia-alharrasee": 2,
  "ahkam-ibn-alarabee": 3,
  almughni: 4,
  almubdi: 9,
  alikleel: 5,
  "ahkam-altarayfi": 6,
  "eedah-naskh-mansukh": 7,
  // the readings
  alnashir: 1,
  "tahbeer-altayseer": 2,
  "mafateeh-alaghanee": 3,
  "qiraat-almawsoah": 4,
  // the reports
  "ibn-abi-hatim": 8,
  qatada: 9,
  "aldur-almanthoor": 10,
};

const COLOURS = 10;

function slotOf(id: string): number {
  if (SLOT[id]) return SLOT[id];
  let sum = 0;
  for (const c of id) sum += c.charCodeAt(0);
  return (sum % COLOURS) + 1;
}

/** The style that gives a block a scholar's colour, as `--who`. */
export function whoStyle(id: string): CSSProperties {
  return { ["--who" as string]: `var(--who-${slotOf(id)})` };
}

/** The order the views on a question take the colours, so that neighbours are far apart. */
const VIEW_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** The style for the nth view on a question. */
export function viewStyle(n: number): CSSProperties {
  return { ["--who" as string]: `var(--who-${VIEW_ORDER[(n - 1) % COLOURS]})` };
}
