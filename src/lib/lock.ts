const PIN_KEY = "bhek.pin.hash";
const TWO_STEP_KEY = "bhek.twostep";
const UNLOCKED_KEY = "bhek.unlocked.until";
const CHAT_LOCK_KEY = "bhek.lockedchats";

const SESSION_MS = 1000 * 60 * 15;

export async function hashPin(pin: string) {
  const bytes = new TextEncoder().encode(`bhekconnect:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hasPin() {
  return typeof window !== "undefined" && Boolean(localStorage.getItem(PIN_KEY));
}

export async function setPin(pin: string) {
  localStorage.setItem(PIN_KEY, await hashPin(pin));
  markUnlocked();
}

export function clearPin() {
  localStorage.removeItem(PIN_KEY);
  localStorage.removeItem(TWO_STEP_KEY);
  localStorage.removeItem(UNLOCKED_KEY);
}

export async function verifyPin(pin: string) {
  const stored = localStorage.getItem(PIN_KEY);
  if (!stored) return false;
  const ok = stored === (await hashPin(pin));
  if (ok) markUnlocked();
  return ok;
}

export function markUnlocked() {
  localStorage.setItem(UNLOCKED_KEY, String(Date.now() + SESSION_MS));
}

export function isUnlocked() {
  const until = Number(localStorage.getItem(UNLOCKED_KEY) ?? 0);
  return Date.now() < until;
}

export function lockNow() {
  localStorage.removeItem(UNLOCKED_KEY);
}

export function twoStepEnabled() {
  return typeof window !== "undefined" && localStorage.getItem(TWO_STEP_KEY) === "on";
}

export function setTwoStep(on: boolean) {
  localStorage.setItem(TWO_STEP_KEY, on ? "on" : "off");
}

function lockedChats(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CHAT_LOCK_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function isChatLocked(id: string) {
  return lockedChats().includes(id);
}

export function toggleChatLock(id: string) {
  const next = isChatLocked(id)
    ? lockedChats().filter((c) => c !== id)
    : [...lockedChats(), id];
  localStorage.setItem(CHAT_LOCK_KEY, JSON.stringify(next));
  return next.includes(id);
}
