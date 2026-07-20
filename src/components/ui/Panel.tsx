import { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

type PanelProps = PropsWithChildren<{
  className?: string;
}>;

export function Panel({ className, children }: PanelProps) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-white/8 bg-white/[0.035] p-6 shadow-panel backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </section>
  );
}
