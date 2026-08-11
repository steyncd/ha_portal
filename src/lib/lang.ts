// Afrikaans — Phase 5.3.
//
// TRANSLATE THE VOICE, NOT THE CHROME. This is the whole rule, and getting it
// backwards is the usual failure: an app that translates "Settings" to
// "Instellings" but leaves the daily briefing in English has translated the
// part nobody reads and left the part everybody does.
//
// Translated:   faith (Gebedslys, oordenking, gratitude), the kids' shells, and
//               ALL GENERATED TEXT — briefings, nudges, chart captions, TTS.
//               That last group is one line in the Gemini prompt, which is why
//               it is the cheapest and highest-value part of this.
// NOT translated: nav labels, chart axes, Settings, System, Devices, entity ids.
//               Those are the vocabulary you use to talk to Home Assistant, and
//               a half-translated technical surface is harder to use than an
//               English one — you end up guessing which half you are looking at.
//
// Numbers ALWAYS use af-ZA when the reader is Afrikaans: R48,50 and 4 623, with
// a comma decimal and a space thousands separator. Getting this wrong is worse
// than not translating at all, because R48.50 reads as forty-eight rand fifty in
// English and as an error in Afrikaans.

export type Lang = "en" | "af";

/** Per-person language. The reader decides, not the device. */
export type Person = { id: string; name: string; lang: Lang };

export const PEOPLE: Person[] = [
  { id: "christo", name: "Christo", lang: "en" },
  { id: "mandri", name: "Mandri", lang: "af" },
  { id: "liam", name: "Liam", lang: "af" },
  { id: "eben", name: "Eben", lang: "af" },
];

export const langOf = (personId: string): Lang =>
  PEOPLE.find((p) => p.id === personId)?.lang ?? "en";

/** Locale tag for Intl. */
export const localeOf = (lang: Lang) => (lang === "af" ? "af-ZA" : "en-ZA");

/**
 * Money. af-ZA gives "R48,50"; en-ZA gives "R48.50". Both use R, so the symbol
 * is written rather than relying on currency formatting, which renders "ZAR" in
 * some locales.
 */
export function money(v: number | null | undefined, lang: Lang = "en", dp = 2): string {
  if (v == null) return "—";
  return `R${new Intl.NumberFormat(localeOf(lang), {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(v)}`;
}

/** Plain number. af-ZA groups with a space: 4 623. */
export function num(v: number | null | undefined, lang: Lang = "en", dp = 0): string {
  if (v == null) return "—";
  return new Intl.NumberFormat(localeOf(lang), {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(v);
}

/**
 * The strings that DO get translated: faith, the kids' shells, and the small
 * amount of chrome that sits inside them.
 *
 * Deliberately a flat map with English keys rather than a nested i18n tree. At
 * this size a tree costs more to read than it saves, and an English key means a
 * missing translation degrades to readable English instead of to "faith.pray.1".
 */
const AF: Record<string, string> = {
  // Faith
  "Prayer list": "Gebedslys",
  "Daily devotion": "Daaglikse oordenking",
  "Gratitude": "Dankbaarheid",
  "What are you grateful for?": "Waarvoor is jy dankbaar?",
  "Add a prayer": "Voeg 'n gebed by",
  "Answered": "Verhoor",
  "Praying": "Bid",
  // Kids' shells
  "Chores": "Takies",
  "Done": "Klaar",
  "Waiting for approval": "Wag vir goedkeuring",
  "Approved": "Goedgekeur",
  "Balance": "Balans",
  "Paid out": "Uitbetaal",
  "Today": "Vandag",
  "This week": "Hierdie week",
  "Well done": "Goed gedaan",
  "Trust": "Vertroue",
  "Take a photo": "Neem 'n foto",
  "Bedtime": "Slaaptyd",
  "Good morning": "Goeie môre",
  "Goodnight": "Lekker slaap",
  // Month in review
  "The month": "Die maand",
  "Power": "Krag",
  "Water": "Water",
  "Bin day": "Vullisdag",
};

/**
 * Translate a UI string for a reader. Falls back to the English it was given,
 * so an untranslated string is merely untranslated rather than broken.
 */
export function t(s: string, lang: Lang = "en"): string {
  if (lang !== "af") return s;
  return AF[s] ?? s;
}

/**
 * The one line that makes generated text follow the reader — briefings, nudges,
 * chart captions and TTS all go through a Gemini prompt, so this is appended to
 * it rather than translated afterwards. Translating model output twice
 * introduces errors the model would not have made.
 */
export function promptLanguage(lang: Lang): string {
  return lang === "af"
    ? "Write your entire reply in Afrikaans, in the natural register a South African family uses at home — not formal or literary Afrikaans. Use af-ZA number formatting: a comma for the decimal (R48,50) and a space for thousands (4 623). Keep entity ids, Home Assistant terms and units in English."
    : "";
}
