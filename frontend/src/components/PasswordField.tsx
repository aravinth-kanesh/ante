import { useState } from "react";

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
    <label style={{ display: "block" }}>
      {label}
      <span style={{ position: "relative", display: "block", margin: "0.25rem 0 1rem" }}>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          style={{ width: "100%", padding: "0.5rem", paddingRight: "2.5rem", boxSizing: "border-box" }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          title={show ? "Hide password" : "Show password"}
          style={{
            position: "absolute",
            right: "0.5rem",
            top: "50%",
            transform: "translateY(-50%)",
            border: "none",
            background: "none",
            cursor: "pointer",
            fontSize: "1rem",
            lineHeight: 1,
          }}
        >
          {show ? "🙈" : "👁"}
        </button>
      </span>
    </label>
  );
}
