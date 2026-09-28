"use client";

import { useFormStatus } from "react-dom";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { clsx } from "clsx";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

/* --------------------------------------------------------------------------
   Form primitives shared by every screen. They use the same input styling so
   farmers see one consistent, large, readable control everywhere.
   -------------------------------------------------------------------------- */

export function Label({ htmlFor, children, hint }: { htmlFor: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink-700">
      {children}
      {hint ? <span className="ml-1 font-normal text-ink-400">({hint})</span> : null}
    </label>
  );
}

const inputBase =
  "w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-base text-ink-900 placeholder:text-ink-300 " +
  "transition focus:border-field-500 focus:outline-none focus:ring-4 focus:ring-field-100 disabled:bg-ink-50 " +
  "min-h-[var(--tap-min)]";

export function TextInput({
  id,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
  autoComplete,
  inputMode,
  min,
  max,
  step,
  maxLength,
  pattern,
  className,
  list,
}: {
  id: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" | "search" | "url";
  min?: number | string;
  max?: number | string;
  step?: number | string;
  maxLength?: number;
  pattern?: string;
  className?: string;
  list?: string;
}) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      defaultValue={defaultValue ?? undefined}
      placeholder={placeholder}
      required={required}
      autoComplete={autoComplete}
      inputMode={inputMode}
      min={min}
      max={max}
      step={step}
      maxLength={maxLength}
      pattern={pattern}
      list={list}
      className={clsx(inputBase, className)}
    />
  );
}

export function TextArea({
  id,
  name,
  defaultValue,
  placeholder,
  rows = 3,
  required,
  maxLength,
}: {
  id: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <textarea
      id={id}
      name={name}
      rows={rows}
      defaultValue={defaultValue ?? undefined}
      placeholder={placeholder}
      required={required}
      maxLength={maxLength}
      className={clsx(inputBase, "resize-y leading-relaxed")}
    />
  );
}

export function Select({
  id,
  name,
  defaultValue,
  children,
  required,
}: {
  id: string;
  name: string;
  defaultValue?: string | number | null;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <select id={id} name={name} defaultValue={defaultValue ?? undefined} required={required} className={inputBase}>
      {children}
    </select>
  );
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-danger-600">
      <AlertCircle className="size-4 shrink-0" aria-hidden />
      {children}
    </p>
  );
}

export function FieldHint({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{children}</p>;
}

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className,
  dataPrimary,
  disabled,
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  dataPrimary?: boolean;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      data-primary-action={dataPrimary ? "" : undefined}
      className={clsx(buttonStyles(variant), className)}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function buttonStyles(variant: "primary" | "secondary" | "ghost" | "danger" | "soild") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition tap-target " +
    "disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]";
  switch (variant) {
    case "secondary":
      return `${base} border border-ink-200 bg-white text-ink-800 hover:border-field-300 hover:bg-field-50`;
    case "ghost":
      return `${base} bg-transparent text-ink-600 hover:bg-ink-100`;
    case "danger":
      return `${base} bg-danger-500 text-white hover:bg-danger-600`;
    case "soild":
      return `${base} bg-soil-500 text-white hover:bg-soil-600`;
    default:
      return `${base} bg-field-700 text-white shadow-sm hover:bg-field-800`;
  }
}

/* --------------------------------------------------------------------------
   Action-state helper: server actions return { ok, message } and this form
   renders the result inline (no raw stack traces, ever).
   -------------------------------------------------------------------------- */

export type { ActionState } from "@/lib/actions/state";
import type { ActionState } from "@/lib/actions/state";

export function FormMessage({ state }: { state: ActionState | null }) {
  if (!state) return null;
  const text = state.ok ? state.message : state.error ?? state.message;
  const fieldErrors = state.ok ? [] : Object.entries(state.fieldErrors ?? {});
  if (!text && fieldErrors.length === 0) return null;

  return (
    <div
      role={state.ok ? "status" : "alert"}
      className={clsx(
        "flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium",
        state.ok ? "bg-field-50 text-field-800" : "bg-danger-50 text-danger-700",
      )}
    >
      {state.ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      <span className="min-w-0">
        {text ? <span className="block">{text}</span> : null}
        {fieldErrors.length > 0 ? (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 font-normal">
            {fieldErrors.map(([field, message]) => (
              <li key={field}>
                <span className="font-semibold">{field.replace(/_/g, " ")}</span>: {message}
              </li>
            ))}
          </ul>
        ) : null}
      </span>
    </div>
  );
}

export function ActionForm({
  action,
  children,
  className,
  onSuccessRefresh = false,
  showMessage = false,
  messageClassName,
}: {
  action: (state: ActionState | null, formData: FormData) => Promise<ActionState>;
  children: ReactNode | ((state: ActionState | null) => ReactNode);
  className?: string;
  onSuccessRefresh?: boolean;
  /** Renders the action result (success or a human message) inside the form. */
  showMessage?: boolean;
  messageClassName?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const refreshed = useRef(false);

  useEffect(() => {
    if (onSuccessRefresh && state?.ok && !refreshed.current) {
      refreshed.current = true;
    }
  }, [onSuccessRefresh, state]);

  return (
    <form action={formAction} className={className} noValidate>
      {typeof children === "function" ? children(state) : children}
      {showMessage && state ? (
        <div className={messageClassName}>
          <FormMessage state={state} />
        </div>
      ) : null}
    </form>
  );
}

export { inputBase };
