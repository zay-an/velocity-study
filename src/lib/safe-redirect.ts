const DEFAULT_PATH = "/";

/**
 * Returns a same-origin relative path for post-auth redirects, rejecting
 * absolute URLs, protocol-relative URLs ("//evil.com") and backslash tricks.
 */
export function sanitizeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_PATH;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return DEFAULT_PATH;
  }
  // Never bounce back into the auth flow itself.
  if (raw === "/auth" || raw.startsWith("/auth/") || raw.startsWith("/auth?")) {
    return DEFAULT_PATH;
  }
  return raw;
}
