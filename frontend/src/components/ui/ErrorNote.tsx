import { type ReactNode } from "react";
import { cn } from "./cn";

// A consistent page-level error banner. Field-scoped errors stay inline next to their
// control; this is for the whole-page or whole-action failures.
export default function ErrorNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
        className,
      )}
    >
      {children}
    </div>
  );
}
