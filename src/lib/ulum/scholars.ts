/**
 * What each scholar was, so that a reader follows them with discernment: his
 * creed and his school of fiqh, set beside his name wherever he is cited.
 *
 * A label is given only where it is well known, and left off where it is disputed
 * or unsettled. The owner's rulings stand over the rest: al-Samīn was Ashʿarī in
 * creed and Shāfiʿī in fiqh, and al-Naḥḥās held the creed of Ahl al-Sunnah. See
 * section M of `docs/ULUM-REVIEW.md`, where the whole list can be corrected.
 */

export type Creed = "sunni" | "ashari" | "maturidi";
export type Fiqh = "hanafi" | "maliki" | "shafii" | "hanbali" | "mujtahid";

const LABELS: Record<string, { creed?: Creed; fiqh?: Fiqh }> = {
  // commentators
  tabari: { creed: "sunni", fiqh: "mujtahid" },
  baghawi: { creed: "sunni", fiqh: "shafii" },
  qurtubi: { creed: "ashari", fiqh: "maliki" },
  "ibn-katheer": { creed: "sunni", fiqh: "shafii" },
  alrazi: { creed: "ashari", fiqh: "shafii" },
  "ibn-aashoor": { creed: "ashari", fiqh: "maliki" },
  "abu-alsuod": { creed: "maturidi", fiqh: "hanafi" },
  "zad-almaseer": { fiqh: "hanbali" },
  samaani: { creed: "sunni", fiqh: "shafii" },
  "adwaa-albayan": { creed: "sunni", fiqh: "maliki" },
  "nathm-aldurar": { creed: "ashari", fiqh: "shafii" },
  "ibn-uthaymeen": { creed: "sunni", fiqh: "hanbali" },
  "aysar-altafasir": { creed: "sunni" },
  // reports and the sciences
  "ibn-abi-hatim": { creed: "sunni" },
  "aldur-almanthoor": { creed: "ashari", fiqh: "shafii" },
  "al-itqan": { creed: "ashari", fiqh: "shafii" },
  "wahidi-asbab": { fiqh: "shafii" },
  "ghareeb-ibn-qutaybah": { creed: "sunni" },
  // rulings
  aljasas: { fiqh: "hanafi" },
  "ilkia-alharrasee": { creed: "ashari", fiqh: "shafii" },
  "ahkam-ibn-alarabee": { creed: "ashari", fiqh: "maliki" },
  almughni: { creed: "sunni", fiqh: "hanbali" },
  almubdi: { creed: "sunni", fiqh: "hanbali" },
  alikleel: { creed: "ashari", fiqh: "shafii" },
  "ahkam-altarayfi": { creed: "sunni", fiqh: "hanbali" },
  "eedah-naskh-mansukh": { fiqh: "maliki" },
  // grammar and the readings
  "aldur-almasoon": { creed: "ashari", fiqh: "shafii" },
  "iraab-alnahas": { creed: "sunni" },
  alnashir: { fiqh: "shafii" },
  "tahbeer-altayseer": { fiqh: "shafii" },
  "mafateeh-alaghanee": { fiqh: "hanafi" },
};

export function labelsOf(id: string): { creed?: Creed; fiqh?: Fiqh } {
  return LABELS[id] ?? {};
}
