import { LucideIcon } from "lucide-react";
import { Panel } from "@/components/ui/Panel";

type StatCardProps = {
  title: string;
  value: string;
  hint: string;
  icon: LucideIcon;
};

export function StatCard({ title, value, hint, icon: Icon }: StatCardProps) {
  return (
    <Panel className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-mint-400/80 to-transparent" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-white/45">{title}</p>
          <p className="mt-4 font-display text-3xl text-white">{value}</p>
          <p className="mt-2 text-sm text-white/55">{hint}</p>
        </div>
        <div className="rounded-2xl border border-mint-400/20 bg-mint-400/10 p-3 text-mint-400">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Panel>
  );
}
