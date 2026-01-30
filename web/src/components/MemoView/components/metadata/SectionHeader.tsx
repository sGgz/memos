import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  count: number;
  hideIcon?: boolean;
  hideCount?: boolean;
  tabs?: Array<{
    id: string;
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
  }>;
}

const SectionHeader = ({ icon: Icon, title, count, tabs, hideIcon = false, hideCount = false }: SectionHeaderProps) => {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/5 backdrop-blur-3xl">
      {!hideIcon && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-primary shadow-[0_10px_25px_rgba(4,8,20,0.35)]">
          <Icon className="w-3.5 h-3.5" />
        </div>
      )}

      {tabs && tabs.length > 1 ? (
        <div className="flex items-center gap-1">
          {tabs.map((tab, idx) => (
            <div key={tab.id} className="flex items-center gap-0.5">
              <button
                onClick={tab.onClick}
                className={cn(
                  "text-[0.65rem] uppercase tracking-[0.35em] transition-colors px-2 py-1 rounded-full border border-transparent",
                  tab.active
                    ? "text-foreground border-primary/40 bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:border-white/20",
                )}
              >
                {tab.label} ({tab.count})
              </button>
              {idx < tabs.length - 1 && <span className="text-muted-foreground/40 font-mono text-xs">/</span>}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col">
          <span className="text-[0.65rem] uppercase tracking-[0.35em] text-muted-foreground">{title}</span>
          {!hideCount && <span className="text-sm text-foreground font-semibold">{count}</span>}
        </div>
      )}
    </div>
  );
};

export default SectionHeader;
