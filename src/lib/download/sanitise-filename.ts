const FORBIDDEN_CHARACTERS = /[";\r\n:]/g;

export function sanitiseFilename(name: string): string {
  const sanitised = name.replace(FORBIDDEN_CHARACTERS, "").trim();
  return sanitised.length > 0 ? sanitised : "resource";
}
