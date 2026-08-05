import { useId, useState } from "react";
import { controlClass, EyeIcon, EyeSlashIcon, cn } from "./ui";

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
  const id = useId();
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
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
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
        >
          {show ? <EyeSlashIcon className="h-5 w-5" aria-hidden="true" /> : <EyeIcon className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
