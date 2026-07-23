import { type ReactNode } from "react";
import { cn } from "./cn";

type Color = "slate" | "brand" | "green" | "red" | "amber";

const colors: Record<Color, string> = {
  slate: "bg-slate-100 text-slate-700",
  brand: "bg-brand-50 text-brand-700",
  green: "bg-green-100 text-green-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-800",
};

export default function Badge({
  children,
  color = "slate",
  className,
}: {
  children: ReactNode;
  color?: Color;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        colors[color],
        className,
      )}
    >
      {children}
    </span>
  );
}
