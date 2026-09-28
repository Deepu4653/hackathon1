/** Shape every server action returns. UI code renders it, never raw errors. */

export interface ActionState {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Optional machine-readable code so screens can react (e.g. show a dev link). */
  code?: "not_configured" | "rate_limited" | "invalid" | "forbidden" | "ok";
  [key: string]: unknown;
}

export function actionOk(message?: string, extra: Partial<ActionState> = {}): ActionState {
  return { ok: true, message, code: "ok", ...extra };
}

export function actionError(error: string, extra: Partial<ActionState> = {}): ActionState {
  return { ok: false, error, ...extra };
}

/** Turns a zod error map into per-field messages. */
export function fieldErrorsFrom(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

export function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function formNumber(formData: FormData, key: string): number | undefined {
  const raw = formValue(formData, key);
  if (raw === "") return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function formBool(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}
