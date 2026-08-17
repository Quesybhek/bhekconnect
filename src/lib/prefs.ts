/** Device-local app preferences: notifications, accessibility, data usage. */

export type Prefs = {
  notifyMessages: boolean;
  notifyGroups: boolean;
  notifyCalls: boolean;
  notifyStatus: boolean;
  sound: boolean;
  vibrate: boolean;
  previewText: boolean;
  fontScale: "small" | "default" | "large" | "xlarge";
  highContrast: boolean;
  reduceMotion: boolean;
  boldText: boolean;
  autoDownload: "never" | "wifi" | "always";
};

export const DEFAULT_PREFS: Prefs = {
  notifyMessages: true,
  notifyGroups: true,
  notifyCalls: true,
  notifyStatus: false,
  sound: true,
  vibrate: true,
  previewText: true,
  fontScale: "default",
  highContrast: false,
  reduceMotion: false,
  boldText: false,
  autoDownload: "wifi",
};

const KEY = "bhek.prefs";

export function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(next: Prefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(next));
  applyPrefs(next);
}

export function applyPrefs(prefs: Prefs = loadPrefs()) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset["fontScale"] = prefs.fontScale;
  root.dataset["contrast"] = prefs.highContrast ? "high" : "normal";
  root.dataset["motion"] = prefs.reduceMotion ? "reduced" : "full";
  root.dataset["boldText"] = prefs.boldText ? "on" : "off";
}

export const FONT_SCALES: { value: Prefs["fontScale"]; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "default", label: "Default" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "Extra large" },
];

export const AUTO_DOWNLOAD: { value: Prefs["autoDownload"]; label: string }[] = [
  { value: "never", label: "Never" },
  { value: "wifi", label: "Wi-Fi only" },
  { value: "always", label: "Wi-Fi and mobile data" },
];
