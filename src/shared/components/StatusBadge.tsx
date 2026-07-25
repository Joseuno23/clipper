import { cn } from "@/lib/utils";

type Tone =
  "neutral" | "success" | "warning" | "info" | "destructive" | "primary";

const toneStyles: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  success: "bg-success/12 text-success ring-success/20",
  warning: "bg-warning/12 text-warning ring-warning/25",
  info: "bg-info/12 text-info ring-info/25",
  destructive: "bg-destructive/12 text-destructive ring-destructive/25",
  primary: "bg-primary/12 text-primary ring-primary/25",
};

interface StatusBadgeProps {
  tone?: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({
  tone = "neutral",
  children,
  dot = true,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneStyles[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", `bg-current`)}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}
