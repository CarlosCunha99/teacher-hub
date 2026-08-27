export interface ValidationSuccess {
  ok: true;
}

export interface ValidationFailure {
  ok: false;
  field: "name" | "email" | "password" | "form";
  message: string;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateRegistrationInput(input: {
  name: string;
  email: string;
  password: string;
}): ValidationResult {
  if (!input.name.trim()) {
    return { ok: false, field: "name", message: "Name is required." };
  }

  if (!EMAIL_REGEX.test(input.email.trim())) {
    return { ok: false, field: "email", message: "Please enter a valid email address." };
  }

  if (input.password.length < 8) {
    return {
      ok: false,
      field: "password",
      message: "Password must be at least 8 characters.",
    };
  }

  return { ok: true };
}

export function validateSignInInput(input: { email: string; password: string }): ValidationResult {
  if (!EMAIL_REGEX.test(input.email.trim())) {
    return { ok: false, field: "email", message: "Please enter a valid email address." };
  }

  if (!input.password) {
    return { ok: false, field: "password", message: "Password is required." };
  }

  return { ok: true };
}
