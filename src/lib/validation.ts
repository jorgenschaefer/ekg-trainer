// A session code is exactly four digits (leading zeros allowed).
export const CODE_RE = /^\d{4}$/;

export function isValidCode(code: string): boolean {
  return CODE_RE.test(code);
}
