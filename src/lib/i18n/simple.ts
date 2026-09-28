import type { Locale } from "./config";
import { simpleOverridesEn, type TranslationKey } from "./dictionaries/en";

/**
 * Simple Mode wording.
 *
 * Simple Mode is a real, persisted preference (not a cosmetic toggle): it swaps
 * technical phrasing for everyday language, enlarges touch targets and surfaces
 * the primary action on every screen. Telugu and Hindi already use everyday
 * words, so their overrides are intentionally small.
 */
export const simpleOverrides: Record<Locale, Partial<Record<TranslationKey, string>>> = {
  en: simpleOverridesEn,
  te: {
    "soil.organicMatter": "సేంద్రియ పదార్థం (నేలకు ఆహారం)",
    "weather.humidity": "గాలిలో తేమ",
    "market.minOrder": "కొనగలిగే కనీస పరిమాణం",
    "common.simpleModeHelp": "పెద్ద బటన్లు, సులభమైన మాటలు.",
  },
  hi: {
    "soil.organicMatter": "जैविक पदार्थ (मिट्टी का भोजन)",
    "weather.humidity": "हवा में नमी",
    "market.minOrder": "कम से कम कितना खरीद सकते हैं",
    "common.simpleModeHelp": "बड़े बटन, आसान शब्द.",
  },
};
