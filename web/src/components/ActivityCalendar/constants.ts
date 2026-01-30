export const DAYS_IN_WEEK = 7;
export const MONTHS_IN_YEAR = 12;
export const WEEKEND_DAYS = [0, 6] as const;
export const MIN_COUNT = 1;

export const MIN_YEAR = 2000;
export const getMaxYear = () => new Date().getFullYear() + 1;

export const INTENSITY_THRESHOLDS = {
  HIGH: 0.75,
  MEDIUM: 0.5,
  LOW: 0.25,
  MINIMAL: 0,
} as const;

export const CELL_STYLES = {
  HIGH: "bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(55,110,78,0.25)]",
  MEDIUM: "bg-primary/85 text-primary-foreground shadow-[0_6px_14px_rgba(55,110,78,0.2)]",
  LOW: "bg-primary/65 text-primary-foreground shadow-[0_4px_10px_rgba(55,110,78,0.16)]",
  MINIMAL: "bg-primary/35 text-foreground",
  EMPTY: "bg-secondary/40 text-muted-foreground hover:bg-secondary/60",
} as const;

export const SMALL_CELL_SIZE = {
  font: "text-xs",
  dimensions: "w-8 h-8 mx-auto",
  borderRadius: "rounded-md",
  gap: "gap-1",
} as const;

export const DEFAULT_CELL_SIZE = {
  font: "text-xs",
  borderRadius: "rounded-md",
  gap: "gap-1.5",
} as const;
