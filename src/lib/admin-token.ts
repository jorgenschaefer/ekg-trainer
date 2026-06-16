interface TokenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

// The admin token rides in the URL fragment (never sent to the server). When present
// we cache it per device so a bare /admin/:code (no fragment) still restores control.
export function resolveAdminToken(
  code: string,
  hash: string,
  storage: TokenStorage,
): string | null {
  const fromFragment = hash.replace(/^#/, "");
  if (fromFragment) {
    storage.setItem(`admin:${code}`, fromFragment);
    return fromFragment;
  }
  return storage.getItem(`admin:${code}`);
}
