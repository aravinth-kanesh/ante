import { cn } from "./cn";

// Animated bars shown while a voice is speaking. Echoes the logo mark.
export default function SpeakingIndicator({ className }: { className?: string }) {
  const heights = [7, 12, 9];
  return (
    <span className={cn("flex items-center gap-[3px]", className)} aria-hidden>
      {heights.map((height, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-current animate-pulse"
          style={{ height, animationDelay: `${i * 160}ms`, animationDuration: "900ms" }}
        />
      ))}
    </span>
  );
}
