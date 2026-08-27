export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: "Invalid email or password.",
  EMAIL_IN_USE: "An account with that email already exists.",
  VALIDATION_ERROR: "Please correct the errors below.",
} as const;

export type AuthErrorCode = keyof typeof AUTH_ERRORS;
