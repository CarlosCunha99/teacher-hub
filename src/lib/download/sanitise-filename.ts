const FORBIDDEN_CHARACTERS = /[";\r\n:]/g;
const NON_ASCII_CHARACTERS = /[^\x00-\x7F]/g;

export function sanitiseFilename(name: string): string {
  const sanitised = name
    .replace(FORBIDDEN_CHARACTERS, "")
    .replace(NON_ASCII_CHARACTERS, "_")
    .trim();
  return sanitised.length > 0 ? sanitised : "resource";
}
