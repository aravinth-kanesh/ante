import { cn } from "./cn";
import Spinner from "./Spinner";

// A consistent, accessible loading indicator: a spinner paired with visible text, so it
// reads to a screen reader (the spinner itself is decorative) and looks the same on
// every page rather than a bare line of grey text.
export default function Loading({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn("flex items-center gap-2.5 text-sm text-slate-500", className)}>
      <Spinner className="text-brand-500" />
      <span>{label}</span>
    </div>
  );
}
