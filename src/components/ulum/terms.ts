import { bare } from "@/lib/ulum/skeleton";

/**
 * The terms of the sciences, in English.
 *
 * The books on the page speak in Arabic, and the page leaves them in it. What
 * a reader who does not yet read the grammarians' Arabic is given is the name
 * of the thing — that «مبتدأ» is the subject of a nominal sentence, that
 * «الاستعارة» is metaphor — the way a glossary at the back of a grammar gives
 * it. These tables are that glossary and nothing more: a term found in a
 * book's remark is named; the remark itself is never put into English.
 *
 * Each English name carries the Arabic term in transliteration, because that
 * is what a teacher will say and what the next book will use.
 */

/** The parts of speech by the corpus's class, under the names the corpus gives them in Arabic. */
export const POS_ARABIC: Record<string, string> = {
  N: "اسم",
  PN: "اسم علم",
  ADJ: "صفة",
  IMPN: "اسم فعل أمر",
  PRON: "ضمير",
  DEM: "اسم إشارة",
  REL: "اسم موصول",
  T: "ظرف زمان",
  LOC: "ظرف مكان",
  V: "فعل",
  P: "حرف جر",
  EMPH: "لام التوكيد",
  IMPV: "لام الأمر",
  PRP: "لام التعليل",
  CONJ: "حرف عطف",
  SUB: "حرف مصدري",
  ACC: "حرف نصب",
  AMD: "حرف استدراك",
  ANS: "حرف جواب",
  AVR: "حرف ردع",
  CAUS: "حرف سببية",
  CERT: "حرف تحقيق",
  CIRC: "حرف حال",
  COM: "واو المعية",
  COND: "حرف شرط",
  EQ: "حرف تسوية",
  EXH: "حرف تحضيض",
  EXL: "حرف تفصيل",
  EXP: "أداة استثناء",
  FUT: "حرف استقبال",
  INC: "حرف ابتداء",
  INT: "حرف تفسير",
  INTG: "حرف استفهام",
  NEG: "حرف نفي",
  PREV: "حرف كاف",
  PRO: "حرف نهي",
  REM: "حرف استئناف",
  RES: "أداة حصر",
  RET: "حرف إضراب",
  RSLT: "حرف واقع في جواب الشرط",
  SUP: "حرف زائد",
  SUR: "حرف فجاءة",
  VOC: "حرف نداء",
  INL: "حروف مقطعة",
  DET: "أداة تعريف",
};

/**
 * The offices a word holds in its sentence, as the books of iʿrāb name them,
 * longest first so that «اسم لا» is found before «اسم» and «مفعول به» before
 * «مفعول». Only offices — what a word does — not descriptions of its form.
 */
const OFFICES: [string, string][] = [
  ["لفظ الجلالة", "the Name of Allah"],
  ["نائب فاعل", "deputy agent (nāʾib fāʿil)"],
  ["مفعول مطلق", "absolute object (mafʿūl muṭlaq)"],
  ["مفعول لأجله", "object of purpose (mafʿūl li-ajlih)"],
  ["مفعول لاجله", "object of purpose (mafʿūl li-ajlih)"],
  ["مفعول فيه", "adverbial object (mafʿūl fīh)"],
  ["مفعول معه", "object of accompaniment (mafʿūl maʿah)"],
  ["مفعول به", "direct object (mafʿūl bih)"],
  ["مضاف إليه", "governed in annexation (muḍāf ilayh)"],
  ["مضاف اليه", "governed in annexation (muḍāf ilayh)"],
  ["اسم لا", "noun of lā (ism lā)"],
  ["اسم إن", "noun of inna (ism inna)"],
  ["اسم ان", "noun of inna (ism inna)"],
  ["خبر إن", "predicate of inna (khabar inna)"],
  ["اسم كان", "noun of kāna (ism kāna)"],
  ["خبر كان", "predicate of kāna (khabar kāna)"],
  ["خبر مقدم", "fronted predicate (khabar muqaddam)"],
  ["مبتدأ مؤخر", "deferred subject (mubtadaʾ muʾakhkhar)"],
  ["مبتدأ", "subject (mubtadaʾ)"],
  ["خبر", "predicate (khabar)"],
  ["فاعل", "agent (fāʿil)"],
  ["حال", "circumstantial (ḥāl)"],
  ["تمييز", "specifier (tamyīz)"],
  ["نعت", "adjective (naʿt)"],
  ["صفة", "adjective (ṣifa)"],
  ["بدل", "substitute (badal)"],
  ["معطوف", "coordinated (maʿṭūf)"],
  ["عطف", "coordinated (ʿaṭf)"],
  ["توكيد", "emphasis (tawkīd)"],
  ["منادى", "vocative (munādā)"],
  ["مستثنى", "excepted (mustathnā)"],
  ["صلة الموصول", "relative clause (ṣilat al-mawṣūl)"],
  ["جار ومجرور", "preposition and its object (jārr wa-majrūr)"],
  ["جار و مجرور", "preposition and its object (jārr wa-majrūr)"],
  ["متعلقان", "preposition and its object (jārr wa-majrūr)"],
  ["ظرف زمان", "adverb of time (ẓarf zamān)"],
  ["ظرف مكان", "adverb of place (ẓarf makān)"],
  ["مجرور", "governed by the preposition (majrūr)"],
  ["فعل ماض", "perfect verb (fiʿl māḍī)"],
  ["ماض", "perfect verb (fiʿl māḍī)"],
  ["فعل مضارع", "imperfect verb (fiʿl muḍāriʿ)"],
  ["مضارع", "imperfect verb (fiʿl muḍāriʿ)"],
  ["فعل أمر", "imperative (fiʿl amr)"],
  ["فعل امر", "imperative (fiʿl amr)"],
  ["نافية للجنس", "generic negation (lā al-nāfiya li-l-jins)"],
  ["نافية", "negative particle (nāfiya)"],
  ["أداة حصر", "particle of restriction (adāt ḥaṣr)"],
  ["اداة حصر", "particle of restriction (adāt ḥaṣr)"],
  ["أداة استثناء", "particle of exception (adāt istithnāʾ)"],
  ["اداة استثناء", "particle of exception (adāt istithnāʾ)"],
  ["أداة شرط", "conditional particle (adāt sharṭ)"],
  ["اداة شرط", "conditional particle (adāt sharṭ)"],
  ["حرف جر", "preposition (ḥarf jarr)"],
  ["حرف عطف", "conjunction (ḥarf ʿaṭf)"],
  ["عاطفة", "conjunction (ḥarf ʿaṭf)"],
  ["استئنافية", "resumptive (istiʾnāfiyya)"],
  ["حالية", "circumstantial wāw (wāw al-ḥāl)"],
  ["حرف نداء", "vocative particle (ḥarf nidāʾ)"],
  ["حرف تحقيق", "particle of certainty (ḥarf taḥqīq)"],
  ["حرف مصدري", "infinitival particle (ḥarf maṣdarī)"],
  ["مصدرية", "infinitival particle (ḥarf maṣdarī)"],
  ["حرف نصب", "particle of the subjunctive (ḥarf naṣb)"],
  ["حرف جزم", "particle of the jussive (ḥarf jazm)"],
  ["حرف توكيد", "particle of emphasis (ḥarf tawkīd)"],
  ["زائدة", "supplementary (zāʾida)"],
  ["اسم موصول", "relative pronoun (ism mawṣūl)"],
  ["اسم إشارة", "demonstrative (ism ishāra)"],
  ["اسم اشارة", "demonstrative (ism ishāra)"],
  ["اسم استفهام", "interrogative (ism istifhām)"],
  ["حرف استفهام", "interrogative particle (ḥarf istifhām)"],
  ["ضمير", "pronoun (ḍamīr)"],
  ["حروف مقطعة", "disjointed letters (al-ḥurūf al-muqaṭṭaʿa)"],
];

const BY_LENGTH = [...OFFICES].sort((a, b) => b[0].length - a[0].length);

/** Every office named in a remark, in the order the remark names them. */
function officesIn(text: string): { at: number; ar: string; en: string }[] {
  const plain = bare(text).replace(/[ّ]/g, "");
  const found: { at: number; ar: string; en: string }[] = [];
  const taken: [number, number][] = [];
  // Longest first, so that a term inside a longer one — «نافية» in
  // «استئنافية» — never claims the longer one's letters.
  for (const [arTerm, en] of BY_LENGTH) {
    let from = 0;
    for (;;) {
      const at = plain.indexOf(arTerm, from);
      if (at < 0) break;
      from = at + arTerm.length;
      if (taken.some(([a, b]) => at < b && at + arTerm.length > a)) continue;
      taken.push([at, at + arTerm.length]);
      found.push({ at, ar: arTerm, en });
    }
  }
  return found.sort((a, b) => a.at - b.at);
}

/**
 * The office a remark gives its word first — the one a teacher would say:
 * «لفظ الجلالة مبتدأ مرفوع» → the subject, not the Name. The Name of Allah
 * and the bare parts of speech give way to an office named after them.
 */
export function officeOf(text: string): { ar: string; en: string } | null {
  const all = officesIn(text);
  if (!all.length) return null;
  const weak = new Set(["لفظ الجلالة", "ضمير", "مجرور", "ماض", "مضارع", "فعل ماض", "فعل مضارع"]);
  const strong = all.find((o) => !weak.has(o.ar) && o.at - all[0].at < 40);
  return strong ?? all[0];
}

/** The figures of rhetoric, in English, by the names the books give them. */
const FIGURES: [string, string][] = [
  ["الاستعارة التصريحية", "explicit metaphor (istiʿāra taṣrīḥiyya)"],
  ["الاستعارة المكنية", "implied metaphor (istiʿāra makniyya)"],
  ["الاستعارة التمثيلية", "extended metaphor (istiʿāra tamthīliyya)"],
  ["الاستعارة", "metaphor (istiʿāra)"],
  ["التشبيه البليغ", "eloquent simile (tashbīh balīgh)"],
  ["التشبيه التمثيلي", "extended simile (tashbīh tamthīlī)"],
  ["التشبيه", "simile (tashbīh)"],
  ["المجاز المرسل", "non-metaphorical trope (majāz mursal)"],
  ["المجاز العقلي", "rational trope (majāz ʿaqlī)"],
  ["المجاز", "figurative usage (majāz)"],
  ["الكناية", "allusion (kināya)"],
  ["إيجاز الحذف", "concision by ellipsis (ījāz al-ḥadhf)"],
  ["إيجاز القصر", "concision by compression (ījāz al-qaṣr)"],
  ["الإيجاز", "concision (ījāz)"],
  ["الإطناب", "amplification (iṭnāb)"],
  ["التكرار", "repetition (takrār)"],
  ["التكرير", "repetition (takrār)"],
  ["الالتفات", "shift of address (iltifāt)"],
  ["القصر", "restriction (qaṣr)"],
  ["الحصر", "restriction (ḥaṣr)"],
  ["التقديم والتأخير", "fronting and deferring (taqdīm wa-taʾkhīr)"],
  ["التقديم", "fronting (taqdīm)"],
  ["الطباق", "antithesis (ṭibāq)"],
  ["المطابقة", "antithesis (muṭābaqa)"],
  ["المقابلة", "parallel contrast (muqābala)"],
  ["الجناس", "paronomasia (jinās)"],
  ["السجع", "rhymed cadence (sajʿ)"],
  ["الاستفهام الإنكاري", "rhetorical question of denial (istifhām inkārī)"],
  ["الاستفهام", "rhetorical question (istifhām)"],
  ["التذييل", "closing confirmation (tadhyīl)"],
  ["الاحتراس", "guarding clause (iḥtirās)"],
  ["الاعتراض", "parenthesis (iʿtirāḍ)"],
  ["الاستئناف", "resumption (istiʾnāf)"],
  ["المبالغة", "intensification (mubālagha)"],
  ["صيغة المبالغة", "intensive form (ṣīghat mubālagha)"],
  ["التنكير", "indefiniteness for effect (tankīr)"],
  ["التعريف", "definiteness for effect (taʿrīf)"],
  ["التهكم", "irony (tahakkum)"],
  ["التورية", "double meaning (tawriya)"],
  ["المشاكلة", "verbal symmetry (mushākala)"],
  ["اللف والنشر", "convolution and unfolding (laff wa-nashr)"],
  ["حسن التقسيم", "fine division (ḥusn al-taqsīm)"],
  ["التقسيم", "division (taqsīm)"],
  ["الإشارة", "allusion (ishāra)"],
  ["التعريض", "innuendo (taʿrīḍ)"],
  ["التضمين", "implied sense (taḍmīn)"],
  ["الإضمار", "implicit mention (iḍmār)"],
  ["الحذف", "ellipsis (ḥadhf)"],
  ["العكس", "chiasmus (ʿaks)"],
  ["رد العجز على الصدر", "return of the end to the beginning (radd al-ʿajuz ʿalā al-ṣadr)"],
  ["الإظهار في مقام الإضمار", "the noun where the pronoun was expected (al-iẓhār fī maqām al-iḍmār)"],
  ["التعليل", "giving the cause (taʿlīl)"],
  ["الإبهام", "deliberate vagueness (ibhām)"],
  ["التفصيل بعد الإجمال", "detail after summary (al-tafṣīl baʿd al-ijmāl)"],
  ["الترقي", "ascending order (taraqqī)"],
];

export function figureOf(name: string): string | null {
  const plain = bare(name);
  for (const [arTerm, en] of FIGURES) if (plain.includes(bare(arTerm))) return en;
  return null;
}

/** The radicals of a root, by their names, as a teacher spells a root aloud. */
export const LETTER_NAMES: Record<string, string> = {
  ا: "alif", أ: "hamza", إ: "hamza", ء: "hamza", آ: "hamza", ؤ: "hamza", ئ: "hamza",
  ب: "bāʾ", ت: "tāʾ", ث: "thāʾ", ج: "jīm", ح: "ḥāʾ", خ: "khāʾ", د: "dāl", ذ: "dhāl", ر: "rāʾ",
  ز: "zāy", س: "sīn", ش: "shīn", ص: "ṣād", ض: "ḍād", ط: "ṭāʾ", ظ: "ẓāʾ", ع: "ʿayn", غ: "ghayn",
  ف: "fāʾ", ق: "qāf", ك: "kāf", ل: "lām", م: "mīm", ن: "nūn", ه: "hāʾ", و: "wāw", ي: "yāʾ", ى: "yāʾ",
};
