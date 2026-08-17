/** App language preference (device-local) with Ghanaian and pan-African options. */

export type Language = {
  code: string;
  label: string;
  native: string;
  region: string;
};

export const LANGUAGES: Language[] = [
  { code: "en", label: "English", native: "English", region: "Default" },
  { code: "tw", label: "Twi", native: "Twi (Akan)", region: "Ghana" },
  { code: "dag", label: "Dagbani", native: "Dagbanli", region: "Ghana" },
  { code: "gaa", label: "Ga", native: "Gã", region: "Ghana" },
  { code: "ee", label: "Ewe", native: "Eʋegbe", region: "Ghana / Togo" },
  { code: "ff", label: "Fante", native: "Mfantse", region: "Ghana" },
  { code: "ha", label: "Hausa", native: "Harshen Hausa", region: "West Africa" },
  { code: "yo", label: "Yoruba", native: "Èdè Yorùbá", region: "Nigeria" },
  { code: "ig", label: "Igbo", native: "Asụsụ Igbo", region: "Nigeria" },
  { code: "sw", label: "Swahili", native: "Kiswahili", region: "East Africa" },
  { code: "zu", label: "isiZulu", native: "isiZulu", region: "South Africa" },
  { code: "fr", label: "French", native: "Français", region: "International" },
  { code: "pt", label: "Portuguese", native: "Português", region: "International" },
  { code: "ar", label: "Arabic", native: "العربية", region: "International" },
];

const KEY = "bhek.language";

export function currentLanguage(): string {
  if (typeof window === "undefined") return "en";
  return localStorage.getItem(KEY) ?? "en";
}

export function setLanguage(code: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, code);
  document.documentElement.lang = code;
}

export function languageLabel(code: string) {
  return LANGUAGES.find((l) => l.code === code)?.native ?? "English";
}

/** Greeting used across the app so a language choice is visible immediately. */
export const GREETINGS: Record<string, string> = {
  en: "Welcome",
  tw: "Akwaaba",
  dag: "Maraaba",
  gaa: "Ojekoo",
  ee: "Woezɔ",
  ff: "Akwaaba",
  ha: "Barka da zuwa",
  yo: "Ẹ kú àbọ̀",
  ig: "Nnọọ",
  sw: "Karibu",
  zu: "Sawubona",
  fr: "Bienvenue",
  pt: "Bem-vindo",
  ar: "أهلا وسهلا",
};
