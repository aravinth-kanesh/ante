import { type ReactNode } from "react";
import { cn } from "./cn";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}

export default function Toggle({ checked, onChange, label, disabled }: Props) {
  return (
    <label className={cn("inline-flex items-center gap-3 select-none", disabled ? "cursor-default" : "cursor-pointer")}>
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 has-[:focus-visible]:ring-offset-2",
          checked ? "bg-brand-600" : "bg-slate-300",
          disabled && "opacity-50",
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <span
          className={cn(
            "absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5",
          )}
        />
      </span>
      {label && <span className="text-sm text-slate-700">{label}</span>}
    </label>
  );
}
