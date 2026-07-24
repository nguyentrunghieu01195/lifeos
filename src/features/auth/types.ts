/** Shared form-state contract between auth server actions and client forms. */

export type AuthField = "name" | "email" | "password";

export interface AuthFormState {
  status: "idle" | "error";
  /** Form-level error (invalid credentials, rate limited, …). */
  formError?: string;
  /** Field-level errors from server-side validation. */
  fieldErrors?: Partial<Record<AuthField, string>>;
}

export const initialAuthFormState: AuthFormState = { status: "idle" };
