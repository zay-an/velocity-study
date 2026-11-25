import { isParticipantCode } from "./participant-code";

/** Browser-only persistence for the anonymized participant ID. */
export const PARTICIPANT_STORAGE_KEY = "vs_participant_code";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length));
    }
  }
  return null;
}

/** Reads the stored code from localStorage, falling back to the cookie. */
export function readStoredParticipantCode(): string | null {
  let fromStorage: string | null = null;
  try {
    fromStorage = window.localStorage.getItem(PARTICIPANT_STORAGE_KEY);
  } catch {
    // localStorage can throw in private mode or when storage is blocked.
  }
  if (isParticipantCode(fromStorage)) return fromStorage;

  const fromCookie = readCookie(PARTICIPANT_STORAGE_KEY);
  return isParticipantCode(fromCookie) ? fromCookie : null;
}

/** Persists the code to both localStorage and a first-party cookie. */
export function storeParticipantCode(code: string): void {
  if (!isParticipantCode(code)) return;
  try {
    window.localStorage.setItem(PARTICIPANT_STORAGE_KEY, code);
  } catch {
    // Cookie below is the fallback.
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${PARTICIPANT_STORAGE_KEY}=${encodeURIComponent(code)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}
