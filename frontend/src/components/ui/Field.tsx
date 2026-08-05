import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from "react";
import { cn } from "./cn";

export const controlClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 transition-colors focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40 disabled:bg-slate-50 disabled:text-slate-500";

const labelClass = "mb-1 block text-sm font-medium text-slate-700";

// Optional label/hint/error that a control renders and wires up for accessibility.
interface FieldExtras {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

function describedBy(hintId?: string, errorId?: string): string | undefined {
  return [hintId, errorId].filter(Boolean).join(" ") || undefined;
}

function Wrapper({
  id,
  label,
  hint,
  error,
  hintId,
  errorId,
  children,
}: {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  hintId?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
      )}
      {children}
      {hint && (
        <p id={hintId} className="mt-1 text-xs leading-relaxed text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({
  label,
  hint,
  error,
  id,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & FieldExtras) {
  const auto = useId();
  const fieldId = id ?? auto;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const control = (
    <input
      id={fieldId}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(hintId, errorId)}
      className={cn(controlClass, error ? "border-red-400" : "", className)}
      {...rest}
    />
  );
  if (!label && !hint && !error) return control;
  return (
    <Wrapper id={fieldId} label={label} hint={hint} error={error} hintId={hintId} errorId={errorId}>
      {control}
    </Wrapper>
  );
}

export function TextArea({
  label,
  hint,
  error,
  id,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldExtras) {
  const auto = useId();
  const fieldId = id ?? auto;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const control = (
    <textarea
      id={fieldId}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(hintId, errorId)}
      className={cn(controlClass, "resize-y", error ? "border-red-400" : "", className)}
      {...rest}
    />
  );
  if (!label && !hint && !error) return control;
  return (
    <Wrapper id={fieldId} label={label} hint={hint} error={error} hintId={hintId} errorId={errorId}>
      {control}
    </Wrapper>
  );
}

export function Select({
  label,
  hint,
  error,
  id,
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & FieldExtras) {
  const auto = useId();
  const fieldId = id ?? auto;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const control = (
    <select
      id={fieldId}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(hintId, errorId)}
      className={cn(controlClass, "pr-8", className)}
      {...rest}
    />
  );
  if (!label && !hint && !error) return control;
  return (
    <Wrapper id={fieldId} label={label} hint={hint} error={error} hintId={hintId} errorId={errorId}>
      {control}
    </Wrapper>
  );
}

// A standalone block label for a group of controls that has no single input to
// point at (each single control above renders its own associated <label>).
export function Label({ children }: { children: ReactNode }) {
  return <span className={labelClass}>{children}</span>;
}
