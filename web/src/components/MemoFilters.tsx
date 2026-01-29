import { isEqual } from "lodash-es";
import {
  BookmarkIcon,
  CalendarIcon,
  CheckCircleIcon,
  CodeIcon,
  EyeIcon,
  HashIcon,
  LinkIcon,
  LucideIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { FilterFactor, getMemoFilterKey, MemoFilter, useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useTranslate } from "@/utils/i18n";

interface FilterConfig {
  icon: LucideIcon;
  getLabel: (value: string, t: ReturnType<typeof useTranslate>) => string;
}

const FILTER_CONFIGS: Record<FilterFactor, FilterConfig> = {
  tagSearch: {
    icon: HashIcon,
    getLabel: (value) => value,
  },
  visibility: {
    icon: EyeIcon,
    getLabel: (value) => value,
  },
  contentSearch: {
    icon: SearchIcon,
    getLabel: (value) => value,
  },
  displayTime: {
    icon: CalendarIcon,
    getLabel: (value) => value,
  },
  pinned: {
    icon: BookmarkIcon,
    getLabel: (value) => value,
  },
  "property.hasLink": {
    icon: LinkIcon,
    getLabel: (_, t) => t("filters.has-link"),
  },
  "property.hasTaskList": {
    icon: CheckCircleIcon,
    getLabel: (_, t) => t("filters.has-task-list"),
  },
  "property.hasCode": {
    icon: CodeIcon,
    getLabel: (_, t) => t("filters.has-code"),
  },
};

const MemoFilters = () => {
  const t = useTranslate();
  const { filters, removeFilter } = useMemoFilterContext();

  const handleRemoveFilter = (filter: MemoFilter) => {
    removeFilter((f: MemoFilter) => isEqual(f, filter));
  };

  const getFilterDisplayText = (filter: MemoFilter): string => {
    const config = FILTER_CONFIGS[filter.factor];
    if (!config) {
      return filter.value || filter.factor;
    }
    return config.getLabel(filter.value, t);
  };

  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="w-full mb-4 flex flex-row justify-start items-center flex-wrap gap-2.5">
      {filters.map((filter) => {
        const config = FILTER_CONFIGS[filter.factor];
        const Icon = config?.icon;

        return (
          <div
            key={getMemoFilterKey(filter)}
            className="group inline-flex items-center gap-2 h-8 px-3 bg-gradient-to-r from-secondary/80 via-secondary/50 to-secondary/80 border border-white/10 rounded-full text-xs uppercase tracking-[0.18em] text-muted-foreground transition-all duration-300 hover:border-primary/40 hover:text-foreground hover:shadow-[0_10px_30px_rgba(4,10,30,0.45)]"
          >
            {Icon && <Icon className="w-3.5 h-3.5 text-primary/70 group-hover:text-primary shrink-0 transition-colors" />}
            <span className="font-semibold max-w-32 truncate">{getFilterDisplayText(filter)}</span>
            <button
              onClick={() => handleRemoveFilter(filter)}
              className="ml-0.5 -mr-1 p-0.5 rounded-full text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-all"
              aria-label="Remove filter"
            >
              <XIcon className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

MemoFilters.displayName = "MemoFilters";

export default MemoFilters;
