import { useState } from "react";
import { controlClass, EyeIcon, EyeSlashIcon, Label, cn } from "./ui";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
  autoComplete?: string;
}

// A password input with a reveal toggle on the right.
export default function PasswordField({ label, value, onChange, minLength, autoComplete }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div className="mb-4">
      <Label>{label}</Label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          className={cn(controlClass, "pr-11")}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          title={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
